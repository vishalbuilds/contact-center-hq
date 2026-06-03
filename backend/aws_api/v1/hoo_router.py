from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks
from typing import Any
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
import asyncio
import logging

from aws_api.v1.dynamodb import DynamoDB, json_safe
from aws_api.v1.ses_client import send_hoo_alert
from aws_api.v1.connect_client import describe_queue

logger = logging.getLogger(__name__)

hoo_router = APIRouter()

_CONNECT_NOT_FOUND = {"ResourceNotFoundException", "NotFoundException"}


@hoo_router.get("/by-queue")
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


@hoo_router.get("/records")
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


@hoo_router.get("/record")
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


@hoo_router.post("/record")
async def create_hoo_record(
    data: dict[str, Any],
    background_tasks: BackgroundTasks,
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
        background_tasks.add_task(
            send_hoo_alert,
            action="created",
            queue_name=data.get("queueName", ""),
            queue_arn=data.get(x_pk, ""),
            sort_key_name=x_sk,
            sort_key_value=str(data.get(x_sk, "")),
        )
        return {"status": "created"}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="Record already exists")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.put("/record")
async def update_hoo_record(
    data: dict[str, Any],
    background_tasks: BackgroundTasks,
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
    x_sk_value: str = Header(..., alias="x-sk-value"),
):
    updates = {k: v for k, v in data.items() if k != x_pk and k != x_sk}
    try:
        await asyncio.to_thread(
            DynamoDB.update, x_table,
            key={x_pk: x_pk_value, x_sk: x_sk_value},
            updates=updates,
            condition_expression=Attr(x_pk).exists(),
        )
        background_tasks.add_task(
            send_hoo_alert,
            action="updated",
            queue_name=data.get("queueName", ""),
            queue_arn=x_pk_value,
            sort_key_name=x_sk,
            sort_key_value=x_sk_value,
            changed_fields=list(updates.keys()),
        )
        return {"status": "updated"}
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="Record not found")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.delete("/record")
async def delete_hoo_record(
    background_tasks: BackgroundTasks,
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
    x_sk_value: str = Header(..., alias="x-sk-value"),
):
    try:
        await asyncio.to_thread(DynamoDB.delete, x_table, key={x_pk: x_pk_value, x_sk: x_sk_value})
        background_tasks.add_task(
            send_hoo_alert,
            action="deleted",
            queue_name="",
            queue_arn=x_pk_value,
            sort_key_name=x_sk,
            sort_key_value=x_sk_value,
        )
        return {"status": "deleted"}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.delete("/all")
async def delete_all_queue_records(
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_pk_value: str = Header(..., alias="x-pk-value"),
    x_sk: str = Header(..., alias="x-sk"),
):
    """Delete every record for a queue (all sort-key values) in parallel."""
    try:
        items = await asyncio.to_thread(DynamoDB.query, x_table, key_condition=Key(x_pk).eq(x_pk_value))
        await asyncio.gather(
            *[
                asyncio.to_thread(DynamoDB.delete, x_table, key={x_pk: item[x_pk], x_sk: item[x_sk]})
                for item in items
            ]
        )
        return {"status": "deleted", "count": len(items)}
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])


@hoo_router.post("/upsert")
async def upsert_hoo_record(
    data: dict[str, Any],
    background_tasks: BackgroundTasks,
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
    x_validate_connect: str = Header("false", alias="x-validate-connect"),
):
    """
    Create-or-update a single HOO record (used by CSV bulk import).

    Checks whether (pk, sk) already exists in DynamoDB:
      - exists   → UPDATE (only non-key fields)
      - missing  → CREATE

    With x-validate-connect: true the queueArn is verified against Amazon
    Connect before writing. Returns HTTP 422 with a human-readable message on
    validation failure so the bulk-import UI can display it per-row without
    treating it as a crash.

    On success fires a background SES alert identical to the individual
    create/update routes.
    """
    pk_val = data.get(x_pk)
    sk_val = data.get(x_sk)

    if not pk_val:
        raise HTTPException(status_code=400, detail=f"'{x_pk}' is required")
    if not sk_val:
        raise HTTPException(status_code=400, detail=f"'{x_sk}' is required")

    if x_validate_connect.lower() == "true":
        queue_name = data.get("queueName", "")
        try:
            queue = await asyncio.to_thread(describe_queue, pk_val)
            connect_name = queue.get("Name", "")
            if connect_name.lower() != queue_name.strip().lower():
                raise HTTPException(
                    status_code=422,
                    detail=f"Name mismatch — Connect has '{connect_name}', got '{queue_name}'",
                )
        except HTTPException:
            raise
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in _CONNECT_NOT_FOUND:
                raise HTTPException(status_code=422, detail=f"Queue ARN not found in Amazon Connect: {pk_val}")
            raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
        except RuntimeError as e:
            # Only swallow the "config file missing / APP_ENV not set" errors
            # from _init(). Any other RuntimeError is unexpected — re-raise it.
            if "connect_config.yaml" not in str(e) and "APP_ENV" not in str(e):
                raise
            logger.warning(f"Connect validation skipped: {e}")

    existing = await asyncio.to_thread(DynamoDB.get, x_table, key={x_pk: pk_val, x_sk: sk_val})

    if existing:
        updates = {k: v for k, v in data.items() if k != x_pk and k != x_sk}
        await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val, x_sk: sk_val}, updates=updates)
        action = "updated"
    else:
        try:
            await asyncio.to_thread(
                DynamoDB.put, x_table, item=data,
                condition_expression=Attr(x_pk).not_exists(),
            )
            action = "created"
        except ClientError as e:
            if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
            # Race: concurrent upsert already created the item — fall back to update.
            updates = {k: v for k, v in data.items() if k != x_pk and k != x_sk}
            await asyncio.to_thread(DynamoDB.update, x_table, key={x_pk: pk_val, x_sk: sk_val}, updates=updates)
            action = "updated"

    background_tasks.add_task(
        send_hoo_alert,
        action=action,
        queue_name=data.get("queueName", ""),
        queue_arn=pk_val,
        sort_key_name=x_sk,
        sort_key_value=str(sk_val),
    )

    return {"status": action}


# ── Batch endpoints ───────────────────────────────────────────────────────────
# All three process rows in parallel with asyncio.gather.
# Individual row failures are captured in the report rather than aborting the
# whole request — the caller always gets a full report back.

@hoo_router.post("/batch-get")
async def batch_get_queues(
    data: dict[str, Any],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_gsi_key: str = Header(..., alias="x-gsi-key"),
    x_sk: str = Header(..., alias="x-sk"),
):
    """
    Fetch all HOO records for a list of queue names in one request.

    Body: { "queueNames": ["Support Queue", "Billing Queue", ...] }

    Uses a single DynamoDB scan filtered by all names at once (Attr.is_in),
    then queries each found queueArn in parallel. Returns the full record set
    plus a per-queue report so the frontend can display found/not-found status
    and offer a CSV download of the results.
    """
    queue_names: list[str] = data.get("queueNames", [])
    if not queue_names:
        raise HTTPException(status_code=400, detail="queueNames list is required")

    try:
        matched = await asyncio.to_thread(
            DynamoDB.scan, x_table,
            filter_expression=Attr(x_gsi_key).is_in(queue_names),
            projection_expression="#pk, #gsk",
            expression_attribute_names={"#pk": x_pk, "#gsk": x_gsi_key},
        )
    except ClientError as e:
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])

    # Deduplicate: first occurrence of each queueArn wins
    found: dict[str, str] = {}  # {queueArn: queueName}
    for item in matched:
        arn = item.get(x_pk)
        name = item.get(x_gsi_key, "")
        if arn and arn not in found:
            found[arn] = name

    # Case-insensitive match so "support queue" finds "Support Queue" in DynamoDB
    found_names_lower = {v.lower() for v in found.values()}
    not_found_names = [n for n in queue_names if n.lower() not in found_names_lower]

    async def _fetch(arn: str):
        items = await asyncio.to_thread(DynamoDB.query, x_table, key_condition=Key(x_pk).eq(arn))
        return arn, [json_safe(i) for i in items]

    fetch_results = await asyncio.gather(
        *[_fetch(arn) for arn in found], return_exceptions=True
    )

    all_records: list[dict] = []
    report: list[dict] = []

    for res in fetch_results:
        if isinstance(res, Exception):
            logger.error(f"batch-get fetch error: {res}")
            continue
        arn, records = res
        all_records.extend(records)
        report.append({"queueName": found[arn], "queueArn": arn, "status": "ok", "recordCount": len(records)})

    for name in not_found_names:
        report.append({"queueName": name, "queueArn": None, "status": "not_found", "recordCount": 0})

    return {
        "records": all_records,
        "report": report,
        "summary": {
            "requested": len(queue_names),
            "found": len(found),
            "not_found": len(not_found_names),
            "records_fetched": len(all_records),
        },
    }


@hoo_router.post("/batch-create")
async def batch_create_queues(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    """
    Create multiple HOO records in parallel.
    Fails per-row (not the whole request) if a record already exists.
    """
    if not rows:
        raise HTTPException(status_code=400, detail="Request body must be a non-empty list")

    async def _create(i: int, row: dict[str, Any]):
        pk_val = row.get(x_pk)
        sk_val = row.get(x_sk)
        if not pk_val:
            return {"rowIndex": i, "status": "error", "message": f"Missing '{x_pk}'"}
        if not sk_val:
            return {"rowIndex": i, "status": "error", "message": f"Missing '{x_sk}'"}
        try:
            await asyncio.to_thread(
                DynamoDB.put, x_table, item=row,
                condition_expression=Attr(x_pk).not_exists(),
            )
            return {"rowIndex": i, "queueName": row.get("queueName", ""),
                    "queueArn": pk_val, "sortKey": sk_val, "status": "created"}
        except ClientError as e:
            msg = ("Record already exists"
                   if e.response["Error"]["Code"] == "ConditionalCheckFailedException"
                   else e.response["Error"]["Message"])
            return {"rowIndex": i, "queueName": row.get("queueName", ""),
                    "queueArn": pk_val, "sortKey": sk_val, "status": "error", "message": msg}

    results = list(await asyncio.gather(*[_create(i, r) for i, r in enumerate(rows)]))
    return {
        "results": results,
        "summary": {
            "total": len(results),
            "created": sum(1 for r in results if r.get("status") == "created"),
            "failed":  sum(1 for r in results if r.get("status") == "error"),
        },
    }


@hoo_router.post("/batch-update")
async def batch_update_queues(
    rows: list[dict[str, Any]],
    x_table: str = Header(..., alias="x-table"),
    x_pk: str = Header(..., alias="x-pk"),
    x_sk: str = Header(..., alias="x-sk"),
):
    """
    Update multiple HOO records in parallel.
    Fails per-row if the record does NOT already exist.
    Each row check + update runs concurrently; the check (GET) and write (UPDATE)
    per row are sequential within that row to avoid race conditions.
    """
    if not rows:
        raise HTTPException(status_code=400, detail="Request body must be a non-empty list")

    async def _update(i: int, row: dict[str, Any]):
        pk_val = row.get(x_pk)
        sk_val = row.get(x_sk)
        if not pk_val:
            return {"rowIndex": i, "status": "error", "message": f"Missing '{x_pk}'"}
        if not sk_val:
            return {"rowIndex": i, "status": "error", "message": f"Missing '{x_sk}'"}
        try:
            updates = {k: v for k, v in row.items() if k not in (x_pk, x_sk)}
            await asyncio.to_thread(
                DynamoDB.update, x_table,
                key={x_pk: pk_val, x_sk: sk_val},
                updates=updates,
                condition_expression=Attr(x_pk).exists(),
            )
            return {"rowIndex": i, "queueName": row.get("queueName", ""),
                    "queueArn": pk_val, "sortKey": sk_val, "status": "updated"}
        except ClientError as e:
            msg = ("Record does not exist — use Bulk Create"
                   if e.response["Error"]["Code"] == "ConditionalCheckFailedException"
                   else e.response["Error"]["Message"])
            return {"rowIndex": i, "queueName": row.get("queueName", ""),
                    "queueArn": pk_val, "sortKey": sk_val,
                    "status": "error", "message": msg}

    results = list(await asyncio.gather(*[_update(i, r) for i, r in enumerate(rows)]))
    return {
        "results": results,
        "summary": {
            "total": len(results),
            "updated": sum(1 for r in results if r.get("status") == "updated"),
            "failed":  sum(1 for r in results if r.get("status") == "error"),
        },
    }
