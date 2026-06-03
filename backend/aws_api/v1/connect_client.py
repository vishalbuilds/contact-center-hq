"""
Amazon Connect client.

The boto3 client is created eagerly at module level (same pattern as DynamoDB
and SES in aws_clients.py).  The instance_id cannot be created eagerly because
it is environment-specific and lives in connect_config.yaml — it is loaded once
on first use, protected by a double-checked lock.

Queue-description results are cached for _CACHE_TTL seconds.  The cache is
protected by a lock so that concurrent requests for the same ARN only make one
Connect API call (stampede prevention) while requests for *different* ARNs
still run in parallel.
"""

import yaml
import os
import time
import logging
import threading
from pathlib import Path
from botocore.exceptions import ClientError

from aws_api.v1.aws_clients import connect_client as _client, CONNECT_CONFIG

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent.parent.parent / "connect_config.yaml"

# TTL for the in-process queue cache (seconds).
# Queue names/ARNs rarely change; 5 min avoids hammering the Connect API
# on bulk imports that reference the same ARNs repeatedly.
_CACHE_TTL = 300

# {queue_arn: (result_dict, expires_monotonic)}
_queue_cache: dict[str, tuple[dict, float]] = {}
# Serialises cache miss + API call for the *same* ARN; different ARNs run concurrently.
_cache_lock = threading.Lock()

# instance_id is loaded lazily — only the config read is deferred, not the client.
_instance_id: str | None = None
_instance_lock = threading.Lock()

# Tracks the region the Connect client was originally created with so we can
# detect when connect_config.yaml specifies a different region and re-create.
_client_region: str = os.getenv("AWS_REGION", "us-east-1")


def _get_instance_id() -> str:
    """Return the Connect instance ID for the current APP_ENV, loading config once."""
    global _instance_id, _client, _client_region
    if _instance_id is not None:
        return _instance_id
    with _instance_lock:
        if _instance_id is not None:  # double-check inside lock
            return _instance_id
        env = os.environ.get("APP_ENV", "dev")
        if not _CONFIG_PATH.exists():
            raise RuntimeError(f"connect_config.yaml not found at {_CONFIG_PATH}")
        with open(_CONFIG_PATH) as f:
            config = yaml.safe_load(f)
        if env not in config:
            raise RuntimeError(
                f"APP_ENV='{env}' has no section in connect_config.yaml. "
                f"Available: {list(config.keys())}"
            )
        section = config[env]
        cfg_region = section.get("region", _client_region)
        # Re-create the client only if the config file specifies a different region.
        if cfg_region != _client_region:
            import boto3
            _client = boto3.client("connect", region_name=cfg_region, config=CONNECT_CONFIG)
            _client_region = cfg_region
            logger.info(f"Amazon Connect client re-created for region={cfg_region}")
        _instance_id = section["instance_id"]
        logger.info(f"Amazon Connect instance_id loaded (env={env}, region={_client_region})")
    return _instance_id


def describe_queue(queue_arn: str) -> dict:
    """
    Call connect:DescribeQueue and return the Queue dict.

    Fast path (cache hit): no lock acquired.
    Slow path (cache miss): acquire _cache_lock so only one thread calls the
    Connect API for a given ARN at a time — prevents stampede on bulk imports
    that reference the same ARN in many rows.  Different ARNs are not blocked
    by each other's slow path.
    """
    now = time.monotonic()

    # Fast path — dict.get is atomic under the GIL; no lock needed for reads.
    cached = _queue_cache.get(queue_arn)
    if cached and now < cached[1]:
        logger.debug(f"connect cache hit: {queue_arn}")
        return cached[0]

    # Slow path — serialise per process (acceptable; Connect is low-traffic).
    with _cache_lock:
        # Re-check inside lock: another thread may have populated the cache
        # while we were waiting to acquire it.
        cached = _queue_cache.get(queue_arn)
        if cached and now < cached[1]:
            logger.debug(f"connect cache hit (inside lock): {queue_arn}")
            return cached[0]

        instance_id = _get_instance_id()
        response = _client.describe_queue(InstanceId=instance_id, QueueId=queue_arn)
        result = response["Queue"]
        _queue_cache[queue_arn] = (result, now + _CACHE_TTL)
        logger.info(f"DescribeQueue: {queue_arn} -> {result.get('Name')}")

    return result


def invalidate_cache(queue_arn: str | None = None) -> None:
    """Remove one ARN from the cache, or clear everything if ARN is None."""
    with _cache_lock:
        if queue_arn:
            _queue_cache.pop(queue_arn, None)
        else:
            _queue_cache.clear()
