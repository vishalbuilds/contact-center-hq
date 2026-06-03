import { useState } from "react";
import SearchResult from "./SearchResult/SearchResult.jsx";
import BulkButton from "../../Components/BulkButton.jsx";
import BulkImportModal from "../../Components/BulkImportModal.jsx";
import { searchTableRecords, deleteTableRecord } from "../../api/table.js";

export default function TableSearch({ tableConfig, pkField, onOpen, onDuplicate, onCreateNew, loadingPkValue }) {
  const [showImport, setShowImport] = useState(false);
  const [bulkMode, setBulkMode] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [deletingPkValue, setDeletingPkValue] = useState(null);

  const handleSearch = async () => {
    if (!searchInput.trim() || !pkField) return;
    setSearching(true);
    setError(null);
    try {
      const data = await searchTableRecords(tableConfig.tableName, pkField.id, searchInput);
      setResults(data);
    } catch {
      setError("Search failed — check your connection and try again.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (pkValue) => {
    if (deletingPkValue) return;
    setDeletingPkValue(pkValue);
    try {
      await deleteTableRecord(tableConfig.tableName, pkField?.id, pkValue);
      setResults((prev) => prev?.filter((v) => v !== pkValue) ?? []);
    } catch {
      setError("Delete failed — please try again.");
    } finally {
      setDeletingPkValue(null);
    }
  };

  return (
    <div id="table-search" className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex gap-3 mb-6 max-w-2xl">
        <input
          type="text"
          aria-label={`Search by ${pkField?.title ?? "primary key"}`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !searching && handleSearch()}
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
        <BulkButton onOpenModal={(m) => { setBulkMode(m); setShowImport(true); }} />
      </div>

      {showImport && (
        <BulkImportModal
          tableConfig={tableConfig}
          initialMode={bulkMode}
          onClose={() => { setShowImport(false); setBulkMode(null); }}
        />
      )}
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
              busy={loadingPkValue === pkValue || deletingPkValue === pkValue}
            />
          ))}
        </div>
      )}
    </div>
  );
}
