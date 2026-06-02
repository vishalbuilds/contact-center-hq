/*
  api/hoo.js — all network calls for Hours of Operation (HOO) data.

  Every function talks to the FastAPI backend at /api/v1/hoo/...
  All parameters (table name, key names, key values) are sent as HTTP
  headers so that values containing special characters (slashes, colons,
  ARNs, etc.) never interfere with URL routing.

  HEADERS USED
  ────────────
  x-table     →  DynamoDB table name            (e.g. "CCaaS-queue-schedule-config")
  x-pk        →  partition key column name      (e.g. "queueArn")
  x-pk-value  →  partition key value            (e.g. the queue ARN string)
  x-sk        →  sort key column name           (e.g. "dayOfWeek")
  x-sk-value  →  sort key value                 (e.g. "Monday", "06/25/2025")
  x-gsi-key   →  GSI key column name            (e.g. "queueName")

  HOW THE DATA IS STRUCTURED
  ──────────────────────────
  Each HOO record in DynamoDB looks like:
    {
      queueArn:  "arn:aws:connect:...",   ← partition key
      dayOfWeek: "Monday",                ← sort key
      queueName: "Support Queue",         ← GSI key
      payload: {                          ← nested object for all other fields
        startTime: "09:00",
        endTime:   "17:00",
        timezone:  "America/New_York",
        vmMenu:    false,
        offerVm:   false,
      }
    }
*/

const BASE = "/api/v1/hoo";

/*
  searchQueues — finds queues whose name matches a search string.

  Hits GET /api/v1/hoo/by-queue?queue_name=<searchTerm>
  Returns an array of { queueArn, queueName } objects, or [] on failure.
*/
export async function searchQueues(tableName, queueName, pk, gsiKey) {
  const res = await fetch(
    `${BASE}/by-queue?${new URLSearchParams({ queue_name: queueName })}`,
    { headers: { "x-table": tableName, "x-pk": pk, "x-gsi-key": gsiKey } },
  );
  if (!res.ok) return [];
  return (await res.json()).items ?? [];
}

/*
  getQueueRecords — loads all HOO records for one specific queue.

  Hits GET /api/v1/hoo/records
  Returns an array of full record objects, or [] on failure.
*/
export async function getQueueRecords(tableName, queueArn, pk) {
  const res = await fetch(`${BASE}/records`, {
    headers: { "x-table": tableName, "x-pk": pk, "x-pk-value": queueArn },
  });
  if (!res.ok) return [];
  return (await res.json()).items ?? [];
}

/*
  createHooRecord — saves a brand-new HOO record to DynamoDB.

  Hits POST /api/v1/hoo/record with the full record as JSON body.
  Returns the raw fetch Response so the caller can check res.status.
*/
export async function createHooRecord(tableName, body, pkId, skId) {
  return fetch(`${BASE}/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pkId, "x-sk": skId ?? "" },
    body: JSON.stringify(body),
  });
}

/*
  updateHooRecord — overwrites an existing HOO record in DynamoDB.

  Hits PUT /api/v1/hoo/record with the updated record as the JSON body.
  Returns the raw fetch Response.
*/
export async function updateHooRecord(tableName, pkVal, skVal, body, pkId, skId) {
  return fetch(`${BASE}/record`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-table": tableName,
      "x-pk": pkId,
      "x-pk-value": pkVal,
      "x-sk": skId ?? "",
      "x-sk-value": skVal ?? "",
    },
    body: JSON.stringify(body),
  });
}

/*
  deleteHooRecord — permanently removes a HOO record from DynamoDB.

  Hits DELETE /api/v1/hoo/record
  Throws an Error if the server returns a non-OK status.
*/
export async function deleteHooRecord(tableName, queueArn, sortValue, pkId, skId) {
  const res = await fetch(`${BASE}/record`, {
    method: "DELETE",
    headers: {
      "x-table": tableName,
      "x-pk": pkId,
      "x-pk-value": queueArn,
      "x-sk": skId,
      "x-sk-value": sortValue,
    },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
