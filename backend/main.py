from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from typing import Any
import asyncio
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
import os
from pathlib import Path
from decimal import Decimal

from aws_api.dynamodb import get_table, ping


AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


@asynccontextmanager
async def lifespan(app: FastAPI):
    for attempt in range(20):
        try:
            await asyncio.to_thread(ping, AWS_REGION)
            break
        except Exception:
            if attempt < 19:
                await asyncio.sleep(1)
    yield


app = FastAPI(title="Contact Center HQ", lifespan=lifespan)


def json_safe(obj: Any) -> Any:
    """Recursively convert DynamoDB Decimal values to int/float."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(i) for i in obj]
    return obj



@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/records/{table_name}/search")
def search_records(
    table_name: str,
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
):
    try:
        db = get_table(table_name, AWS_REGION)
        items = db.scan_attr(filter_expression=Attr(x_pk).contains(x_pk_value))
        return {"items": [item[x_pk] for item in items if x_pk in item]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@app.get("/api/records/{table_name}/{record_id}")
def get_record(
    table_name: str,
    record_id: str,
    x_pk: str = Header(..., alias="x-pk"),
):
    try:
        db = get_table(table_name, AWS_REGION)
        item = db.get_attr(key={x_pk: record_id})
        if not item:
            raise HTTPException(status_code=404, detail="Record not found")
        return json_safe(item)
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@app.post("/api/records/{table_name}")
def create_record(
    table_name: str,
    data: dict[str, Any],
    x_pk: str = Header(..., alias="x-pk"),
):
    if not data.get(x_pk):
        raise HTTPException(status_code=400, detail=f"Primary key field '{x_pk}' is required in the body")
    try:
        db = get_table(table_name, AWS_REGION)
        db.put_attr(item=data)
        return {"status": "created", "id": data[x_pk]}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@app.put("/api/records/{table_name}/{record_id}")
def update_record(
    table_name: str,
    record_id: str,
    data: dict[str, Any],
    x_pk: str = Header(..., alias="x-pk"),
):
    updates = {k: v for k, v in data.items() if k != x_pk}
    try:
        db = get_table(table_name, AWS_REGION)
        db.update_attr(key={x_pk: record_id}, updates=updates)
        return {"status": "updated", "id": record_id}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@app.delete("/api/records/{table_name}/{record_id}")
def delete_record(
    table_name: str,
    record_id: str,
    x_pk: str = Header(..., alias="x-pk"),
):
    try:
        db = get_table(table_name, AWS_REGION)
        db.delete_attr(key={x_pk: record_id})
        return {"status": "deleted"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


# Serve the React SPA last so /api/* routes take priority.
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
