const BASE = "/api/v1/table";

export async function fetchTableRecord(tableName, pkId, pkValue) {
  const res = await fetch(`${BASE}/records`, {
    headers: { "x-table": tableName, "x-pk": pkId, "x-pk-value": pkValue },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function searchTableRecords(tableName, pkId, searchValue) {
  const res = await fetch(`${BASE}/records/search`, {
    headers: { "x-table": tableName, "x-pk": pkId, "x-pk-value": searchValue },
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

export async function createTableRecord(tableName, pkId, body) {
  return fetch(`${BASE}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pkId },
    body: JSON.stringify(body),
  });
}

export async function updateTableRecord(tableName, pkId, pkVal, body) {
  return fetch(`${BASE}/records`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pkId },
    body: JSON.stringify(body),
  });
}

// ── Batch API calls ──────────────────────────────────────────────────────────

export async function batchGetTable(tableName, pk, pkValues) {
  const res = await fetch(`${BASE}/records/batch-get`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pk },
    body: JSON.stringify({ pkValues }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `batch-get failed: ${res.status}`);
  return res.json();
}

export async function batchCreateTable(tableName, pk, rows) {
  const res = await fetch(`${BASE}/records/batch-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pk },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `batch-create failed: ${res.status}`);
  return res.json();
}

export async function batchUpdateTable(tableName, pk, rows) {
  const res = await fetch(`${BASE}/records/batch-update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pk },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `batch-update failed: ${res.status}`);
  return res.json();
}

export async function upsertTableRecord(tableName, pkId, data) {
  return fetch(`${BASE}/records/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-table": tableName,
      "x-pk": pkId,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteTableRecord(tableName, pkId, pkValue) {
  const res = await fetch(`${BASE}/records`, {
    method: "DELETE",
    headers: { "x-table": tableName, "x-pk": pkId, "x-pk-value": pkValue },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
