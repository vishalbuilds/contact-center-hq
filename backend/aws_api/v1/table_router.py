from fastapi import APIRouter, HTTPException, Header
from typing import Any
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
import asyncio
import os

from aws_api.v1.dynamodb import DynamoDB, json_safe

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

router = APIRouter()


@router.get("/records/{table_name}/search")
async def search_records(
    table_name: str,
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
):
    try:
        items = await asyncio.to_thread(DynamoDB.scan, table_name, AWS_REGION, filter_expression=Attr(x_pk).contains(x_pk_value))
        return {"items": [item[x_pk] for item in items if x_pk in item]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.get("/records/{table_name}/{record_id}")
async def get_record(
    table_name: str,
    record_id: str,
    x_pk: str = Header(..., alias="x-pk"),
):
    try:
        item = await asyncio.to_thread(DynamoDB.get, table_name, AWS_REGION, key={x_pk: record_id})
        if not item:
            raise HTTPException(status_code=404, detail="Record not found")
        return json_safe(item)
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.post("/records/{table_name}")
async def create_record(
    table_name: str,
    data: dict[str, Any],
    x_pk: str = Header(..., alias="x-pk"),
):
    if not data.get(x_pk):
        raise HTTPException(status_code=400, detail=f"Primary key field '{x_pk}' is required in the body")
    try:
        await asyncio.to_thread(DynamoDB.put, table_name, AWS_REGION, item=data, condition_expression=Attr(x_pk).not_exists())
        return {"status": "created", "id": data[x_pk]}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="Record already exists")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.put("/records/{table_name}/{record_id}")
async def update_record(
    table_name: str,
    record_id: str,
    data: dict[str, Any],
    x_pk: str = Header(..., alias="x-pk"),
):
    updates = {k: v for k, v in data.items() if k != x_pk}
    try:
        await asyncio.to_thread(DynamoDB.update, table_name, AWS_REGION, key={x_pk: record_id}, updates=updates)
        return {"status": "updated", "id": record_id}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@router.delete("/records/{table_name}/{record_id}")
async def delete_record(
    table_name: str,
    record_id: str,
    x_pk: str = Header(..., alias="x-pk"),
):
    try:
        await asyncio.to_thread(DynamoDB.delete, table_name, AWS_REGION, key={x_pk: record_id})
        return {"status": "deleted"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
