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
        await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val}, updates=updates)
        return {"status": "updated", "id": pk_val}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


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
