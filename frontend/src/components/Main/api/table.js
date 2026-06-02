/*
  api/table.js — all network calls for generic DynamoDB table records.

  Every function talks to the FastAPI backend at /api/v1/table/...
  All parameters (table name, key names, key values) are sent as HTTP
  headers so that values containing special characters (slashes, colons,
  ARNs, etc.) never interfere with URL routing.

  HEADERS USED
  ────────────
  x-table     →  DynamoDB table name       (e.g. "CCaaS-initial-config")
  x-pk        →  partition key column name (e.g. "dins", "DID", "agentArn")
  x-pk-value  →  partition key value       (e.g. "+15551234567", an ARN)

  HOW THE DATA IS STRUCTURED
  ──────────────────────────
  A typical DynamoDB record looks like:
    {
      dins:    "+15551234567",   ← partition key (top-level)
      login:   "jsmith",
      lob:     "Agent",
      payload: {                 ← nested object for fields marked isPayload in schema
        customField1: "...",
      }
    }
  Fields with "isPayload": true in schema.json go inside the nested payload
  object; all others are top-level DynamoDB attributes.
*/

const BASE = "/api/v1/table";

/*
  fetchTableRecord — loads a single record by its exact primary key value.

  Hits GET /api/v1/table/records
  Returns the record object on success, or null on any failure.
*/
export async function fetchTableRecord(tableName, pkId, pkValue) {
  const res = await fetch(`${BASE}/records`, {
    headers: { "x-table": tableName, "x-pk": pkId, "x-pk-value": pkValue },
  });
  if (!res.ok) return null;
  return res.json();
}

/*
  searchTableRecords — finds records whose primary key contains the search string.

  Hits GET /api/v1/table/records/search
  Returns an array of pk value strings, or throws on failure.
*/
export async function searchTableRecords(tableName, pkId, searchValue) {
  const res = await fetch(`${BASE}/records/search`, {
    headers: { "x-table": tableName, "x-pk": pkId, "x-pk-value": searchValue },
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

/*
  createTableRecord — saves a brand-new record to DynamoDB.

  Hits POST /api/v1/table/records with the full record as JSON body.
  Returns the raw fetch Response so the caller can check res.status.
*/
export async function createTableRecord(tableName, pkId, body) {
  return fetch(`${BASE}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pkId },
    body: JSON.stringify(body),
  });
}

/*
  updateTableRecord — overwrites an existing record in DynamoDB.

  Hits PUT /api/v1/table/records with the updated record as JSON body.
  Returns the raw fetch Response.
*/
export async function updateTableRecord(tableName, pkId, pkVal, body) {
  return fetch(`${BASE}/records`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-table": tableName, "x-pk": pkId },
    body: JSON.stringify(body),
  });
}

/*
  deleteTableRecord — permanently removes a record from DynamoDB.

  Hits DELETE /api/v1/table/records
  Throws an Error on failure.
*/
export async function deleteTableRecord(tableName, pkId, pkValue) {
  const res = await fetch(`${BASE}/records`, {
    method: "DELETE",
    headers: { "x-table": tableName, "x-pk": pkId, "x-pk-value": pkValue },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
