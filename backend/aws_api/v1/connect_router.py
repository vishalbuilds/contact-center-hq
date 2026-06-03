from fastapi import APIRouter, HTTPException
from typing import Any
from botocore.exceptions import ClientError
import asyncio
import logging

from aws_api.v1.connect_client import describe_queue

logger = logging.getLogger(__name__)

connect_router = APIRouter()

_NOT_FOUND_CODES = {"ResourceNotFoundException", "NotFoundException"}


@connect_router.post("/validate-queue")
async def validate_queue(body: dict[str, Any]):
    """
    Verify that a queueArn exists in Amazon Connect and that its name matches
    the provided queueName.

    Returns { valid: true, connectQueueName, connectQueueArn } on success.
    Returns { valid: false, error } on mismatch or not-found — does NOT raise
    HTTP 4xx so the frontend can surface the message inline.

    Raises HTTP 502 only when the Connect API itself is unreachable.
    """
    queue_arn: str = (body.get("queueArn") or "").strip()
    queue_name: str = (body.get("queueName") or "").strip()

    if not queue_arn or not queue_name:
        raise HTTPException(status_code=400, detail="queueArn and queueName are required")

    try:
        queue = await asyncio.to_thread(describe_queue, queue_arn)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in _NOT_FOUND_CODES:
            return {"valid": False, "error": "Queue ARN not found in this Amazon Connect instance"}
        logger.error(f"Connect API error for {queue_arn}: {e}")
        raise HTTPException(status_code=502, detail=e.response["Error"]["Message"])
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    connect_name: str = queue.get("Name", "")
    connect_arn: str = queue.get("QueueArn", queue_arn)

    if connect_name.lower() != queue_name.lower():
        return {
            "valid": False,
            "error": f"Name mismatch — Amazon Connect has '{connect_name}', you entered '{queue_name}'",
        }

    return {"valid": True, "connectQueueName": connect_name, "connectQueueArn": connect_arn}
