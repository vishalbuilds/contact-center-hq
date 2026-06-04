function csvSafe(str) {
  const s = String(str ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function triggerDownload(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/*
  downloadCsvTemplate — builds and triggers a CSV download whose columns are
  driven entirely by the fields array from schema.json.

  mode — "create" (default) | "update"
         Determines the filename so users can distinguish the two templates.
         Content is the same (headers + sample defaults) for both modes.
*/
export function downloadCsvTemplate(config, mode = "create") {
  const { fields, tableName } = config;
  const headers = fields.map((f) => (f.isPayload ? `payload.${f.id}` : f.id));
  const sampleRow = fields.map((f) => csvSafe(f.defaultValue ?? ""));
  const csv = [headers.join(","), sampleRow.join(",")].join("\n");
  triggerDownload(csv, `${tableName}-${mode}-template.csv`);
}

/*
  downloadCsvExport — converts an array of DynamoDB record objects into a CSV
  and triggers a download.  Column order matches the schema fields so the
  exported file can be used directly as an update template.
*/
export function downloadCsvExport(items, config) {
  const { fields, tableName } = config;
  const headers = fields.map((f) => (f.isPayload ? `payload.${f.id}` : f.id));

  const rows = items.map((record) =>
    fields
      .map((f) => {
        const val = f.isPayload
          ? (record.payload?.[f.id] ?? "")
          : (record[f.id] ?? "");
        return csvSafe(val);
      })
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  triggerDownload(csv, `${tableName}-export.csv`);
}
