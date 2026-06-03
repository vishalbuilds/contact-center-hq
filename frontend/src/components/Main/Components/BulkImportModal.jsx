import { useState } from "react";
import {
  buildHooGetTemplate, buildTableGetTemplate, parseGetCSV,
  buildHooTemplate, buildTableTemplate,
  parseHooCSV, parseTableCSV,
  hooRecordsToCSV, tableRecordsToCSV,
  failedRowsToCSV, downloadCSV,
} from "../utils/csvUtils.js";
import { batchGetHoo, batchCreateHoo, batchUpdateHoo } from "../api/hoo.js";
import { batchGetTable, batchCreateTable, batchUpdateTable } from "../api/table.js";

// ── Mode config ───────────────────────────────────────────────────────────────

const MODE_META = {
  get: {
    label: "Get Data",
    color: "blue",
    templateLabel: "GET Template  (queue names only)",
    uploadHint: "Upload a CSV with one queue/record name per row",
    submitLabel: (n) => `Fetch ${n} Queue${n !== 1 ? "s" : ""}`,
  },
  create: {
    label: "Bulk Create",
    color: "emerald",
    templateLabel: "Create Template  (all fields)",
    uploadHint: "Upload a CSV with all field values — fails if record already exists",
    submitLabel: (n) => `Create ${n} Record${n !== 1 ? "s" : ""}`,
  },
  update: {
    label: "Bulk Update",
    color: "amber",
    templateLabel: "Update Template  (all fields)",
    uploadHint: "Upload a CSV with all field values — fails if record doesn't exist",
    submitLabel: (n) => `Update ${n} Record${n !== 1 ? "s" : ""}`,
  },
};

const COLOR = {
  blue:    { pill: "bg-blue-100 text-blue-700",    btn: "bg-blue-600 hover:bg-blue-700"    },
  emerald: { pill: "bg-emerald-100 text-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700" },
  amber:   { pill: "bg-amber-100 text-amber-700",  btn: "bg-amber-600 hover:bg-amber-700"  },
};

const STATUS_STYLE = {
  ok:        "bg-emerald-50 text-emerald-700",
  created:   "bg-emerald-50 text-emerald-700",
  updated:   "bg-blue-50 text-blue-700",
  not_found: "bg-amber-50 text-amber-700",
  error:     "bg-red-50 text-red-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BulkImportModal({ hooConfig, tableConfig, initialMode, onClose }) {
  const isHoo = !!hooConfig;
  const config = hooConfig ?? tableConfig;

  // step: "mode" | "file" | "preview" | "loading" | "done"
  const [step, setStep] = useState(initialMode ? "file" : "mode");
  const [mode, setMode] = useState(initialMode ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);      // parsed CSV rows
  const [result, setResult] = useState(null); // batch response
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const meta = mode ? MODE_META[mode] : null;
  const colorKey = mode ? { get: "blue", create: "emerald", update: "amber" }[mode] : "blue";

  // ── Template download ─────────────────────────────────────────────────────

  const handleTemplateDownload = () => {
    let csv, name;
    if (mode === "get") {
      csv = isHoo ? buildHooGetTemplate() : buildTableGetTemplate(config);
      name = `${config.id}-get-template.csv`;
    } else {
      csv = isHoo ? buildHooTemplate(config) : buildTableTemplate(config);
      name = `${config.id}-${mode}-template.csv`;
    }
    downloadCSV(csv, name);
  };

  // ── File parsing ──────────────────────────────────────────────────────────

  const parseFile = (text, name) => {
    setFileName(name);
    setError("");
    setWarning("");
    let parsed;
    if (mode === "get") {
      parsed = parseGetCSV(text); // returns string[]
    } else {
      const result = isHoo ? parseHooCSV(text, hooConfig) : parseTableCSV(text, tableConfig);
      parsed = result.rows;
      if (result.droppedCount > 0) {
        setWarning(
          `${result.droppedCount} row${result.droppedCount !== 1 ? "s" : ""} skipped — missing primary key.`
        );
      }
    }
    if (parsed.length === 0) { setError("No valid rows found in file."); return; }
    setRows(parsed);
    setStep("preview");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseFile(ev.target.result, file.name);
    reader.readAsText(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseFile(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setStep("loading"); setError("");
    try {
      let data;
      if (isHoo) {
        if (mode === "get")    data = await batchGetHoo(hooConfig.tableName, hooConfig.partitionKey, hooConfig.GSIKey, hooConfig.sortKey, rows);
        if (mode === "create") data = await batchCreateHoo(hooConfig.tableName, hooConfig.partitionKey, hooConfig.sortKey, rows);
        if (mode === "update") data = await batchUpdateHoo(hooConfig.tableName, hooConfig.partitionKey, hooConfig.sortKey, rows);
      } else {
        if (mode === "get")    data = await batchGetTable(tableConfig.tableName, tableConfig.partitionKey, rows);
        if (mode === "create") data = await batchCreateTable(tableConfig.tableName, tableConfig.partitionKey, rows);
        if (mode === "update") data = await batchUpdateTable(tableConfig.tableName, tableConfig.partitionKey, rows);
      }
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err.message ?? "Request failed");
      setStep("preview");
    }
  };

  // ── Downloads ─────────────────────────────────────────────────────────────

  const downloadResults = () => {
    const csv = isHoo
      ? hooRecordsToCSV(result.records, hooConfig)
      : tableRecordsToCSV(result.records, tableConfig);
    downloadCSV(csv, `${config.id}-results.csv`);
  };

  const downloadFailures = () => {
    const csv = failedRowsToCSV(result.results, rows, isHoo, config);
    downloadCSV(csv, `${config.id}-failures.csv`);
  };

  const failed = result?.results?.filter((r) => r.status === "error") ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onClose} />
      <div id="bulk-import-modal" className="fixed inset-x-4 top-10 bottom-10 z-70 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col max-w-2xl mx-auto">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#c8b8c8]">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#3b1a3b]">Bulk Operations</h2>
            {mode && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR[colorKey].pill}`}>
                {meta.label}
              </span>
            )}
            {fileName && <span className="text-xs text-[#8b6b8b]">{fileName}</span>}
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b6b8b] hover:bg-[#e8d8e8] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step: mode selector ── */}
          {step === "mode" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#5b2d5b] font-medium mb-1">Choose an operation:</p>
              {Object.entries(MODE_META).map(([id, m]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMode(id); setStep("file"); }}
                  className="w-full text-left px-5 py-4 bg-white rounded-xl border border-[#d4c4d4] hover:border-rose-400 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <p className="font-semibold text-sm text-[#3b1a3b] group-hover:text-rose-800">{m.label}</p>
                  <p className="text-xs text-[#8b6b8b] mt-0.5">{m.uploadHint}</p>
                </button>
              ))}
            </div>
          )}

          {/* ── Step: file upload ── */}
          {step === "file" && meta && (
            <div>
              {/* Template download */}
              <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#d4c4d4] mb-4">
                <div>
                  <p className="text-xs font-semibold text-[#3b1a3b]">{meta.templateLabel}</p>
                  <p className="text-[10px] text-[#8b6b8b] mt-0.5">Download and fill in the template, then upload below</p>
                </div>
                <button type="button" onClick={handleTemplateDownload}
                  className="shrink-0 ml-4 px-3 py-1.5 text-xs font-semibold text-[#5b2d5b] bg-[#f5f0f5] border border-[#d4c4d4] rounded-lg hover:bg-[#e8d8e8] cursor-pointer">
                  Download
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  dragOver ? "border-rose-400 bg-rose-50" : "border-[#c8b8c8] bg-white/50"
                }`}
              >
                <svg className="mx-auto mb-3 text-[#c0b0c0]" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm text-[#5b2d5b] font-medium mb-1">Drag & drop your CSV here</p>
                <p className="text-xs text-[#8b6b8b] mb-4">{meta.uploadHint}</p>
                <label className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 cursor-pointer transition-colors">
                  Choose File
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileInput} />
                </label>
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* ── Step: preview ── */}
          {step === "preview" && (
            <div>
              <p className="text-sm font-medium text-[#3b1a3b] mb-3">
                {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
                {mode === "get" ? " — will fetch records for these names:" : " — ready to submit:"}
              </p>

              {mode === "get" ? (
                <ul className="max-h-60 overflow-y-auto flex flex-col gap-1 mb-4">
                  {rows.map((name, i) => (
                    <li key={i} className="px-3 py-1.5 bg-white rounded-lg border border-[#d4c4d4] text-sm text-[#3b1a3b] font-mono">
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#d4c4d4] bg-white mb-4 max-h-60">
                  <table className="text-xs text-[#3b1a3b] w-full">
                    <thead className="bg-[#f0e8f0] text-[#5b2d5b] uppercase tracking-wide sticky top-0">
                      <tr>
                        {Object.keys(rows[0] ?? {}).filter((k) => k !== "payload").map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-[#e8d8e8]">
                          {Object.keys(rows[0]).filter((k) => k !== "payload").map((h) => (
                            <td key={h} className="px-3 py-1.5 font-mono whitespace-nowrap max-w-32 truncate">
                              {String(row[h] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {rows.length > 10 && (
                        <tr className="border-t border-[#e8d8e8]">
                          <td colSpan={99} className="px-3 py-2 text-[#8b6b8b] text-center">
                            … and {rows.length - 10} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {warning && <p className="mt-2 text-sm text-amber-600">{warning}</p>}
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* ── Step: loading ── */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <svg className="animate-spin text-rose-700" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#3b1a3b]">Processing {rows.length} rows…</p>
                <p className="text-xs text-[#8b6b8b] mt-1">Backend is running all operations in parallel</p>
              </div>
            </div>
          )}

          {/* ── Step: done ── */}
          {step === "done" && result && (
            <div>
              {/* Summary banner */}
              <div className={`mb-4 px-4 py-3 rounded-xl border text-sm font-medium ${
                failed.length > 0
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}>
                {mode === "get" ? (
                  <>Fetched <strong>{result.summary.records_fetched ?? result.records?.length}</strong> records for <strong>{result.summary.found}</strong> of <strong>{result.summary.requested}</strong> queues.</>
                ) : (
                  <>
                    {result.summary.created > 0 && <><strong>{result.summary.created}</strong> created. </>}
                    {result.summary.updated > 0 && <><strong>{result.summary.updated}</strong> updated. </>}
                    {result.summary.failed > 0 && <><strong className="text-red-700">{result.summary.failed}</strong> failed.</>}
                  </>
                )}
              </div>

              {/* Per-row report */}
              <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
                {(mode === "get" ? result.report : result.results).map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${STATUS_STYLE[r.status] ?? "bg-[#f5f0f5] text-[#8b6b8b]"}`}>
                    <span>{r.status === "error" || r.status === "not_found" ? "✗" : "✓"}</span>
                    <span className="flex-1 font-medium truncate">
                      {r.queueName ?? r.pkValue ?? `Row ${r.rowIndex + 1}`}
                      {r.sortKey ? ` (${r.sortKey})` : ""}
                      {r.queueArn ? ` — ${r.queueArn}` : ""}
                    </span>
                    <span className="shrink-0 ml-2">{r.message || r.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-[#c8b8c8]">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
            {step === "done" ? "Close" : "Cancel"}
          </button>

          <div className="flex gap-2">
            {/* Back button when on file step and mode was not pre-set */}
            {step === "file" && !initialMode && (
              <button type="button" onClick={() => { setStep("mode"); setRows([]); setError(""); }}
                className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                ← Back
              </button>
            )}

            {/* Preview → re-upload */}
            {step === "preview" && (
              <button type="button" onClick={() => { setRows([]); setWarning(""); setStep("file"); }}
                className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                Change File
              </button>
            )}

            {/* Submit */}
            {step === "preview" && (
              <button type="button" onClick={handleSubmit}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-lg border active:scale-95 transition-all cursor-pointer ${COLOR[colorKey].btn} border-transparent`}>
                {meta.submitLabel(rows.length)}
              </button>
            )}

            {/* Done actions */}
            {step === "done" && mode === "get" && result?.records?.length > 0 && (
              <button type="button" onClick={downloadResults}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">
                Download Results CSV
              </button>
            )}
            {step === "done" && mode !== "get" && failed.length > 0 && (
              <button type="button" onClick={downloadFailures}
                className="px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 cursor-pointer">
                Download Failures ({failed.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
