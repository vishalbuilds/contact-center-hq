import { useState } from "react";
import SearchResult from "./SearchResult/SearchResult.jsx";
import { searchTableRecords, deleteTableRecord } from "../../api/table.js";

/*
  TableSearch.jsx — the search screen inside TableModal.

  The first screen the user sees when they open a Table modal. Lets the user
  find records by primary key value, then open, duplicate, or delete them.

  HOW SEARCH WORKS
  ────────────────
  The user types a partial or full primary key value (e.g. a phone number,
  DID, mailbox number) and clicks Search. This calls searchTableRecords()
  which hits GET /api/v1/table/records/search (table sent as x-table header) and returns a list of
  matching primary key value strings (not full records — just the keys).
  Each matching key is rendered as a SearchResult row with an options menu.

  DELETE FROM SEARCH
  ──────────────────
  The user can delete a record directly from the search results via the
  options menu (⋮ button → Delete → "Yes, Delete"). deleteTableRecord() is
  called here; on success the deleted item is removed from the results array
  without re-fetching. deletingPkValue tracks which row is being deleted so
  the correct row shows a spinner during the API call.

  API CALLS
  ─────────
  searchTableRecords — called on Search click; returns array of pk value strings
  deleteTableRecord  — called on "Yes, Delete" confirm; throws on failure

  PROPS
  ─────
  tableConfig     — full config object from schema.json (tableName, fields, etc.)
  pkField         — the primary key field object (id, title, type, ...)
  onOpen          — called with pkValue when user clicks "Open" in the menu
                    → TableModal fetches the full record and opens the edit form
  onDuplicate     — called with pkValue when user clicks "Duplicate"
                    → TableModal fetches the record and opens the duplicate form
  onCreateNew     — called when "New Record" button is clicked
                    → TableModal opens the create form with defaults
  loadingPkValue  — the pkValue currently being fetched by TableModal (Open/Duplicate)
                    passed down to the matching SearchResult to show a spinner
*/
export default function TableSearch({ tableConfig, pkField, onOpen, onDuplicate, onCreateNew, loadingPkValue }) {
  /*
    searchInput     — the text currently typed in the search box
    searching       — true while the search API call is in flight
    results         — array of pk value strings from the API (null = no search yet)
    error           — string error message; null when no error
    deletingPkValue — pk value of the row currently being deleted (null = no deletion)
  */
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [deletingPkValue, setDeletingPkValue] = useState(null);

  /*
    handleSearch — fires when the user clicks Search or presses Enter.
    Clears the previous error, calls the search API, stores the results.
    On failure: sets error string and clears results.
    Guard: does nothing if the input is empty or pkField is undefined.
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
    handleDelete — fires when the user confirms deletion from a SearchResult row.
    Guard: if a delete is already in progress, returns early.
    On success: removes the deleted pk from the results array without re-fetching.
    On failure: shows an error banner.
  */
  const handleDelete = async (pkValue) => {
    if (deletingPkValue) return;
    setDeletingPkValue(pkValue);
    try {
      await deleteTableRecord(tableConfig.tableName, pkField?.id, pkValue);
      /* Optimistically remove the deleted item from the list */
      setResults((prev) => prev?.filter((v) => v !== pkValue) ?? []);
    } catch {
      setError("Delete failed — please try again.");
    } finally {
      setDeletingPkValue(null);
    }
  };

  return (
    /*
      Scrollable container — fills all remaining height in the modal.
      flex-1 overflow-y-auto → grows to fill space, scrolls if content is tall
      px-8 py-6              → 32px left/right, 24px top/bottom padding
    */
    <div className="flex-1 overflow-y-auto px-8 py-6">

      {/*
        Search bar row — text input + Search button + New Record button.
        flex gap-3 mb-6 max-w-2xl → horizontal layout, 12px gaps, max 672px wide,
                                     24px gap below before results appear
      */}
      <div className="flex gap-3 mb-6 max-w-2xl">
        {/*
          Search input — the user types the primary key value they are looking for.
          aria-label   → accessibility label for screen readers
          placeholder  → dynamically shows the pk field title (e.g. "Search by DINS…")
          onKeyDown Enter → pressing Enter fires the search without clicking the button
          focus:border-rose-400 → border turns rose when the user clicks in
        */}
        <input
          type="text"
          aria-label={`Search by ${pkField?.title ?? "primary key"}`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !searching && handleSearch()}
          placeholder={`Search by ${pkField?.title ?? "primary key"}…`}
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#d4c4d4] rounded-xl focus:outline-none focus:border-rose-400 text-[#3b1a3b] placeholder-[#a090a0]"
        />

        {/*
          Search button — primary action.
          disabled={searching} → prevents double-submit while API is in flight.
          disabled:opacity-60 → 60% opacity while disabled.
          Label changes to "Searching…" while loading.
        */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>

        {/*
          New Record button — secondary action; opens the create form with defaults.
          White background with mauve border marks lower visual priority than Search.
        */}
        <button
          type="button"
          onClick={onCreateNew}
          className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
        >
          New Record
        </button>
      </div>

      {/*
        Error banner — shown when search or delete fails.
        bg-red-50 border border-red-200 → soft red background + border
        text-red-700 → dark red text
      */}
      {error && (
        <div className="max-w-2xl mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Idle state — results is null because no search has been run yet */}
      {results === null && !error && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          Enter a value and click Search to find records.
        </p>
      )}

      {/* Empty state — search ran but returned 0 results */}
      {results !== null && results.length === 0 && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          No records found for &ldquo;{searchInput}&rdquo;.
        </p>
      )}

      {/*
        Results list — one SearchResult row per matching primary key value.
        flex flex-col gap-3 max-w-2xl → vertical stack, 12px gaps, max 672px wide

        busy prop: a row is "busy" when it is being opened/duplicated
        (loadingPkValue matches) or being deleted (deletingPkValue matches).
        Busy rows show a spinning icon instead of the options menu.
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
