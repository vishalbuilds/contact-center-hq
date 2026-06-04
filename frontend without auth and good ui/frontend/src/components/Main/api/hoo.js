const BASE = "/api/v1/hoo";

export async function searchQueues(tableName, queueName, pk, gsiKey) {
  const res = await fetch(
    `${BASE}/by-queue?${new URLSearchParams({ queue_name: queueName })}`,
    { headers: { "x-table": tableName, "x-pk": pk, "x-gsi-key": gsiKey } },
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return (await res.json()).items ?? [];
}

export async function getQueueRecords(tableName, queueArn, pk) {
  const res = await fetch(`${BASE}/records`, {
    headers: { "x-table": tableName, "x-pk": pk, "x-pk-value": queueArn },
  });
  if (!res.ok) throw new Error(`Failed to load records: ${res.status}`);
  return (await res.json()).items ?? [];
}

export async function createHooRecord(tableName, body, pkId, skId) {
  return fetch(`${BASE}/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pkId, "x-sk": skId ?? "" },
    body: JSON.stringify(body),
  });
}

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

// ── Batch API calls ──────────────────────────────────────────────────────────
// Each sends one HTTP request; backend processes all rows in parallel and
// returns a full report in a single response.

export async function batchGetHoo(tableName, pk, gsiKey, sk, queueNames) {
  const res = await fetch(`${BASE}/batch-get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-table": tableName,
      "x-pk": pk,
      "x-gsi-key": gsiKey,
      "x-sk": sk,
    },
    body: JSON.stringify({ queueNames }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `batch-get failed: ${res.status}`);
  return res.json();
}

export async function batchCreateHoo(tableName, pk, sk, rows) {
  const res = await fetch(`${BASE}/batch-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pk, "x-sk": sk },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `batch-create failed: ${res.status}`);
  return res.json();
}

export async function batchUpdateHoo(tableName, pk, sk, rows) {
  const res = await fetch(`${BASE}/batch-update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pk, "x-sk": sk },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `batch-update failed: ${res.status}`);
  return res.json();
}

export async function upsertHooRecord(tableName, pkId, skId, data, validateConnect = false) {
  return fetch(`${BASE}/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-table": tableName,
      "x-pk": pkId,
      "x-sk": skId,
      "x-validate-connect": validateConnect ? "true" : "false",
    },
    body: JSON.stringify(data),
  });
}

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
