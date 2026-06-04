import { useRef, useState } from "react";
import { parseCsvForConfig } from "../../utils/csvParse.js";
import { createTableRecord } from "./api/table.js";
import { createHooRecord } from "./api/hoo.js";

/*
  CsvUploadButton — a self-contained "Upload CSV" button that handles the full
  bulk-import flow: file selection → preview → upload → results.

  Works for both Table and HOO configs because all field metadata (IDs, types,
  required flags, isPayload) comes from the config object passed in from schema.json.

  PHASES
  ──────
  idle      → just the button; no modal open
  preview   → file parsed; shows row counts + validation errors before uploading
  uploading → API calls in flight; shows progress bar
  done      → all rows processed; shows created / failed counts

  PROPS
  ─────
  config  — full schema config from schema.json (fields, tableName, partitionKey, sortKey)
  type    — "table" | "hoo"  determines which API function is called per row
  onDone  — optional callback fired after a successful upload batch
*/
export default function CsvUploadButton({ config, type, onDone }) {
  const fileRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [parsed, setParsed] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null); // { created, failed: [{ rowNum, reason }] }

  /* Read and parse the selected file */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ""; // reset so the same file can be re-selected
    const text = await file.text();
    const result = parseCsvForConfig(text, config, type === "hoo");
    setParsed(result);
    setPhase("preview");
  };

  /* Send valid rows to the API, tracking progress */
  const handleUpload = async () => {
    if (!parsed?.validRows?.length) return;
    const rows = parsed.validRows;
    setProgress({ done: 0, total: rows.length });
    setPhase("uploading");

    const failed = [];
    let created = 0;

    /* Process in batches of 5 to avoid overwhelming the API */
    const BATCH = 5;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const outcomes = await Promise.allSettled(
        batch.map((body) => uploadRow(body)),
      );

      outcomes.forEach((outcome, batchIdx) => {
        const rowNum = i + batchIdx + 2; // +2 = header row + 1-indexed
        if (outcome.status === "fulfilled" && outcome.value.ok) {
          created++;
        } else {
          const status = outcome.value?.status;
          let reason;
          if (status === 409) reason = "Already exists";
          else if (status) reason = `Server error (${status})`;
          else reason = "Network error";
          failed.push({ rowNum, reason });
        }
      });

      setProgress((p) => ({ ...p, done: Math.min(i + BATCH, rows.length) }));
    }

    setResults({ created, failed });
    setPhase("done");
    if (created > 0) onDone?.();
  };

  /* Upload a single row body via the correct API */
  const uploadRow = (body) => {
    if (type === "hoo") {
      return createHooRecord(
        config.tableName,
        body,
        config.partitionKey,
        config.sortKey,
      );
    }
    return createTableRecord(config.tableName, config.partitionKey, body);
  };

  const handleClose = () => {
    setPhase("idle");
    setParsed(null);
    setResults(null);
    setProgress({ done: 0, total: 0 });
  };

  return (
    <>
      {/* Trigger button — same style as the Template button */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
      >
        Upload CSV
      </button>

      {/* Hidden file input — only accepts .csv */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modal overlay — shown for preview / uploading / done phases */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* ── PREVIEW PHASE ─────────────────────────────────────── */}
            {phase === "preview" && parsed && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-semibold text-[#3b1a3b]">
                    CSV Preview
                  </h2>
                  <p className="text-xs text-[#8b6b8b] mt-0.5">
                    {config.tableName}
                  </p>
                </div>

                <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
                  {/* Summary counts */}
                  <div className="flex gap-4 text-sm">
                    <span className="text-[#3b1a3b]">
                      <strong>{parsed.totalRows}</strong> rows found
                    </span>
                    <span className="text-emerald-700">
                      ✓ <strong>{parsed.validRows.length}</strong> valid
                    </span>
                    {parsed.invalidRows.length > 0 && (
                      <span className="text-rose-700">
                        ✗ <strong>{parsed.invalidRows.length}</strong> invalid
                      </span>
                    )}
                  </div>

                  {/* Unknown headers warning */}
                  {parsed.unknownHeaders.length > 0 && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      Unknown columns will be ignored:{" "}
                      {parsed.unknownHeaders.join(", ")}
                    </div>
                  )}

                  {/* Validation errors */}
                  {parsed.invalidRows.length > 0 && (
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
                      {parsed.invalidRows.map((r) => (
                        <div key={r.rowNum}>
                          <strong>Row {r.rowNum}:</strong> {r.errors.join("; ")}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No valid rows warning */}
                  {parsed.validRows.length === 0 && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      No valid rows to upload.
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-[#e8d8e8] flex justify-between">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={parsed.validRows.length === 0}
                    className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 transition-all cursor-pointer disabled:opacity-40"
                  >
                    Upload {parsed.validRows.length} row
                    {parsed.validRows.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}

            {/* ── UPLOADING PHASE ───────────────────────────────────── */}
            {phase === "uploading" && (
              <div className="px-6 py-10 flex flex-col items-center gap-4">
                <p className="text-sm font-semibold text-[#3b1a3b]">
                  Uploading…
                </p>
                <div className="w-full bg-[#f0e8f0] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-rose-700 rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-[#8b6b8b]">
                  {progress.done} / {progress.total} records
                </p>
              </div>
            )}

            {/* ── DONE PHASE ────────────────────────────────────────── */}
            {phase === "done" && results && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[#e8d8e8]">
                  <h2 className="text-base font-semibold text-[#3b1a3b]">
                    Upload Complete
                  </h2>
                </div>

                <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
                  {results.created > 0 && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <span>✓</span>
                      <span>
                        <strong>{results.created}</strong> record
                        {results.created !== 1 ? "s" : ""} created
                      </span>
                    </div>
                  )}
                  {results.failed.length > 0 && (
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
                      <p className="font-semibold">
                        {results.failed.length} failed:
                      </p>
                      {results.failed.map((f) => (
                        <div key={f.rowNum}>
                          Row {f.rowNum}: {f.reason}
                        </div>
                      ))}
                    </div>
                  )}
                  {results.created === 0 && results.failed.length === 0 && (
                    <p className="text-sm text-[#8b6b8b]">
                      Nothing was uploaded.
                    </p>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-[#e8d8e8] flex justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 cursor-pointer"
                  >
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
