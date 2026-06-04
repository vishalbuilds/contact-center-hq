import { useState, useRef, useEffect } from "react";

/*
  SearchResult.jsx — a single row in the RecordSearch results list.

  Identical in behaviour to Table/TableSearch/SearchResult/SearchResult.jsx.
  Shows the primary key value of one matched record and a ⋮ options button
  that opens a dropdown menu with Open, Duplicate, and Delete actions.

  THREE-DOT MENU (⋮)
  ──────────────────
  The options button toggles a floating dropdown menu:
    • Open      → calls onOpen(pkValue) → parent fetches and opens the edit form
    • Duplicate → calls onDuplicate(pkValue) → parent fetches and opens the duplicate form
    • Delete    → switches to the delete confirmation sub-panel

  DELETE CONFIRMATION SUB-PANEL
  ──────────────────────────────
  When "Delete" is clicked, confirmingDelete flips to true and the menu is
  replaced with a confirmation panel: "Delete this record?" [Yes, Delete] [Cancel].
  Both panels close if the user clicks anywhere outside the dropdown wrapper
  (via mousedown event listener on the document using menuRef).

  BUSY STATE
  ──────────
  When busy=true (row is being fetched or deleted):
    • The ⋮ button is disabled and shows a spinning animation
    • The row cannot be interacted with

  PROPS
  ─────
  pkTitle      — display name of the primary key field (e.g. "DINS", "DID")
  pkValue      — the primary key value string for this record
  onOpen       — called with pkValue when "Open" is selected
  onDuplicate  — called with pkValue when "Duplicate" is selected
  onDelete     — called with pkValue when "Yes, Delete" is confirmed
  busy         — boolean; true shows a spinner and disables the options button
*/
export default function SearchResult({
  pkTitle,
  pkValue,
  onOpen,
  onDuplicate,
  onDelete,
  busy,
}) {
  /*
    menuOpen         — true when the ⋮ dropdown is visible
    confirmingDelete — true when the delete confirmation panel is showing
    menuRef          — ref for outside-click detection
  */
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef(null);

  /*
    Outside-click listener — closes the menu when the user clicks elsewhere.
    Only active when menuOpen=true; cleaned up when menu closes or component unmounts.
  */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    /*
      Row card — white card with pk label/value on the left, options button on the right.
      hover:border-rose-300 → border softly highlights on hover
    */
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#d4c4d4] hover:border-rose-300 transition-colors">
      {/* Primary key field name + value */}
      <div>
        {/* Field name — tiny all-caps muted label above the value */}
        <p className="text-xs text-[#8b6b8b] uppercase tracking-wide leading-tight">
          {pkTitle}
        </p>
        {/* Primary key value — monospace for readability of IDs/numbers */}
        <p className="font-mono text-sm font-semibold text-[#3b1a3b]">
          {pkValue}
        </p>
      </div>

      {/* ⋮ button + dropdown — positioned relative to this wrapper */}
      <div className="relative" ref={menuRef}>
        {/*
          Options button — ⋮ icon normally; spinner when busy.
          Disabled when busy=true to prevent actions during fetch/delete.
        */}
        <button
          type="button"
          onClick={() => !busy && setMenuOpen((v) => !v)}
          disabled={busy}
          aria-label="Options"
          className={`p-1.5 rounded-lg transition-colors ${
            busy
              ? "text-[#a090a0] cursor-default"
              : "text-[#8b6b8b] hover:bg-[#e8d8e8] hover:text-[#3b1a3b] cursor-pointer"
          }`}
        >
          {/* animate-spin spins the icon while busy; three dots ⋮ when not busy */}
          {busy ? (
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          )}
        </button>

        {/*
          Normal dropdown — Open / Duplicate / (divider) / Delete.
          absolute right-0 top-full mt-1 → floats below the button, right-aligned
          shadow-lg z-20 → above other content
          Delete is in red to signal it is a destructive action.
        */}
        {menuOpen && !confirmingDelete && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-[#d4c4d4] rounded-xl shadow-lg z-20 py-1 min-w-35 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpen(pkValue);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#3b1a3b] hover:bg-[#f5f0f5] transition-colors cursor-pointer"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate(pkValue);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#3b1a3b] hover:bg-[#f5f0f5] transition-colors cursor-pointer"
            >
              Duplicate
            </button>
            {/* Divider separates safe actions from the destructive Delete action */}
            <div className="h-px bg-[#e8d8e8] mx-2 my-1" />
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}

        {/*
          Delete confirmation panel — shown instead of the normal menu when
          confirmingDelete=true. Red border signals a dangerous action.
          "Yes, Delete" → confirms; "Cancel" → returns to the normal menu state.
        */}
        {menuOpen && confirmingDelete && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-red-200 rounded-xl shadow-lg z-20 p-3 min-w-45">
            <p className="text-sm font-semibold text-[#3b1a3b] mb-3">
              Delete this record?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(pkValue);
                }}
                className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 px-3 py-1.5 text-xs font-semibold text-[#5b2d5b] bg-[#e8d8e8] rounded-lg hover:bg-[#d4c4d4] active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
