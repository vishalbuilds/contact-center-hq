"""
Centralized boto3 client / resource singletons.

All three AWS services used by this app are created here at module-import time.
Module-level initialization is thread-safe under Python's import lock — no
additional locking is needed.

Pool sizes are proportional to expected traffic:
  DynamoDB   → every read/write goes here           → 50 connections
  Connect    → queue validation only (cached)       → 10 connections
  SES        → background alert emails only          →  5 connections

The Connect *client* is created eagerly (same region as the other services).
The Connect *instance_id* is loaded lazily from connect_config.yaml because
it is environment-specific and must survive local runs without the file.
"""

import boto3
import os
from botocore.config import Config

_REGION = os.getenv("AWS_REGION", "us-east-1")

# ── Shared retry policies ─────────────────────────────────────────────────────
# adaptive: automatically backs off on throttling / transient errors
# standard: simpler linear back-off, fine for low-frequency callers
_RETRY_ADAPTIVE = {"max_attempts": 3, "mode": "adaptive"}
_RETRY_STANDARD = {"max_attempts": 2, "mode": "standard"}

_COMMON = {"connect_timeout": 5, "read_timeout": 10}

# ── DynamoDB ──────────────────────────────────────────────────────────────────
DYNAMO_CONFIG = Config(
    max_pool_connections=50,
    retries=_RETRY_ADAPTIVE,
    **_COMMON,
)

# boto3 resource wraps the low-level client; the underlying connection pool is
# shared across all Table instances created from this resource.
dynamo_resource = boto3.resource("dynamodb", region_name=_REGION, config=DYNAMO_CONFIG)

# ── SES ───────────────────────────────────────────────────────────────────────
SES_CONFIG = Config(
    max_pool_connections=5,
    retries=_RETRY_STANDARD,
    **_COMMON,
)

ses_client = boto3.client("ses", region_name=_REGION, config=SES_CONFIG)

# ── Amazon Connect ────────────────────────────────────────────────────────────
CONNECT_CONFIG = Config(
    max_pool_connections=10,
    retries=_RETRY_ADAPTIVE,
    **_COMMON,
)

# Region used here matches AWS_REGION.  If connect_config.yaml specifies a
# different region for an environment, connect_client.py re-creates the client
# with the config-file region the first time describe_queue is called.
connect_client = boto3.client("connect", region_name=_REGION, config=CONNECT_CONFIG)
