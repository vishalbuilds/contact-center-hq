import logging
import os
from datetime import datetime, timezone
from botocore.exceptions import ClientError

from aws_api.v1.aws_clients import ses_client as _client

logger = logging.getLogger(__name__)


def send_hoo_alert(
    action: str,
    queue_name: str,
    queue_arn: str,
    sort_key_name: str,
    sort_key_value: str,
    changed_fields: list[str] | None = None,
) -> None:
    """
    Send an SES email alert after an HOO mutation.

    Designed to be called via FastAPI BackgroundTasks so it never blocks the
    API response. Silently skips (logs a debug line) when SES env vars are not
    configured — this lets the app run locally without SES set up.
    """
    sender = os.environ.get("SES_SENDER_EMAIL", "").strip()
    recipients_raw = os.environ.get("ALERT_RECIPIENTS", "").strip()

    if not sender or not recipients_raw:
        logger.debug("HOO alert skipped — SES_SENDER_EMAIL or ALERT_RECIPIENTS not configured")
        return

    recipients = [r.strip() for r in recipients_raw.split(",") if r.strip()]
    if not recipients:
        return

    display = queue_name or queue_arn
    subject = f"[HOO Alert] {display} — {sort_key_value} {action}"
    body = _build_body(action, queue_name, queue_arn, sort_key_name, sort_key_value, changed_fields)

    try:
        _client.send_email(
            Source=sender,
            Destination={"ToAddresses": recipients},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
            },
        )
        logger.info(f"HOO alert sent: {action} — {display} / {sort_key_value}")
    except ClientError as e:
        logger.error(f"SES send_email failed: {e.response['Error']['Message']}")
    except Exception as e:
        # Catch network errors, mis-configured endpoints, etc.
        # Never propagate — a failed alert must not break the main operation.
        logger.error(f"SES send_email unexpected error: {e}")


def _build_body(
    action: str,
    queue_name: str,
    queue_arn: str,
    sort_key_name: str,
    sort_key_value: str,
    changed_fields: list[str] | None,
) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"HOO Record {action.upper()}",
        "=" * 44,
        f"Queue:          {queue_name or '(unknown)'}",
        f"Queue ARN:      {queue_arn}",
        f"{sort_key_name:<16}{sort_key_value}",
        f"Action:         {action}",
        f"Timestamp:      {ts}",
    ]
    if changed_fields:
        lines += ["", "Fields affected:"]
        lines += [f"  • {f}" for f in changed_fields]
    lines += ["", "—", "Contact Center HQ automated alert"]
    return "\n".join(lines)
