import { useState } from "react";

const BASE = (tableName) => `/api/v1/hoo/${encodeURIComponent(tableName)}`;

async function searchQueues(hooConfig, queueName) {
  const res = await fetch(
    `${BASE(hooConfig.tableName)}/by-queue?${new URLSearchParams({ queue_name: queueName })}`,
    { headers: { "x-pk": hooConfig.partitionKey, "x-gsi-key": hooConfig.GSIKey } }
  );
  if (!res.ok) return [];
  return (await res.json()).items ?? [];
}

export default function HOOSearch({ hooConfig, onViewAll, onCreateNew }) {
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | empty | error | results
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setLoading(true);
    try {
      const items = await searchQueues(hooConfig, q);
      setResults(items);
      setPhase(items.length === 0 ? "empty" : "results");
    } catch {
      setResults([]);
      setPhase("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
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
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={() => onCreateNew()}
          className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
        >
          New Record
        </button>
      </div>

      {/* States */}
      {loading && (
        <p className="text-sm text-[#a090a0] text-center py-8">Searching…</p>
      )}

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

      {!loading && phase === "results" && (
        <div className="max-w-2xl flex flex-col gap-3">
          <p className="text-xs text-[#8b6b8b]">
            {results.length} queue{results.length !== 1 ? "s" : ""} matching &ldquo;{searchInput}&rdquo; — click to open
          </p>
          {results.map((item) => (
            <button
              key={item.queueArn}
              type="button"
              onClick={() => onViewAll(item.queueArn, item.queueName)}
              className="flex items-center justify-between px-5 py-4 bg-white rounded-xl border border-[#d4c4d4] hover:border-rose-400 hover:shadow-sm active:scale-[0.99] transition-all text-left cursor-pointer w-full group"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#3b1a3b] group-hover:text-rose-800 transition-colors">
                  {item.queueName}
                </p>
              </div>
              <svg
                className="shrink-0 ml-4 text-[#c0b0c0] group-hover:text-rose-400 transition-colors"
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
