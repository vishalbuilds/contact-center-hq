from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Any
import asyncio
import boto3
from botocore.exceptions import ClientError
import json
import os
from pathlib import Path
from decimal import Decimal


DYNAMODB_ENDPOINT = os.getenv("DYNAMODB_ENDPOINT", "http://localhost:8001")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    endpoint_url=DYNAMODB_ENDPOINT,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "dummy"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "dummy"),
)

# Path is relative to this file. In Docker, frontend/ is copied alongside backend/.
SCHEMA_PATH = Path(__file__).parent.parent / "frontend" / "uiSchema.json"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Wait for DynamoDB to be reachable before accepting traffic."""
    for attempt in range(20):
        try:
            await asyncio.to_thread(dynamodb.meta.client.list_tables)
            break
        except Exception:
            if attempt < 19:
                await asyncio.sleep(1)
    yield


app = FastAPI(title="Contact Center HQ", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_schema() -> dict:
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def json_safe(obj: Any) -> Any:
    """Recursively convert DynamoDB Decimal values to int/float."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(i) for i in obj]
    return obj


def scan_all(table) -> list[dict]:
    """Paginate through all DynamoDB scan pages and return every item."""
    items: list[dict] = []
    kwargs: dict = {}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return items


def get_or_create_table(table_name: str, pk: str):
    """Return the DynamoDB Table object, creating it if absent.

    Raises ClientError for unexpected DynamoDB failures (caller decides how to handle).
    """
    table = dynamodb.Table(table_name)
    try:
        table.load()
        return table
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
    table = dynamodb.create_table(
        TableName=table_name,
        KeySchema=[{"AttributeName": pk, "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": pk, "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )
    table.wait_until_exists()
    return table


def resolve_table(table_name: str, schema: dict):
    """Validate table name against schema, then return its DynamoDB Table object.

    Raises HTTP 404 if the table isn't in the schema, HTTP 502 on DynamoDB errors.
    """
    table_config = schema["tables"].get(table_name)
    if not table_config:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found in schema")
    pk = table_config["primaryKey"]
    try:
        return get_or_create_table(table_name, pk)
    except ClientError as e:
        raise HTTPException(
            status_code=502,
            detail=f"DynamoDB error: {e.response['Error']['Message']}",
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/schema")
def get_schema():
    return load_schema()


@app.get("/api/search")
def search(
    q: str = Query(..., min_length=1),
    filters: str = Query(default=None),
):
    schema = load_schema()
    term = q.lower()
    active_filters = set(filters.split(",")) if filters else set(schema.get("searchFields", []))
    results = []

    for table_name, table_config in schema["tables"].items():
        pk = table_config["primaryKey"]
        try:
            table = get_or_create_table(table_name, pk)
            items = scan_all(table)
        except ClientError:
            # Skip tables that are unreachable; don't let one bad table break the whole search.
            continue

        for item in items:
            matched = []
            for field_name, field_cfg in table_config["fields"].items():
                if not field_cfg.get("searchable"):
                    continue
                if field_name not in active_filters:
                    continue
                if term in str(item.get(field_name, "")).lower():
                    matched.append(field_name)
            if matched:
                results.append({
                    "table": table_name,
                    "tableLabel": table_config["label"],
                    "primaryKey": pk,
                    "id": item.get(pk, ""),
                    "item": json_safe(item),
                    "matchedFields": matched,
                })

    return {"results": results, "total": len(results)}


@app.get("/api/records/{table_name}")
def list_records(table_name: str):
    schema = load_schema()
    table = resolve_table(table_name, schema)
    return {"items": json_safe(scan_all(table))}


@app.get("/api/records/{table_name}/{record_id}")
def get_record(table_name: str, record_id: str):
    schema = load_schema()
    table = resolve_table(table_name, schema)
    pk = schema["tables"][table_name]["primaryKey"]
    response = table.get_item(Key={pk: record_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Record not found")
    return json_safe(item)


@app.put("/api/records/{table_name}/{record_id}")
def update_record(table_name: str, record_id: str, data: dict[str, Any]):
    schema = load_schema()
    table = resolve_table(table_name, schema)
    pk = schema["tables"][table_name]["primaryKey"]
    data[pk] = record_id  # Ensure PK in body always matches URL
    table.put_item(Item=data)
    return {"status": "updated", "id": record_id}


@app.post("/api/records/{table_name}")
def create_record(table_name: str, data: dict[str, Any]):
    schema = load_schema()
    table = resolve_table(table_name, schema)
    pk = schema["tables"][table_name]["primaryKey"]
    if not data.get(pk):
        raise HTTPException(status_code=400, detail=f"Primary key '{pk}' is required")
    table.put_item(Item=data)
    return {"status": "created", "id": data[pk]}


@app.delete("/api/records/{table_name}/{record_id}")
def delete_record(table_name: str, record_id: str):
    schema = load_schema()
    table = resolve_table(table_name, schema)
    pk = schema["tables"][table_name]["primaryKey"]
    table.delete_item(Key={pk: record_id})
    return {"status": "deleted"}


# Serve the React SPA last so /api/* routes take priority.
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
