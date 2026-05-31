from fastapi import APIRouter, HTTPException, Header, Query
from typing import Any
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
import asyncio
import os

from aws_api.v1.dynamodb import DynamoDB, json_safe

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

hoo_router = APIRouter()


@hoo_router.get("/{table_name}/by-queue")
async def search_by_queue_name(
    table_name: str,
    queue_name: str = Query(...),
    x_pk: str = Header(..., alias="x-pk"),
    x_gsi_key: str = Header(..., alias="x-gsi-key"),
):
    """Scan for queues whose GSI key begins_with queue_name. Returns deduplicated {queueArn, queueName}."""
    try:
        items = await asyncio.to_thread(
            DynamoDB.scan,
            table_name,
            AWS_REGION,
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


@hoo_router.get("/{table_name}/records/{queue_arn}")
async def get_queue_records(
    table_name: str,
    queue_arn: str,
    x_pk: str = Header(..., alias="x-pk"),
):
    """Return all records for a given queueArn (all sort-key values)."""
    try:
        items = await asyncio.to_thread(DynamoDB.query, table_name, AWS_REGION, key_condition=Key(x_pk).eq(queue_arn))
        return {"items": [json_safe(i) for i in items]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.get("/{table_name}/record/{queue_arn}/{sort_value:path}")
async def get_hoo_record(
    table_name: str,
    queue_arn: str,
    sort_value: str,
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    try:
        item = await asyncio.to_thread(DynamoDB.get, table_name, AWS_REGION, key={x_pk: queue_arn, x_sk: sort_value})
        if not item:
            raise HTTPException(status_code=404, detail="Record not found")
        return json_safe(item)
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.post("/{table_name}/record")
async def create_hoo_record(
    table_name: str,
    data: dict[str, Any],
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    if not data.get(x_pk):
        raise HTTPException(status_code=400, detail=f"Primary key '{x_pk}' is required")
    if not data.get(x_sk):
        raise HTTPException(status_code=400, detail=f"Sort key '{x_sk}' is required")
    try:
        await asyncio.to_thread(DynamoDB.put, table_name, AWS_REGION, item=data, condition_expression=Attr(x_pk).not_exists())
        return {"status": "created"}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="Record already exists")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.put("/{table_name}/record/{queue_arn}/{sort_value:path}")
async def update_hoo_record(
    table_name: str,
    queue_arn: str,
    sort_value: str,
    data: dict[str, Any],
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    updates = {k: v for k, v in data.items() if k != x_pk and k != x_sk}
    try:
        await asyncio.to_thread(DynamoDB.update, table_name, AWS_REGION, key={x_pk: queue_arn, x_sk: sort_value}, updates=updates)
        return {"status": "updated"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.delete("/{table_name}/record/{queue_arn}/{sort_value:path}")
async def delete_hoo_record(
    table_name: str,
    queue_arn: str,
    sort_value: str,
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    try:
        await asyncio.to_thread(DynamoDB.delete, table_name, AWS_REGION, key={x_pk: queue_arn, x_sk: sort_value})
        return {"status": "deleted"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.delete("/{table_name}/all/{queue_arn}")
async def delete_all_queue_records(
    table_name: str,
    queue_arn: str,
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    """Delete every record for a queue (all sort-key values)."""
    try:
        items = await asyncio.to_thread(DynamoDB.query, table_name, AWS_REGION, key_condition=Key(x_pk).eq(queue_arn))
        for item in items:
            await asyncio.to_thread(DynamoDB.delete, table_name, AWS_REGION, key={x_pk: item[x_pk], x_sk: item[x_sk]})
        return {"status": "deleted", "count": len(items)}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
