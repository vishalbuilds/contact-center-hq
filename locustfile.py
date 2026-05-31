from locust import HttpUser, task, between
from urllib.parse import quote

def enc(value):
    return quote(str(value), safe="")

# ── Sample data from DynamoDB ──────────────────────────────────────────────
SAMPLE_DID_INITIAL_CONFIG   = "+15551234567"     # dins  — pk for CCaaS-initial-config
SAMPLE_USER_DID_MAPPING     = "+12345667788"     # DID   — pk for CCaaS-user-did-mapping
SAMPLE_VOICEMAIL_ACCESS     = "85545464455"      # mailBoxNumber — pk for CCaaS-voicemail-access
SAMPLE_QUEUE_ARN_SCHEDULE   = "arn-1"            # queueArn — pk for CCaaS-queue-schedule-config
SAMPLE_DAY_OF_WEEK_SCHEDULE = "Monday"           # dayOfWeek — sk for CCaaS-queue-schedule-config
SAMPLE_QUEUE_ARN_EXCEPTION  = "arn-2"            # queueArn — pk for CCaaS-queue-exception-config
SAMPLE_DATE_EXCEPTION       = "07/05/2026"       # exceptionDate — sk for CCaaS-queue-exception-config
SAMPLE_QUEUE_ARN_OUTBOUND   = "bkbjh"   # QueueArn — pk for CCaaS-outbound-mapping
# ───────────────────────────────────────────────────────────────────────────


class ContactCenterUser(HttpUser):
    wait_time = between(1, 3)

    # ── Initial Config ──────────────────────────────────────────────────────

    @task(3)
    def search_initial_config(self):
        self.client.get(
            "/api/v1/table/records/CCaaS-initial-config/search",
            headers={"x-pk": "dins", "x-pk-value": SAMPLE_DID_INITIAL_CONFIG[:4]},
            name="Search initial-config",
        )

    @task(3)
    def get_initial_config(self):
        self.client.get(
            f"/api/v1/table/records/CCaaS-initial-config/{SAMPLE_DID_INITIAL_CONFIG}",
            headers={"x-pk": "dins"},
            name="Get initial-config record",
        )

    # ── User DID Mapping ────────────────────────────────────────────────────

    @task(2)
    def search_did_mapping(self):
        self.client.get(
            "/api/v1/table/records/CCaaS-user-did-mapping/search",
            headers={"x-pk": "DID", "x-pk-value": SAMPLE_USER_DID_MAPPING[:4]},
            name="Search DID mapping",
        )

    @task(2)
    def get_did_mapping(self):
        self.client.get(
            f"/api/v1/table/records/CCaaS-user-did-mapping/{SAMPLE_USER_DID_MAPPING}",
            headers={"x-pk": "DID"},
            name="Get DID mapping record",
        )

    # ── Voicemail Access ────────────────────────────────────────────────────

    @task(1)
    def get_voicemail_access(self):
        self.client.get(
            f"/api/v1/table/records/CCaaS-voicemail-access/{SAMPLE_VOICEMAIL_ACCESS}",
            headers={"x-pk": "mailBoxNumber"},
            name="Get voicemail access",
        )

    # ── Outbound Mapping ────────────────────────────────────────────────────

    @task(2)
    def search_outbound_mapping(self):
        self.client.get(
            "/api/v1/table/records/CCaaS-outbound-mapping/search",
            headers={"x-pk": "QueueArn", "x-pk-value": SAMPLE_QUEUE_ARN_OUTBOUND[:6]},
            name="Search outbound mapping",
        )

    @task(2)
    def get_outbound_mapping(self):
        self.client.get(
            f"/api/v1/table/records/CCaaS-outbound-mapping/{enc(SAMPLE_QUEUE_ARN_OUTBOUND)}",
            headers={"x-pk": "QueueArn"},
            name="Get outbound mapping record",
        )

    # ── HOO Schedule ────────────────────────────────────────────────────────

    @task(2)
    def get_queue_schedule(self):
        self.client.get(
            f"/api/v1/hoo/CCaaS-queue-schedule-config/records/{enc(SAMPLE_QUEUE_ARN_SCHEDULE)}",
            headers={"x-pk": "queueArn"},
            name="HOO get queue schedule",
        )

    @task(1)
    def get_schedule_record(self):
        self.client.get(
            f"/api/v1/hoo/CCaaS-queue-schedule-config/record/{enc(SAMPLE_QUEUE_ARN_SCHEDULE)}/{SAMPLE_DAY_OF_WEEK_SCHEDULE}",
            headers={"x-pk": "queueArn", "x-sk": "dayOfWeek"},
            name="HOO get schedule record",
        )

    # ── HOO Exceptions ──────────────────────────────────────────────────────

    @task(2)
    def get_queue_exceptions(self):
        self.client.get(
            f"/api/v1/hoo/CCaaS-queue-exception-config/records/{enc(SAMPLE_QUEUE_ARN_EXCEPTION)}",
            headers={"x-pk": "queueArn"},
            name="HOO get queue exceptions",
        )

    @task(1)
    def get_exception_record(self):
        self.client.get(
            f"/api/v1/hoo/CCaaS-queue-exception-config/record/{enc(SAMPLE_QUEUE_ARN_EXCEPTION)}/{SAMPLE_DATE_EXCEPTION}",
            headers={"x-pk": "queueArn", "x-sk": "exceptionDate"},
            name="HOO get exception record",
        )

    # ── Health ───────────────────────────────────────────────────────────────

    @task(1)
    def health_check(self):
        self.client.get("/api/health", name="Health check")
