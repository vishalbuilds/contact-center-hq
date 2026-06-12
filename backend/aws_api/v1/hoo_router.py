from fastapi import APIRouter, Depends, HTTPException, Header, Query
from typing import Any
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
import asyncio

from aws_api.v1.dynamodb import DynamoDB, json_safe
from auth.v1.dependencies import require_hoo_read, require_hoo_write


hoo_router = APIRouter()


@hoo_router.get("/export", dependencies=[Depends(require_hoo_read)])
async def export_hoo_records(
    x_table: str = Header(..., alias="x-table"),
):
    try:
        items = await asyncio.to_thread(DynamoDB.scan, x_table)
        return {"items": [json_safe(item) for item in items]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.post("/batch-get", dependencies=[Depends(require_hoo_read)])
async def batch_get_hoo(
    body: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_gsi_key: str = Header(..., alias="x-gsi-key"),
    x_sk: str = Header(..., alias="x-sk"),
):
    queue_names = body.get("queueNames", [])

    async def get_queue(queue_name):
        items = await asyncio.to_thread(
            DynamoDB.scan, x_table,
            filter_expression=Attr(x_gsi_key).begins_with(queue_name),
            projection_expression="#pk, #gsk",
            expression_attribute_names={"#pk": x_pk, "#gsk": x_gsi_key},
        )
        seen: dict[str, str] = {}
        for item in items:
            pk_val = item.get(x_pk)
            if pk_val and pk_val not in seen:
                seen[pk_val] = item.get(x_gsi_key, "")
        return seen

    all_records: list[dict] = []
    report: list[dict] = []
    for name in queue_names:
        try:
            queue_map = await get_queue(name)
            if not queue_map:
                report.append({"queueName": name, "status": "not_found"})
                continue
            for arn, q_name in queue_map.items():
                records = await asyncio.to_thread(DynamoDB.query, x_table, key_condition=Key(x_pk).eq(arn))
                all_records.extend(json_safe(r) for r in records)
                report.append({"queueName": q_name, "queueArn": arn, "status": "ok"})
        except ClientError as e:
            report.append({"queueName": name, "status": "error", "message": e.response["Error"]["Message"]})

    found = sum(1 for r in report if r["status"] == "ok")
    return {
        "summary": {"requested": len(queue_names), "found": found, "records_fetched": len(all_records)},
        "records": all_records,
        "report": report,
    }


@hoo_router.post("/batch-create", dependencies=[Depends(require_hoo_write)])
async def batch_create_hoo(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    async def create_one(row, index):
        try:
            await asyncio.to_thread(DynamoDB.put, x_table, item=row, condition_expression=Attr(x_pk).not_exists())
            return {"rowIndex": index, "status": "created", "pkValue": row.get(x_pk)}
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg = "Already exists" if code == "ConditionalCheckFailedException" else e.response["Error"]["Message"]
            return {"rowIndex": index, "status": "error", "message": msg, "pkValue": row.get(x_pk)}

    results = await asyncio.gather(*[create_one(r, i) for i, r in enumerate(rows)])
    return {
        "summary": {"created": sum(1 for r in results if r["status"] == "created"), "failed": sum(1 for r in results if r["status"] == "error")},
        "results": list(results),
    }


@hoo_router.post("/batch-update", dependencies=[Depends(require_hoo_write)])
async def batch_update_hoo(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    async def update_one(row, index):
        pk_val = row.get(x_pk)
        sk_val = row.get(x_sk)
        if pk_val is None or sk_val is None:
            return {"rowIndex": index, "status": "error", "message": "Missing key fields"}
        updates = {k: v for k, v in row.items() if k not in (x_pk, x_sk)}
        try:
            await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val, x_sk: sk_val}, updates=updates)
            return {"rowIndex": index, "status": "updated", "pkValue": pk_val, "sortKey": sk_val}
        except ClientError as e:
            return {"rowIndex": index, "status": "error", "message": e.response["Error"]["Message"]}

    results = await asyncio.gather(*[update_one(r, i) for i, r in enumerate(rows)])
    return {
        "summary": {"updated": sum(1 for r in results if r["status"] == "updated"), "failed": sum(1 for r in results if r["status"] == "error")},
        "results": list(results),
    }


@hoo_router.post("/upsert", dependencies=[Depends(require_hoo_write)])
async def upsert_hoo_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    pk_val = data.get(x_pk)
    sk_val = data.get(x_sk)
    if pk_val is None or sk_val is None:
        raise HTTPException(status_code=400, detail="Primary key and sort key are required")
    try:
        existing = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: pk_val, x_sk: sk_val})
        if existing:
            updates = {k: v for k, v in data.items() if k not in (x_pk, x_sk)}
            await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val, x_sk: sk_val}, updates=updates)
            return {"status": "updated"}
        await asyncio.to_thread(DynamoDB.put, x_table, item=data)
        return {"status": "created"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.get("/by-queue", dependencies=[Depends(require_hoo_read)])
async def search_by_queue_name(
    queue_name: str = Query(...),
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_gsi_key: str = Header(..., alias="x-gsi-key"),
):
    """Scan for queues whose GSI key begins_with queue_name. Returns deduplicated {queueArn, queueName}."""
    try:
        items = await asyncio.to_thread(
            DynamoDB.scan,
            x_table,
            filter_expression=Attr(x_gsi_key).begins_with(queue_name),
            projection_expression="#pk, #gsk",
            expression_attribute_names={"#pk": x_pk, "#gsk": x_gsi_key},
        )
        seen: dict[str, dict] = {}
        for item in items:
            pk_val = item.get(x_pk)
            if pk_val and pk_val not in seen:
                seen[pk_val] = {"queueArn": pk_val, "queueName": item.get(x_gsi_key, "")}
        return {"items": list(seen.values())}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.get("/records", dependencies=[Depends(require_hoo_read)])
async def get_queue_records(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
):
    """Return all records for a given queueArn (all sort-key values)."""
    try:
        items = await asyncio.to_thread(DynamoDB.query, x_table, key_condition=Key(x_pk).eq(x_pk_value))
        return {"items": [json_safe(i) for i in items]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.get("/record", dependencies=[Depends(require_hoo_read)])
async def get_hoo_record(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
    x_sk_value: str = Header(..., alias="x-sk-value"),
):
    try:
        item = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: x_pk_value, x_sk: x_sk_value})
        if not item:
            raise HTTPException(status_code=404, detail="Record not found")
        return json_safe(item)
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.post("/record", dependencies=[Depends(require_hoo_write)])
async def create_hoo_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    if not data.get(x_pk):
        raise HTTPException(status_code=400, detail=f"Primary key '{x_pk}' is required")
    if not data.get(x_sk):
        raise HTTPException(status_code=400, detail=f"Sort key '{x_sk}' is required")
    try:
        await asyncio.to_thread(DynamoDB.put, x_table, item=data, condition_expression=Attr(x_pk).not_exists())
        return {"status": "created"}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="Record already exists")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.put("/record", dependencies=[Depends(require_hoo_write)])
async def update_hoo_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
    x_sk_value: str = Header(..., alias="x-sk-value"),
):
    updates = {k: v for k, v in data.items() if k != x_pk and k != x_sk}
    try:
        await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: x_pk_value, x_sk: x_sk_value}, updates=updates)
        return {"status": "updated"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.delete("/record", dependencies=[Depends(require_hoo_write)])
async def delete_hoo_record(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
    x_sk_value: str = Header(..., alias="x-sk-value"),
):
    try:
        await asyncio.to_thread(DynamoDB.delete, x_table, key={x_pk: x_pk_value, x_sk: x_sk_value})
        return {"status": "deleted"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.delete("/all", dependencies=[Depends(require_hoo_write)])
async def delete_all_queue_records(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
):
    """Delete every record for a queue (all sort-key values).

    Attempts all deletes even if individual ones fail, then reports
    counts so the caller always knows the final state.
    """
    try:
        items = await asyncio.to_thread(DynamoDB.query, x_table, key_condition=Key(x_pk).eq(x_pk_value))
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])

    deleted = 0
    failed = 0
    for item in items:
        try:
            await asyncio.to_thread(DynamoDB.delete, x_table, key={x_pk: item[x_pk], x_sk: item[x_sk]})
            deleted += 1
        except ClientError:
            failed += 1

    if failed:
        raise HTTPException(
            status_code=502,
            detail=f"Partial delete: {deleted} deleted, {failed} failed. Retry to remove remaining records.",
        )
    return {"status": "deleted", "count": deleted}
