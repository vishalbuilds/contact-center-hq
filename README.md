# contact-center-hq

## Run with Podman

> Specs: **2 vCPU · 512 MB RAM**

```powershell
# Stop and remove any existing container
podman stop contact-center-hq
podman rm contact-center-hq

# Build the image
podman build -t contact-center-hq .

# Run the container
podman run -d `
  --name contact-center-hq `
  --cpus 2.0 `
  --memory 512m `
  -p 8000:8000 `
  -v C:\Users\visiv\.aws:/home/appuser/.aws `
  -e AWS_REGION=us-east-1 `
  contact-center-hq
```

API is available at `http://localhost:8000`

---

## Load Testing (Locust)

Install Locust once:

```bash
pip install locust
```

Run the load test against the local container:

```bash
locust -f locustfile.py --host=http://localhost:8000
```

Then open `http://localhost:8089` in your browser to start the test and set the number of users / spawn rate.

**Endpoints exercised by the test:**

| Task | Weight | Endpoint |
|---|---|---|
| Search initial-config | 3 | `GET /api/v1/table/records/CCaaS-initial-config/search` |
| Get initial-config record | 3 | `GET /api/v1/table/records/CCaaS-initial-config/{dins}` |
| Search DID mapping | 2 | `GET /api/v1/table/records/CCaaS-user-did-mapping/search` |
| Get DID mapping record | 2 | `GET /api/v1/table/records/CCaaS-user-did-mapping/{DID}` |
| Get voicemail access | 1 | `GET /api/v1/table/records/CCaaS-voicemail-access/{mailBoxNumber}` |
| Search outbound mapping | 2 | `GET /api/v1/table/records/CCaaS-outbound-mapping/search` |
| Get outbound mapping record | 2 | `GET /api/v1/table/records/CCaaS-outbound-mapping/{QueueArn}` |
| HOO get queue schedule | 2 | `GET /api/v1/hoo/CCaaS-queue-schedule-config/records/{queueArn}` |
| HOO get schedule record | 1 | `GET /api/v1/hoo/CCaaS-queue-schedule-config/record/{queueArn}/{dayOfWeek}` |
| HOO get queue exceptions | 2 | `GET /api/v1/hoo/CCaaS-queue-exception-config/records/{queueArn}` |
| HOO get exception record | 1 | `GET /api/v1/hoo/CCaaS-queue-exception-config/record/{queueArn}/{exceptionDate}` |
| Health check | 1 | `GET /api/health` |

---

## Future Plans

### HOO — Amazon Connect Queue Verification
When creating or editing a HOO record, the `queueArn` + `queueName` combination is currently entered manually with no validation. A future improvement should add a **Verify** button that calls the Amazon Connect API (`DescribeQueue`) to confirm the `queueName` matches the provided `queueArn`. The **Create/Save** button should only become active once verification passes. This prevents mismatched ARN/name pairs from being stored and avoids the scenario where a scan returns multiple distinct ARNs for the same `queueName` (which is currently a silent data anomaly).

Steps:
1. Add a new backend endpoint `GET /api/v1/hoo/verify-queue?queue_arn=<arn>` that calls `connect.describe_queue(InstanceId, QueueId)` and returns the canonical queue name.
2. In HOOForm, when `queueArn` is entered/changed, show a "Verify" button next to the field.
3. On verify: call the endpoint, compare returned name to the `queueName` field, mark as verified (green badge) or failed (red).
4. Gate the Create/Save submit button behind `isVerified || formMode === "edit"` (skip re-verification on edits of already-stored records).
