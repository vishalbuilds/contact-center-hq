import { localToEST } from "./timezone.js";

/*
  csvParse.js — parses a CSV file into API-ready record bodies using the
  field definitions from schema.json as the single source of truth.

  FLOW
  ────
  1. Split text into rows; first row = headers (must match field IDs)
  2. For each data row build a typed, validated value map
  3. Assemble into a DynamoDB body (top-level fields + optional payload object)
  4. Return { validRows, invalidRows, totalRows, unknownHeaders }

  TYPE COERCION (mirrors form behaviour)
  ──────────────────────────────────────
  boolean → "true"/"1"/"yes" → true, anything else → false
  integer → parseInt
  time    → converted local → EST when isHoo=true (same as HOOForm submit)
  all others → string as-is
*/

/* Parse one CSV line respecting double-quoted fields containing commas */
function parseRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/*
  parseCsvForConfig — main export.

  config  — full schema config object (fields, partitionKey, sortKey, tableName)
  csvText — raw text content of the uploaded file
  isHoo   — true for HOO tables so time fields get local→EST conversion

  Returns:
    validRows      — array of body objects ready to pass to the create API
    invalidRows    — [{ rowNum, errors: [string] }] for rows that failed validation
    totalRows      — total data rows found (excluding header)
    unknownHeaders — CSV headers that don't match any schema field ID
*/
export function parseCsvForConfig(csvText, config, isHoo = false) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { validRows: [], invalidRows: [], totalRows: 0, unknownHeaders: [] };
  }

  const rawHeaders = parseRow(lines[0]);

  /* Strip "payload." prefix so both "startTime" and "payload.startTime" resolve
     to the same field. The prefix is written by the template download so the user
     can see which attributes live inside the DynamoDB payload object. */
  const headers = rawHeaders.map((h) =>
    h.startsWith("payload.") ? h.slice("payload.".length) : h,
  );

  const fieldMap = Object.fromEntries(config.fields.map((f) => [f.id, f]));

  /* Report headers that don't match any known field ID (after prefix strip) */
  const unknownHeaders = rawHeaders.filter((h) => {
    const id = h.startsWith("payload.") ? h.slice("payload.".length) : h;
    return h && !fieldMap[id];
  });

  const validRows = [];
  const invalidRows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const raw = Object.fromEntries(
      headers.map((h, idx) => [h, values[idx] ?? ""]),
    );
    const errors = [];

    /* Validate required fields — raw is keyed by stripped field IDs */
    config.fields.forEach((f) => {
      if (f.required && (raw[f.id] ?? "").toString().trim() === "") {
        errors.push(`"${f.title ?? f.id}" is required`);
      }
    });

    if (errors.length > 0) {
      invalidRows.push({ rowNum: i + 1, errors });
      continue;
    }

    /* Build body with type coercion */
    const body = {};
    const payloadObj = {};

    config.fields.forEach((f) => {
      let v = raw[f.id];
      if (v === undefined || v === "") return;

      if (f.type === "boolean") {
        v = v === "true" || v === "1" || v === "yes";
      } else if (f.type === "integer") {
        const n = parseInt(v, 10);
        v = isNaN(n) ? v : n;
      } else if (f.type === "time" && isHoo) {
        v = localToEST(v);
      }

      if (f.isPayload) payloadObj[f.id] = v;
      else body[f.id] = v;
    });

    if (Object.keys(payloadObj).length > 0) body.payload = payloadObj;
    validRows.push(body);
  }

  return {
    validRows,
    invalidRows,
    totalRows: lines.length - 1,
    unknownHeaders,
  };
}
