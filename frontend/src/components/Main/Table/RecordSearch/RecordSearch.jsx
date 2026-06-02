import { useState } from "react";
import SearchResult from "./SearchResult/SearchResult.jsx";
import { searchTableRecords, deleteTableRecord } from "../../api/table.js";

/*
  RecordSearch.jsx — the search screen inside a record-management modal.

  Functionally identical to Table/TableSearch/TableSearch.jsx. Lets the user
  find records by primary key value and then open, duplicate, or delete them.

  HOW SEARCH WORKS
  ────────────────
  The user types a primary key value in the search box and clicks Search.
  searchTableRecords() is called which hits the backend search endpoint and
  returns a list of matching primary key value strings (not full records).
  Each result is rendered as a SearchResult row with an options (⋮) menu.

  DELETE FROM SEARCH
  ──────────────────
  The user can delete a record directly from the search results via the
  options menu (⋮ → Delete → "Yes, Delete"). deleteTableRecord() is called;
  on success the deleted item is removed from the results list without re-fetching.
  deletingPkValue tracks which row is mid-deletion to show a spinner there.

  PROPS
  ─────
  tableConfig     — full config from schema.json (tableName, fields, etc.)
  pkField         — the primary key field object (id, title, type, ...)
  onOpen          — called with pkValue on "Open" → parent fetches full record, opens edit form
  onDuplicate     — called with pkValue on "Duplicate" → parent fetches record, opens duplicate form
  onCreateNew     — called on "New Record" → parent opens create form with defaults
  loadingPkValue  — pk value currently being fetched by the parent (shows spinner on that row)
*/
export default function RecordSearch({ tableConfig, pkField, onOpen, onDuplicate, onCreateNew, loadingPkValue }) {
  /*
    searchInput     — text currently in the search box
    searching       — true while the search API call is in flight
    results         — array of pk value strings from the API (null = no search yet)
    error           — error message string; null when no error
    deletingPkValue — pk value of the row currently being deleted
  */
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [deletingPkValue, setDeletingPkValue] = useState(null);

  /*
    handleSearch — fires on Search button click or Enter key.
    Calls searchTableRecords(); stores results or sets error on failure.
    Guard: does nothing if input is empty or pkField is not defined.
  */
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

  /*
    handleDelete — fires when the user confirms deletion on a SearchResult row.
    Guard: prevents concurrent deletes.
    On success: removes the item from results without re-fetching.
    On failure: shows an error banner.
  */
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
    /*
      Scrollable container — fills all available height below the modal header.
      flex-1 overflow-y-auto → grows to fill space; scrolls if content is tall
      px-8 py-6              → 32px left/right, 24px top/bottom padding
    */
    <div className="flex-1 overflow-y-auto px-8 py-6">

      {/*
        Search bar row — input + Search + New Record buttons.
        The placeholder dynamically shows the pk field title so the user
        knows which field to search by (e.g. "Search by DID…").
      */}
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
        {/* Search button — primary action; disables while API is in flight */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        {/* New Record — secondary action; opens create form with default values */}
        <button
          type="button"
          onClick={onCreateNew}
          className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
        >
          New Record
        </button>
      </div>

      {/* Error banner — shown when search or delete fails */}
      {error && (
        <div className="max-w-2xl mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Idle — no search has been run yet */}
      {results === null && !error && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          Enter a value and click Search to find records.
        </p>
      )}

      {/* Empty — search completed but returned 0 results */}
      {results !== null && results.length === 0 && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          No records found for &ldquo;{searchInput}&rdquo;.
        </p>
      )}

      {/*
        Results list — one SearchResult row per matching pk value.
        busy prop: true when this row's pk matches either loadingPkValue
        (being fetched by the parent) or deletingPkValue (being deleted here).
        Busy rows show a spinner and cannot be interacted with.
      */}
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
