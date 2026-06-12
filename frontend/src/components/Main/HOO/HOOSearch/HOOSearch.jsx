import { useState } from "react";
import { searchQueues } from "../../api/hoo.js";
import BulkButton from "../../Components/BulkButton.jsx";
import BulkImportModal from "../../Components/BulkImportModal.jsx";
import { useUser } from "../../../../context/UserContext.jsx";

export default function HOOSearch({ hooConfig, resourceType, onViewAll, onCreateNew, onBulkEdit }) {
  const { canWrite } = useUser();
  const isAdmin = canWrite(resourceType);

  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [bulkMode, setBulkMode] = useState(null);

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setLoading(true);
    setSelected(new Set());
    setConfirmBulkDelete(false);
    try {
      const items = await searchQueues(hooConfig.tableName, q, hooConfig.partitionKey, hooConfig.GSIKey);
      setResults(items);
      setPhase(items.length === 0 ? "empty" : "results");
    } catch {
      setResults([]);
      setPhase("error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (queueArn) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(queueArn)) next.delete(queueArn); else next.add(queueArn);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((r) => r.queueArn)));
  };

  const selectedQueues = results.filter((r) => selected.has(r.queueArn));

  const handleBulkDelete = async () => {
    if (bulkDeleting) return;
    setBulkDeleting(true);
    setBulkError(null);

    const outcomes = await Promise.allSettled(
      selectedQueues.map((q) =>
        fetch(`/api/v1/hoo/all`, {
          method: "DELETE",
          headers: {
            "x-table": hooConfig.tableName,
            "x-pk": hooConfig.partitionKey,
            "x-pk-value": q.queueArn,
            "x-sk": hooConfig.sortKey,
          },
        })
      )
    );

    const successArns = new Set(
      selectedQueues
        .filter((_, i) => outcomes[i].status === "fulfilled" && outcomes[i].value.ok)
        .map((q) => q.queueArn)
    );
    const failCount = selectedQueues.length - successArns.size;

    setResults((prev) => prev.filter((r) => !successArns.has(r.queueArn)));
    setSelected((prev) => {
      const next = new Set(prev);
      successArns.forEach((arn) => next.delete(arn));
      return next;
    });
    setConfirmBulkDelete(false);

    if (failCount > 0) {
      setBulkError(`${failCount} queue${failCount !== 1 ? "s" : ""} could not be deleted — please try again.`);
    }

    setBulkDeleting(false);
  };

  const someSelected = selected.size > 0;
  const allSelected = results.length > 0 && selected.size === results.length;

  return (
    <div id="hoo-search" className="flex-1 overflow-y-auto px-8 py-6">
      {/* Search bar */}
      <div className="flex gap-3 mb-6 max-w-2xl">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
          placeholder="Search by queue name…"
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#d4c4d4] rounded-xl focus:outline-none focus:border-rose-400 text-[#3b1a3b] placeholder-[#a090a0]"
        />
        <button type="button" onClick={handleSearch} disabled={loading}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60">
          {loading ? "Searching…" : "Search"}
        </button>
        {isAdmin && (
          <button type="button" onClick={() => onCreateNew()}
            className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer">
            New Record
          </button>
        )}
        <BulkButton isAdmin={isAdmin} onOpenModal={(m) => { setBulkMode(m); setShowImport(true); }} />
      </div>

      {/* Bulk action bar — appears when queues are selected */}
      {someSelected && (
        <div className="max-w-2xl mb-4">
          {!confirmBulkDelete ? (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-50 border border-purple-300 rounded-xl">
              <span className="flex-1 text-sm text-purple-800 font-medium">
                {selected.size} queue{selected.size !== 1 ? "s" : ""} selected
              </span>
              {isAdmin && (
                <button type="button" onClick={() => onBulkEdit?.(selectedQueues)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 active:scale-95 transition-all cursor-pointer">
                  Bulk Edit
                </button>
              )}
              {isAdmin && (
                <button type="button" onClick={() => setConfirmBulkDelete(true)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 active:scale-95 transition-all cursor-pointer">
                  Bulk Delete
                </button>
              )}
              <button type="button" onClick={() => setSelected(new Set())}
                className="px-4 py-1.5 text-xs font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer">
                Clear
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-300 rounded-xl">
              <span className="flex-1 text-sm text-red-700 font-medium">
                Delete all records for {selected.size} queue{selected.size !== 1 ? "s" : ""}? Cannot be undone.
              </span>
              <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 active:scale-95 transition-all cursor-pointer disabled:opacity-60">
                {bulkDeleting ? "Deleting…" : "Yes, Delete All"}
              </button>
              <button type="button" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}
                className="px-4 py-1.5 text-xs font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] cursor-pointer disabled:opacity-60">
                Cancel
              </button>
            </div>
          )}
          {bulkError && <p className="mt-2 text-xs text-red-600">{bulkError}</p>}
        </div>
      )}

      {/* States */}
      {loading && <p className="text-sm text-[#a090a0] text-center py-8">Searching…</p>}
      {!loading && phase === "idle" && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          Enter a queue name and click Search to find records.
        </p>
      )}
      {!loading && phase === "error" && (
        <div className="max-w-2xl px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Search failed — check your connection and try again.
        </div>
      )}
      {!loading && phase === "empty" && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          No queues found for &ldquo;{searchInput}&rdquo;.
        </p>
      )}

      {/* Results */}
      {!loading && phase === "results" && (
        <div className="max-w-2xl flex flex-col gap-3">
          {/* Select-all row — admin only */}
          <div className="flex items-center gap-2 mb-1">
            {isAdmin && (
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                className="w-4 h-4 accent-rose-700 cursor-pointer" aria-label="Select all queues" />
            )}
            <p className="text-xs text-[#8b6b8b]">
              {results.length} queue{results.length !== 1 ? "s" : ""} matching &ldquo;{searchInput}&rdquo;
            </p>
          </div>

          {results.map((item) => (
            <div key={item.queueArn}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                isAdmin && selected.has(item.queueArn)
                  ? "bg-purple-50 border-purple-400"
                  : "bg-white border-[#d4c4d4] hover:border-rose-300"
              }`}
            >
              {isAdmin && (
                <input type="checkbox" checked={selected.has(item.queueArn)}
                  onChange={() => toggleSelect(item.queueArn)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 accent-rose-700 cursor-pointer shrink-0" />
              )}
              <button type="button" onClick={() => onViewAll(item.queueArn, item.queueName)}
                className="flex-1 flex items-center justify-between text-left group cursor-pointer">
                <p className="font-semibold text-sm text-[#3b1a3b] group-hover:text-rose-800 transition-colors">
                  {item.queueName}
                </p>
                <svg className="shrink-0 ml-4 text-[#c0b0c0] group-hover:text-rose-400 transition-colors"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <BulkImportModal
          hooConfig={hooConfig}
          initialMode={bulkMode}
          isAdmin={isAdmin}
          onClose={() => { setShowImport(false); setBulkMode(null); }}
        />
      )}
    </div>
  );
}
