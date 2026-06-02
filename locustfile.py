from locust import HttpUser, task, between

# ── Sample data from DynamoDB ───────────────────────���──────────────────────
SAMPLE_DID_INITIAL_CONFIG   = "+15551234567"     # dins  — pk for CCaaS-initial-config
SAMPLE_USER_DID_MAPPING     = "+12345667788"     # DID   — pk for CCaaS-user-did-mapping
SAMPLE_VOICEMAIL_ACCESS     = "85545464455"      # mailBoxNumber — pk for CCaaS-voicemail-access
SAMPLE_QUEUE_ARN_SCHEDULE   = "arn-1"            # queueArn — pk for CCaaS-queue-schedule-config
SAMPLE_DAY_OF_WEEK_SCHEDULE = "Monday"           # dayOfWeek — sk for CCaaS-queue-schedule-config
SAMPLE_QUEUE_ARN_EXCEPTION  = "arn-2"            # queueArn — pk for CCaaS-queue-exception-config
SAMPLE_DATE_EXCEPTION       = "07/05/2026"       # exceptionDate — sk for CCaaS-queue-exception-config
SAMPLE_QUEUE_ARN_OUTBOUND   = "bkbjh"            # QueueArn — pk for CCaaS-outbound-mapping
# ───────────────────────────────────────────────────��───────────────────────


class ContactCenterUser(HttpUser):
    wait_time = between(1, 3)

    # ── Initial Config ──────────────────────────────────────────────────────

    @task(3)
    def search_initial_config(self):
        self.client.get(
            "/api/v1/table/records/search",
            headers={"x-table": "CCaaS-initial-config", "x-pk": "dins", "x-pk-value": SAMPLE_DID_INITIAL_CONFIG[:4]},
            name="Search initial-config",
        )

    @task(3)
    def get_initial_config(self):
        self.client.get(
            "/api/v1/table/records",
            headers={"x-table": "CCaaS-initial-config", "x-pk": "dins", "x-pk-value": SAMPLE_DID_INITIAL_CONFIG},
            name="Get initial-config record",
        )

    # ── User DID Mapping ────────────────────────────────────────────────────

    @task(2)
    def search_did_mapping(self):
        self.client.get(
            "/api/v1/table/records/search",
            headers={"x-table": "CCaaS-user-did-mapping", "x-pk": "DID", "x-pk-value": SAMPLE_USER_DID_MAPPING[:4]},
            name="Search DID mapping",
        )

    @task(2)
    def get_did_mapping(self):
        self.client.get(
            "/api/v1/table/records",
            headers={"x-table": "CCaaS-user-did-mapping", "x-pk": "DID", "x-pk-value": SAMPLE_USER_DID_MAPPING},
            name="Get DID mapping record",
        )

    # ── Voicemail Access ────────────────────────────────────────────────────

    @task(1)
    def get_voicemail_access(self):
        self.client.get(
            "/api/v1/table/records",
            headers={"x-table": "CCaaS-voicemail-access", "x-pk": "mailBoxNumber", "x-pk-value": SAMPLE_VOICEMAIL_ACCESS},
            name="Get voicemail access",
        )

    # ── Outbound Mapping ────────────────────────────────────────────────────

    @task(2)
    def search_outbound_mapping(self):
        self.client.get(
            "/api/v1/table/records/search",
            headers={"x-table": "CCaaS-outbound-mapping", "x-pk": "QueueArn", "x-pk-value": SAMPLE_QUEUE_ARN_OUTBOUND[:6]},
            name="Search outbound mapping",
        )

    @task(2)
    def get_outbound_mapping(self):
        self.client.get(
            "/api/v1/table/records",
            headers={"x-table": "CCaaS-outbound-mapping", "x-pk": "QueueArn", "x-pk-value": SAMPLE_QUEUE_ARN_OUTBOUND},
            name="Get outbound mapping record",
        )

    # ── HOO Schedule ────────────────────────────────────────────────────────

    @task(2)
    def get_queue_schedule(self):
        self.client.get(
            "/api/v1/hoo/records",
            headers={"x-table": "CCaaS-queue-schedule-config", "x-pk": "queueArn", "x-pk-value": SAMPLE_QUEUE_ARN_SCHEDULE},
            name="HOO get queue schedule",
        )

    @task(1)
    def get_schedule_record(self):
        self.client.get(
            "/api/v1/hoo/record",
            headers={
                "x-table": "CCaaS-queue-schedule-config",
                "x-pk": "queueArn", "x-pk-value": SAMPLE_QUEUE_ARN_SCHEDULE,
                "x-sk": "dayOfWeek", "x-sk-value": SAMPLE_DAY_OF_WEEK_SCHEDULE,
            },
            name="HOO get schedule record",
        )

    # ── HOO Exceptions ──────────────────────────────────────────────────────

    @task(2)
    def get_queue_exceptions(self):
        self.client.get(
            "/api/v1/hoo/records",
            headers={"x-table": "CCaaS-queue-exception-config", "x-pk": "queueArn", "x-pk-value": SAMPLE_QUEUE_ARN_EXCEPTION},
            name="HOO get queue exceptions",
        )

    @task(1)
    def get_exception_record(self):
        self.client.get(
            "/api/v1/hoo/record",
            headers={
                "x-table": "CCaaS-queue-exception-config",
                "x-pk": "queueArn", "x-pk-value": SAMPLE_QUEUE_ARN_EXCEPTION,
                "x-sk": "exceptionDate", "x-sk-value": SAMPLE_DATE_EXCEPTION,
            },
            name="HOO get exception record",
        )

    # ── Health ───────────────────────────────────────────────────────────────

    @task(1)
    def health_check(self):
        self.client.get("/api/health", name="Health check")
