from fastapi import APIRouter, HTTPException, Header
from typing import Any
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
import asyncio

from aws_api.v1.dynamodb import DynamoDB, json_safe


router = APIRouter()


@router.get("/records/search")
async def search_records(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
):
    try:
        items = await asyncio.to_thread(DynamoDB.scan, x_table, filter_expression=Attr(x_pk).contains(x_pk_value))
        return {"items": [item[x_pk] for item in items if x_pk in item]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.get("/records")
async def get_record(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
):
    try:
        item = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: x_pk_value})
        if not item:
            raise HTTPException(status_code=404, detail="Record not found")
        return json_safe(item)
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.post("/records")
async def create_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    if not data.get(x_pk):
        raise HTTPException(status_code=400, detail=f"Primary key field '{x_pk}' is required in the body")
    try:
        await asyncio.to_thread(DynamoDB.put, x_table, item=data, condition_expression=Attr(x_pk).not_exists())
        return {"status": "created", "id": data[x_pk]}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="Record already exists")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.put("/records")
async def update_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    pk_val = data.get(x_pk)
    if not pk_val:
        raise HTTPException(status_code=400, detail=f"Primary key field '{x_pk}' is required in the body")
    updates = {k: v for k, v in data.items() if k != x_pk}
    try:
        await asyncio.to_thread(
            DynamoDB.update, x_table,
            key={x_pk: pk_val},
            updates=updates,
            condition_expression=Attr(x_pk).exists(),
        )
        return {"status": "updated", "id": pk_val}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="Record not found")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.post("/records/upsert")
async def upsert_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    """
    Create-or-update a single table record (used by CSV bulk import).

    Checks whether the primary key already exists:
      - exists   → UPDATE (only non-key fields)
      - missing  → CREATE
    """
    pk_val = data.get(x_pk)
    if not pk_val:
        raise HTTPException(status_code=400, detail=f"'{x_pk}' is required")

    existing = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: pk_val})

    if existing:
        updates = {k: v for k, v in data.items() if k != x_pk}
        await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val}, updates=updates)
        return {"status": "updated", "id": pk_val}
    else:
        try:
            await asyncio.to_thread(
                DynamoDB.put, x_table, item=data,
                condition_expression=Attr(x_pk).not_exists(),
            )
            return {"status": "created", "id": pk_val}
        except ClientError as e:
            if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
            # Race: concurrent upsert already created the item — fall back to update.
            updates = {k: v for k, v in data.items() if k != x_pk}
            await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val}, updates=updates)
            return {"status": "updated", "id": pk_val}


# ── Batch endpoints ───────────────────────────────────────────────────────────

@router.post("/records/batch-get")
async def batch_get_records(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    """
    Fetch multiple table records by primary key in parallel.
    Body: { "pkValues": ["+15551234567", "+15552222222", ...] }
    Returns each record (or not_found) in a per-row report.
    """
    pk_values: list[str] = data.get("pkValues", [])
    if not pk_values:
        raise HTTPException(status_code=400, detail="pkValues list is required")

    async def _get(pk_val: str):
        item = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: pk_val})
        return pk_val, json_safe(item) if item else None

    results = await asyncio.gather(*[_get(v) for v in pk_values], return_exceptions=True)

    records, report = [], []
    for pk_val, res in zip(pk_values, results):
        if isinstance(res, Exception):
            report.append({"pkValue": pk_val, "status": "error", "message": str(res)})
        else:
            _, item = res
            if item:
                records.append(item)
                report.append({"pkValue": pk_val, "status": "ok"})
            else:
                report.append({"pkValue": pk_val, "status": "not_found"})

    return {
        "records": records,
        "report": report,
        "summary": {
            "requested": len(pk_values),
            "found": sum(1 for r in report if r["status"] == "ok"),
            "not_found": sum(1 for r in report if r["status"] == "not_found"),
            "failed": sum(1 for r in report if r["status"] == "error"),
            "records_fetched": len(records),
        },
    }


@router.post("/records/batch-create")
async def batch_create_records(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    """Create multiple records in parallel. Fails per-row if pk already exists."""
    if not rows:
        raise HTTPException(status_code=400, detail="Request body must be a non-empty list")

    async def _create(i: int, row: dict[str, Any]):
        pk_val = row.get(x_pk)
        if not pk_val:
            return {"rowIndex": i, "status": "error", "message": f"Missing '{x_pk}'"}
        try:
            await asyncio.to_thread(
                DynamoDB.put, x_table, item=row,
                condition_expression=Attr(x_pk).not_exists(),
            )
            return {"rowIndex": i, "id": pk_val, "status": "created"}
        except ClientError as e:
            msg = ("Record already exists"
                   if e.response["Error"]["Code"] == "ConditionalCheckFailedException"
                   else e.response["Error"]["Message"])
            return {"rowIndex": i, "id": pk_val, "status": "error", "message": msg}

    results = list(await asyncio.gather(*[_create(i, r) for i, r in enumerate(rows)]))
    return {
        "results": results,
        "summary": {
            "total": len(results),
            "created": sum(1 for r in results if r.get("status") == "created"),
            "failed":  sum(1 for r in results if r.get("status") == "error"),
        },
    }


@router.post("/records/batch-update")
async def batch_update_records(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    """Update multiple records in parallel. Fails per-row if pk does not exist."""
    if not rows:
        raise HTTPException(status_code=400, detail="Request body must be a non-empty list")

    async def _update(i: int, row: dict[str, Any]):
        pk_val = row.get(x_pk)
        if not pk_val:
            return {"rowIndex": i, "status": "error", "message": f"Missing '{x_pk}'"}
        try:
            updates = {k: v for k, v in row.items() if k != x_pk}
            await asyncio.to_thread(
                DynamoDB.update, x_table,
                key={x_pk: pk_val},
                updates=updates,
                condition_expression=Attr(x_pk).exists(),
            )
            return {"rowIndex": i, "id": pk_val, "status": "updated"}
        except ClientError as e:
            msg = ("Record does not exist — use Bulk Create"
                   if e.response["Error"]["Code"] == "ConditionalCheckFailedException"
                   else e.response["Error"]["Message"])
            return {"rowIndex": i, "id": pk_val, "status": "error", "message": msg}

    results = list(await asyncio.gather(*[_update(i, r) for i, r in enumerate(rows)]))
    return {
        "results": results,
        "summary": {
            "total": len(results),
            "updated": sum(1 for r in results if r.get("status") == "updated"),
            "failed":  sum(1 for r in results if r.get("status") == "error"),
        },
    }


@router.delete("/records")
async def delete_record(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
):
    try:
        await asyncio.to_thread(DynamoDB.delete, x_table, key={x_pk: x_pk_value})
        return {"status": "deleted"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
