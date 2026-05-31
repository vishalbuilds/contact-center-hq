import { useState } from "react";
import SearchResult from "./SearchResult/SearchResult.jsx";

async function searchRecords(tableConfig, pkField, searchValue) {
  if (!pkField || !searchValue.trim()) return [];
  const res = await fetch(
    `/api/v1/table/records/${encodeURIComponent(tableConfig.tableName)}/search`,
    { headers: { "x-pk": pkField.id, "x-pk-value": searchValue } }
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

async function deleteRecord(tableName, pkId, pkValue) {
  const res = await fetch(
    `/api/v1/table/records/${encodeURIComponent(tableName)}/${encodeURIComponent(pkValue)}`,
    { method: "DELETE", headers: { "x-pk": pkId } }
  );
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export default function RecordSearch({ tableConfig, pkField, onOpen, onDuplicate, onCreateNew }) {
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await searchRecords(tableConfig, pkField, searchInput);
      setResults(data);
    } catch {
      setError("Search failed — check your connection and try again.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (pkValue) => {
    try {
      await deleteRecord(tableConfig.tableName, pkField?.id, pkValue);
      setResults((prev) => prev?.filter((v) => v !== pkValue) ?? []);
    } catch {
      setError("Delete failed — please try again.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex gap-3 mb-6 max-w-2xl">
        <input
          type="text"
          aria-label={`Search by ${pkField?.title ?? "primary key"}`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={`Search by ${pkField?.title ?? "primary key"}…`}
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#d4c4d4] rounded-xl focus:outline-none focus:border-rose-400 text-[#3b1a3b] placeholder-[#a090a0]"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
        >
          New Record
        </button>
      </div>

      {error && (
        <div className="max-w-2xl mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {results === null && !error && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          Enter a value and click Search to find records.
        </p>
      )}
      {results !== null && results.length === 0 && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          No records found for &ldquo;{searchInput}&rdquo;.
        </p>
      )}
      {results !== null && results.length > 0 && (
        <div className="flex flex-col gap-3 max-w-2xl">
          <p className="text-xs text-[#8b6b8b] mb-1">
            {results.length} record{results.length !== 1 ? "s" : ""} found
          </p>
          {results.map((pkValue) => (
            <SearchResult
              key={pkValue}
              pkTitle={pkField?.title ?? "PK"}
              pkValue={pkValue}
              onOpen={onOpen}
              onDuplicate={onDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
