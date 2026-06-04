import { useRef, useState } from "react";
import { parseCsvForConfig } from "../../utils/csvParse.js";
import {
  createTableRecord,
  updateTableRecord,
  exportTableRecords,
} from "./api/table.js";
import {
  createHooRecord,
  updateHooRecord,
  exportHooRecords,
} from "./api/hoo.js";
import { downloadCsvTemplate, downloadCsvExport } from "./csvTemplate.js";
import { useUser } from "../../context/UserContext.jsx";

/*
  BulkMenu — "Bulk" button that opens a modal showing three operations as
  styled action cards:
    Get    → exports all current records as CSV       (viewers + admins)
    Update → bulk-update records via a CSV upload     (admins only)
    Create → bulk-create records via a CSV upload     (admins only)

  PHASES
  ──────
  idle        → only the trigger button
  menu        → operations picker modal (Get / Update / Create cards)
  exporting   → Get export API call in flight
  exportError → Get export failed
  landing     → Update/Create: download template or upload CSV
  preview     → CSV parsed; row counts + validation errors
  uploading   → batch API calls in flight; progress bar
  done        → results summary

  PROPS
  ─────
  config       — full schema config from schema.json
  type         — "table" | "hoo"
  resourceType — passed to canWrite() for access gating
  onDone       — optional callback fired after a successful upload batch
*/
export default function BulkMenu({ config, type, resourceType, onDone }) {
  const { canWrite } = useUser();
  const [phase, setPhase] = useState("idle");
  const [activeMode, setActiveMode] = useState(null); // "update" | "create"
  const [parsed, setParsed] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [exportError, setExportError] = useState(null);
  const fileRef = useRef(null);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGetExport = async () => {
    setPhase("exporting");
    setExportError(null);
    try {
      const items =
        type === "hoo"
          ? await exportHooRecords(config.tableName)
          : await exportTableRecords(config.tableName);
      downloadCsvExport(items, config);
      setPhase("idle");
    } catch {
      setExportError("Export failed — check your connection and try again.");
      setPhase("exportError");
    }
  };

  const handleModeSelect = (mode) => {
    setActiveMode(mode);
    setPhase("landing");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    const result = parseCsvForConfig(text, config, type === "hoo");
    setParsed(result);
    setPhase("preview");
  };

  const handleUpload = async () => {
    if (!parsed?.validRows?.length) return;
    const rows = parsed.validRows;
    setProgress({ done: 0, total: rows.length });
    setPhase("uploading");

    const failed = [];
    let processed = 0;
    const BATCH = 5;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const outcomes = await Promise.allSettled(
        batch.map((body) => uploadRow(body)),
      );
      outcomes.forEach((outcome, batchIdx) => {
        const rowNum = i + batchIdx + 2;
        if (outcome.status === "fulfilled" && outcome.value.ok) {
          processed++;
        } else {
          const status = outcome.value?.status;
          let reason;
          if (status === 409) reason = "Already exists";
          else if (status === 404) reason = "Record not found";
          else if (status) reason = `Server error (${status})`;
          else reason = "Network error";
          failed.push({ rowNum, reason });
        }
      });
      setProgress((p) => ({ ...p, done: Math.min(i + BATCH, rows.length) }));
    }

    setResults({ processed, failed });
    setPhase("done");
    if (processed > 0) onDone?.();
  };

  const uploadRow = (body) => {
    if (type === "hoo") {
      if (activeMode === "update") {
        return updateHooRecord(
          config.tableName,
          body[config.partitionKey],
          body[config.sortKey],
          body,
          config.partitionKey,
          config.sortKey,
        );
      }
      return createHooRecord(config.tableName, body, config.partitionKey, config.sortKey);
    }
    if (activeMode === "update") {
      return updateTableRecord(config.tableName, config.partitionKey, body[config.partitionKey], body);
    }
    return createTableRecord(config.tableName, config.partitionKey, body);
  };

  const handleClose = () => {
    setPhase("idle");
    setParsed(null);
    setResults(null);
    setProgress({ done: 0, total: 0 });
    setActiveMode(null);
    setExportError(null);
  };

  const isAdmin = canWrite(resourceType);
  const modeLabel = activeMode === "create" ? "Create" : "Update";

  return (
    <>
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setPhase("menu")}
        className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Bulk
      </button>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      {/* ── All modals ──────────────────────────────────────────────────── */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

            {/* ── MENU — operation picker ─────────────────────────────── */}
            {phase === "menu" && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-bold text-[#3b1a3b]">Bulk Operations</h2>
                  <p className="text-xs text-[#8b6b8b] mt-0.5">{config.tableName}</p>
                </div>

                <div className="px-6 py-5 grid grid-cols-3 gap-3">
                  {/* GET card */}
                  <button
                    type="button"
                    onClick={handleGetExport}
                    className="flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 border-[#d4c4d4] hover:border-[#5b2d5b] hover:bg-[#f5f0f5] transition-all cursor-pointer group text-center"
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#3b1a3b]">Get</p>
                      <p className="text-xs text-[#8b6b8b] mt-0.5 leading-relaxed">Export all records as CSV</p>
                    </div>
                  </button>

                  {/* UPDATE card */}
                  <button
                    type="button"
                    onClick={() => isAdmin && handleModeSelect("update")}
                    disabled={!isAdmin}
                    className={`flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all text-center ${
                      isAdmin
                        ? "border-[#d4c4d4] hover:border-[#5b2d5b] hover:bg-[#f5f0f5] cursor-pointer group"
                        : "border-[#ede4ed] bg-[#faf7fa] cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${isAdmin ? "bg-blue-100 group-hover:bg-blue-200" : "bg-[#ede4ed]"}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isAdmin ? "#2563eb" : "#a090a0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#3b1a3b]">Update</p>
                      <p className="text-xs text-[#8b6b8b] mt-0.5 leading-relaxed">Bulk update via CSV upload</p>
                    </div>
                    {!isAdmin && (
                      <span className="text-[10px] font-semibold text-[#a090a0] bg-[#ede4ed] rounded-full px-2 py-0.5">Admin only</span>
                    )}
                  </button>

                  {/* CREATE card */}
                  <button
                    type="button"
                    onClick={() => isAdmin && handleModeSelect("create")}
                    disabled={!isAdmin}
                    className={`flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all text-center ${
                      isAdmin
                        ? "border-[#d4c4d4] hover:border-[#5b2d5b] hover:bg-[#f5f0f5] cursor-pointer group"
                        : "border-[#ede4ed] bg-[#faf7fa] cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${isAdmin ? "bg-rose-100 group-hover:bg-rose-200" : "bg-[#ede4ed]"}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isAdmin ? "#be123c" : "#a090a0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#3b1a3b]">Create</p>
                      <p className="text-xs text-[#8b6b8b] mt-0.5 leading-relaxed">Bulk create via CSV upload</p>
                    </div>
                    {!isAdmin && (
                      <span className="text-[10px] font-semibold text-[#a090a0] bg-[#ede4ed] rounded-full px-2 py-0.5">Admin only</span>
                    )}
                  </button>
                </div>

                <div className="px-6 py-4 border-t border-[#e8d8e8] flex justify-end">
                  <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold text-[#5b2d5b] border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* ── EXPORTING spinner ───────────────────────────────────── */}
            {phase === "exporting" && (
              <div className="px-6 py-12 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-[#5b2d5b] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-[#3b1a3b]">Exporting records…</p>
                <p className="text-xs text-[#8b6b8b]">{config.tableName}</p>
              </div>
            )}

            {/* ── EXPORT ERROR ────────────────────────────────────────── */}
            {phase === "exportError" && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-bold text-[#3b1a3b]">Export Failed</h2>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-rose-700">{exportError}</p>
                </div>
                <div className="px-6 py-4 border-t border-[#e8d8e8] flex gap-2 justify-end">
                  <button type="button" onClick={() => setPhase("menu")} className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                    Back
                  </button>
                  <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 cursor-pointer">
                    Close
                  </button>
                </div>
              </>
            )}

            {/* ── LANDING — download template or pick file ────────────── */}
            {phase === "landing" && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-bold text-[#3b1a3b]">Bulk {modeLabel}</h2>
                  <p className="text-xs text-[#8b6b8b] mt-0.5">{config.tableName}</p>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <p className="text-sm text-[#5b2d5b]">
                    Download the template, fill in your data, then upload the completed CSV.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => downloadCsvTemplate(config, activeMode)}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-[#5b2d5b] bg-[#f5f0f5] border border-[#d4c4d4] rounded-xl hover:bg-[#ede4ed] transition-colors cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download {modeLabel} Template (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 transition-colors cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload CSV to {modeLabel}
                    </button>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-[#e8d8e8] flex justify-between">
                  <button type="button" onClick={() => setPhase("menu")} className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                    ← Back
                  </button>
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* ── PREVIEW — row counts + validation errors ────────────── */}
            {phase === "preview" && parsed && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-bold text-[#3b1a3b]">Bulk {modeLabel} — Preview</h2>
                  <p className="text-xs text-[#8b6b8b] mt-0.5">{config.tableName}</p>
                </div>
                <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
                  <div className="flex gap-4 text-sm">
                    <span className="text-[#3b1a3b]"><strong>{parsed.totalRows}</strong> rows found</span>
                    <span className="text-emerald-700">✓ <strong>{parsed.validRows.length}</strong> valid</span>
                    {parsed.invalidRows.length > 0 && (
                      <span className="text-rose-700">✗ <strong>{parsed.invalidRows.length}</strong> invalid</span>
                    )}
                  </div>
                  {parsed.unknownHeaders.length > 0 && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      Unknown columns will be ignored: {parsed.unknownHeaders.join(", ")}
                    </div>
                  )}
                  {parsed.invalidRows.length > 0 && (
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
                      {parsed.invalidRows.map((r) => (
                        <div key={r.rowNum}><strong>Row {r.rowNum}:</strong> {r.errors.join("; ")}</div>
                      ))}
                    </div>
                  )}
                  {parsed.validRows.length === 0 && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      No valid rows to {activeMode}.
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-[#e8d8e8] flex justify-between">
                  <button type="button" onClick={() => setPhase("landing")} className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={parsed.validRows.length === 0}
                    className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {modeLabel} {parsed.validRows.length} row{parsed.validRows.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}

            {/* ── UPLOADING — progress bar ────────────────────────────── */}
            {phase === "uploading" && (
              <div className="px-6 py-12 flex flex-col items-center gap-4">
                <p className="text-sm font-bold text-[#3b1a3b]">{modeLabel}ing…</p>
                <div className="w-full bg-[#f0e8f0] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 bg-rose-700 rounded-full transition-all duration-300"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-[#8b6b8b]">{progress.done} / {progress.total} records</p>
              </div>
            )}

            {/* ── DONE — results summary ──────────────────────────────── */}
            {phase === "done" && results && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-bold text-[#3b1a3b]">Bulk {modeLabel} Complete</h2>
                </div>
                <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
                  {results.processed > 0 && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <span>✓</span>
                      <span><strong>{results.processed}</strong> record{results.processed !== 1 ? "s" : ""} {activeMode}d</span>
                    </div>
                  )}
                  {results.failed.length > 0 && (
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
                      <p className="font-semibold">{results.failed.length} failed:</p>
                      {results.failed.map((f) => (
                        <div key={f.rowNum}>Row {f.rowNum}: {f.reason}</div>
                      ))}
                    </div>
                  )}
                  {results.processed === 0 && results.failed.length === 0 && (
                    <p className="text-sm text-[#8b6b8b]">Nothing was processed.</p>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-[#e8d8e8] flex justify-end">
                  <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 cursor-pointer">
                    Close
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
