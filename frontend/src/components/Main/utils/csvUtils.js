import { localToEST } from "../../../utils/timezone.js";

function parseLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (line[i] === "," && !inQ) {
      out.push(cur); cur = "";
    } else {
      cur += line[i];
    }
  }
  out.push(cur);
  return out;
}

function escapeCell(val) {
  const s = val === null || val === undefined ? "" : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function coerce(val, type, isHoo = false) {
  if (val === "" || val == null) return val;
  if (type === "boolean") return val.toLowerCase() === "true";
  if (type === "integer") { const n = parseInt(val, 10); return Number.isNaN(n) ? val : n; }
  if (type === "time" && isHoo) return localToEST(val);
  return val;
}

// ── HOO ──────────────────────────────────────────────────────────────────────

function hooHeaders(hooConfig) {
  const { partitionKey: pk, sortKey: sk, GSIKey: gsi } = hooConfig;
  const heads = [gsi, pk, sk];
  hooConfig.fields?.forEach((f) => {
    if ([pk, sk, gsi].includes(f.id) || f.hidden) return;
    heads.push(f.isPayload ? `payload.${f.id}` : f.id);
  });
  return heads;
}

export function buildHooTemplate(hooConfig) {
  return hooHeaders(hooConfig).join(",");
}

export function parseHooCSV(csvText, hooConfig) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], droppedCount: 0 };
  const headers = parseLine(lines[0]);
  const pk = hooConfig.partitionKey;
  const typeMap = {};
  hooConfig.fields?.forEach((f) => {
    typeMap[f.id] = f.type;
    if (f.isPayload) typeMap[`payload.${f.id}`] = f.type;
  });
  const all = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const rec = {};
    headers.forEach((h, i) => {
      const raw = vals[i] ?? "";
      const coerced = coerce(raw, typeMap[h] ?? "string", true);
      if (h.startsWith("payload.")) {
        if (!rec.payload) rec.payload = {};
        rec.payload[h.slice(8)] = coerced;
      } else {
        rec[h] = coerced;
      }
    });
    return rec;
  });
  const rows = all.filter((r) => r[pk] != null && r[pk] !== "");
  return { rows, droppedCount: all.length - rows.length };
}

export function hooRecordsToCSV(records, hooConfig) {
  const headers = hooHeaders(hooConfig);
  const rows = records.map((r) =>
    headers.map((h) => escapeCell(h.startsWith("payload.") ? r.payload?.[h.slice(8)] : r[h])).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

// ── Table ─────────────────────────────────────────────────────────────────────

function tableHeaders(tableConfig) {
  return tableConfig.fields?.map((f) => f.id) ?? [];
}

export function buildTableTemplate(tableConfig) {
  return tableHeaders(tableConfig).join(",");
}

export function parseTableCSV(csvText, tableConfig) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], droppedCount: 0 };
  const headers = parseLine(lines[0]);
  const pk = tableConfig.partitionKey;
  const typeMap = {};
  tableConfig.fields?.forEach((f) => { typeMap[f.id] = f.type; });
  const all = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const rec = {};
    headers.forEach((h, i) => { rec[h] = coerce(vals[i] ?? "", typeMap[h] ?? "string"); });
    return rec;
  });
  const rows = all.filter((r) => r[pk] != null && r[pk] !== "");
  return { rows, droppedCount: all.length - rows.length };
}

export function tableRecordsToCSV(records, tableConfig) {
  const headers = tableHeaders(tableConfig);
  const rows = records.map((r) => headers.map((h) => escapeCell(r[h])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

// ── GET templates (single-column: just the lookup key) ───────────────────────

export function buildHooGetTemplate(hooConfig) { return hooConfig.GSIKey; }

export function buildTableGetTemplate(tableConfig) { return tableConfig.partitionKey; }

export function parseGetCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map((l) => parseLine(l.trim())[0] ?? "").filter(Boolean);
}

// ── Failures-only re-export ───────────────────────────────────────────────────

export function failedRowsToCSV(results, originalRows, isHoo, config) {
  const failedIndices = results
    .filter((r) => r.status === "error" && r.rowIndex != null)
    .map((r) => r.rowIndex);
  const failedRows = failedIndices.map((i) => originalRows[i]).filter(Boolean);
  const template = isHoo ? buildHooTemplate(config) : buildTableTemplate(config);
  const headers = template.split(",");
  const lines = [template];
  failedRows.forEach((row) => {
    lines.push(
      headers.map((h) => escapeCell(h.startsWith("payload.") ? row.payload?.[h.slice(8)] : row[h])).join(",")
    );
  });
  return lines.join("\n");
}

// ── Download helper ───────────────────────────────────────────────────────────

export function downloadCSV(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
