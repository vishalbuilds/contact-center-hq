import { useState } from "react";
import { searchQueues } from "../../api/hoo.js";

/*
  HOOSearch.jsx — the search screen inside HOOModal.

  This is the first screen the user sees when they open an HOO modal
  (Schedule or Exception). It lets the user find a queue by name and then
  open its week view, or jump straight to a new-record form.

  INTERNAL PHASES
  ───────────────
  The `phase` state controls what is displayed below the search bar:
    "idle"    → first load, no search yet; shows a neutral hint message
    "empty"   → search returned 0 results; shows "No queues found"
    "error"   → network/API failure; shows a red error banner
    "results" → search returned ≥1 results; shows the clickable queue list

  API CALL: searchQueues
  ──────────────────────
  When the user clicks Search (or presses Enter):
    → handleSearch() fires
    → calls searchQueues(tableName, inputText, partitionKey, GSIKey)
    → the backend queries the DynamoDB GSI (queueName index) and returns
       matching { queueArn, queueName } objects
    → results are stored in state and phase changes accordingly

  PROPS
  ─────
  hooConfig   — full config object from schema.json for this HOO table
                (tableName, partitionKey, GSIKey used for the API call)
  onViewAll   — called with (queueArn, queueName) when the user clicks a
                queue row → HOOModal switches to the week view
  onCreateNew — called when "New Record" is clicked → HOOModal switches
                to the form screen in create mode (no queue pre-selected)
*/
export default function HOOSearch({ hooConfig, onViewAll, onCreateNew }) {
  /*
    searchInput — the text currently typed in the search box.
    loading     — true while the API request is in flight (disables Search button).
    phase       — "idle" | "empty" | "error" | "results"
    results     — array of { queueArn, queueName } objects from the API.
  */
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [results, setResults] = useState([]);

  /*
    handleSearch — fires when the user clicks Search or presses Enter.
    Trims whitespace; does nothing if input is empty.
    On success: updates results and sets phase to "empty" or "results".
    On failure: clears results and sets phase to "error".
  */
  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setLoading(true);
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

  return (
    /*
      Scrollable container — fills all remaining vertical space inside the modal.
      flex-1 overflow-y-auto → grows to fill space; scrolls if content is tall
      px-8 py-6             → 32px left/right, 24px top/bottom padding
    */
    <div id="hoo-search" className="flex-1 overflow-y-auto px-8 py-6">

      {/*
        Search bar row — holds the text input, Search button, and New Record button.
        flex gap-3 mb-6 max-w-2xl → horizontal layout, 12px gaps, max 672px wide,
                                     24px gap below before results appear
      */}
      <div className="flex gap-3 mb-6 max-w-2xl">
        {/*
          Text input — where the user types the queue name to search for.
          flex-1              → stretches to fill space between the two buttons
          focus:border-rose-400 → border turns rose-pink when the user clicks in
          onKeyDown Enter     → pressing Enter triggers the search without clicking
          placeholder-[#a090a0] → grey-purple placeholder colour
        */}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
          placeholder="Search by queue name…"
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#d4c4d4] rounded-xl focus:outline-none focus:border-rose-400 text-[#3b1a3b] placeholder-[#a090a0]"
        />

        {/*
          Search button — primary action. disabled={loading} prevents double-submit.
          Label switches to "Searching…" while the API call is in flight.
          disabled:opacity-60 → 60% opacity while disabled so the user sees it is not clickable.
          active:scale-95     → shrinks slightly when pressed (physical press feel).
        */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>

        {/*
          New Record button — secondary action. Jumps straight to the form without
          searching first. Useful for adding a record to a queue not yet in the table.
          White background and mauve border marks it as lower priority than Search.
        */}
        <button
          type="button"
          onClick={() => onCreateNew()}
          className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
        >
          New Record
        </button>
      </div>

      {/* Loading text — visible while the API call is in flight */}
      {loading && (
        <p className="text-sm text-[#a090a0] text-center py-8">Searching…</p>
      )}

      {/* Idle — shown before any search has been attempted */}
      {!loading && phase === "idle" && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          Enter a queue name and click Search to find records.
        </p>
      )}

      {/* Error — shown when the API call fails (network error, server error) */}
      {!loading && phase === "error" && (
        <div className="max-w-2xl px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Search failed — check your connection and try again.
        </div>
      )}

      {/* Empty — shown when the API returned 0 matching queues */}
      {!loading && phase === "empty" && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          No queues found for &ldquo;{searchInput}&rdquo;.
        </p>
      )}

      {/*
        Results — shown when the API returned ≥1 queues.
        Each queue is a full-width button. Clicking calls onViewAll()
        which switches HOOModal to the week view for that queue.

        `group` on the button — lets child elements react to the parent's
        hover state using `group-hover:` Tailwind classes:
          group-hover:text-rose-800 → queue name turns dark rose on hover
          group-hover:text-rose-400 → chevron arrow turns rose on hover
      */}
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
              {/* Chevron → shows this row is clickable; turns rose on hover */}
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
