from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Any
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
import asyncio

from aws_api.v1.dynamodb import DynamoDB, json_safe
from auth.v1.dependencies import require_table_read, require_table_write


router = APIRouter()


@router.post("/records/batch-get", dependencies=[Depends(require_table_read)])
async def batch_get_records(
    body: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    pk_values = body.get("pkValues", [])

    async def get_one(pk_val):
        try:
            item = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: pk_val})
            if item:
                return {"pkValue": pk_val, "status": "ok", "record": json_safe(item)}
            return {"pkValue": pk_val, "status": "not_found"}
        except ClientError as e:
            return {"pkValue": pk_val, "status": "error", "message": e.response["Error"]["Message"]}

    report = await asyncio.gather(*[get_one(v) for v in pk_values])
    records = [r["record"] for r in report if r.get("record")]
    return {
        "summary": {"requested": len(pk_values), "found": sum(1 for r in report if r["status"] == "ok")},
        "records": records,
        "report": [{"pkValue": r["pkValue"], "status": r["status"], **({"message": r["message"]} if "message" in r else {})} for r in report],
    }


@router.post("/records/batch-create", dependencies=[Depends(require_table_write)])
async def batch_create_records(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    async def create_one(row, index):
        pk_val = row.get(x_pk)
        try:
            await asyncio.to_thread(DynamoDB.put, x_table, item=row, condition_expression=Attr(x_pk).not_exists())
            return {"rowIndex": index, "status": "created", "pkValue": pk_val}
        except ClientError as e:
            code = e.response["Error"]["Code"]
            msg = "Already exists" if code == "ConditionalCheckFailedException" else e.response["Error"]["Message"]
            return {"rowIndex": index, "status": "error", "message": msg, "pkValue": pk_val}

    results = await asyncio.gather(*[create_one(r, i) for i, r in enumerate(rows)])
    return {
        "summary": {"created": sum(1 for r in results if r["status"] == "created"), "failed": sum(1 for r in results if r["status"] == "error")},
        "results": list(results),
    }


@router.post("/records/batch-update", dependencies=[Depends(require_table_write)])
async def batch_update_records(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    async def update_one(row, index):
        pk_val = row.get(x_pk)
        if pk_val is None:
            return {"rowIndex": index, "status": "error", "message": "Missing primary key"}
        updates = {k: v for k, v in row.items() if k != x_pk}
        try:
            await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val}, updates=updates)
            return {"rowIndex": index, "status": "updated", "pkValue": pk_val}
        except ClientError as e:
            return {"rowIndex": index, "status": "error", "message": e.response["Error"]["Message"], "pkValue": pk_val}

    results = await asyncio.gather(*[update_one(r, i) for i, r in enumerate(rows)])
    return {
        "summary": {"updated": sum(1 for r in results if r["status"] == "updated"), "failed": sum(1 for r in results if r["status"] == "error")},
        "results": list(results),
    }


@router.post("/records/upsert", dependencies=[Depends(require_table_write)])
async def upsert_record(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
):
    pk_val = data.get(x_pk)
    if pk_val is None:
        raise HTTPException(status_code=400, detail=f"Primary key field '{x_pk}' is required")
    try:
        existing = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: pk_val})
        if existing:
            updates = {k: v for k, v in data.items() if k != x_pk}
            await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val}, updates=updates)
            return {"status": "updated"}
        await asyncio.to_thread(DynamoDB.put, x_table, item=data)
        return {"status": "created"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.get("/records/export", dependencies=[Depends(require_table_read)])
async def export_records(
    x_table: str = Header(..., alias="x-table"),
):
    try:
        items = await asyncio.to_thread(DynamoDB.scan, x_table)
        return {"items": [json_safe(item) for item in items]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.get("/records/search", dependencies=[Depends(require_table_read)])
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


@router.get("/records", dependencies=[Depends(require_table_read)])
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


@router.post("/records", dependencies=[Depends(require_table_write)])
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


@router.put("/records", dependencies=[Depends(require_table_write)])
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
        await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val}, updates=updates)
        return {"status": "updated", "id": pk_val}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.delete("/records", dependencies=[Depends(require_table_write)])
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
