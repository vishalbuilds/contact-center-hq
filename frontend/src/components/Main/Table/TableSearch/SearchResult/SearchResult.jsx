import { useState, useRef, useEffect } from "react";

/*
  SearchResult.jsx — a single row in the TableSearch results list.

  Shows the primary key value of one matched record and a ⋮ options button
  that opens a dropdown menu with Open, Duplicate, and Delete actions.

  THREE-DOT MENU (⋮)
  ──────────────────
  The options button toggles a floating dropdown menu:
    • Open      → calls onOpen(pkValue) → TableModal fetches and opens the edit form
    • Duplicate → calls onDuplicate(pkValue) → TableModal fetches and opens the duplicate form
    • Delete    → switches to the delete confirmation sub-panel (not a separate menu)

  DELETE CONFIRMATION SUB-PANEL
  ──────────────────────────────
  When "Delete" is clicked in the menu, confirmingDelete flips to true.
  The dropdown menu is replaced with a smaller confirmation panel:
    "Delete this record?"  [Yes, Delete]  [Cancel]
  Clicking "Yes, Delete" calls onDelete(pkValue) which is handled by TableSearch.
  Clicking Cancel hides the confirmation panel and returns to the normal menu state.
  Both panels close automatically if the user clicks anywhere outside them
  (handled by the mousedown event listener via menuRef).

  BUSY STATE
  ──────────
  When busy=true (this row is currently being fetched or deleted):
    • The ⋮ button is disabled and shows a spinning animation
    • aria-label="Options" remains for screen readers

  OUTSIDE CLICK TO CLOSE
  ──────────────────────
  A mousedown event listener is added to the document when menuOpen=true.
  If the click target is outside menuRef (the dropdown wrapper), both menuOpen
  and confirmingDelete are reset to false. The listener is removed on cleanup.

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
    menuRef          — ref attached to the dropdown wrapper; used to detect
                       outside clicks and close the menu
  */
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef(null);

  /*
    Outside-click listener — only active when the menu is open.
    Adds a mousedown listener to the document; removes it on cleanup or when
    menuOpen becomes false. If the click is outside menuRef, closes the menu.
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
      Row wrapper — a white card showing the pk label + value + options button.
      flex items-center justify-between → pk text on left, button on right
      px-4 py-3                         → 16px horizontal, 12px vertical padding
      bg-white rounded-xl               → white, very rounded
      border border-[#d4c4d4]           → light mauve border
      hover:border-rose-300             → border turns soft rose on hover
      transition-colors                 → smooth border colour change
    */
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#d4c4d4] hover:border-rose-300 transition-colors">
      {/* ── Primary key display ─────────────────────────────────── */}
      <div>
        {/*
          Field name label — tiny all-caps muted-purple text above the value.
          uppercase tracking-wide → spaced out capital letters for a label look
          text-xs text-[#8b6b8b]  → small, muted purple
        */}
        <p className="text-xs text-[#8b6b8b] uppercase tracking-wide leading-tight">
          {pkTitle}
        </p>
        {/*
          Primary key value — the actual stored value (e.g. "+15551234567").
          font-mono → monospace font makes phone numbers / ARNs easier to read
          text-sm font-semibold text-[#3b1a3b] → 14px semi-bold dark plum
        */}
        <p className="font-mono text-sm font-semibold text-[#3b1a3b]">
          {pkValue}
        </p>
      </div>

      {/* ── Options button + dropdown ───────────────────────────── */}
      {/*
        relative wrapper with menuRef — the dropdown uses absolute positioning
        relative to this div so it floats correctly below the button.
      */}
      <div className="relative" ref={menuRef}>
        {/*
          ⋮ Options button — toggles menuOpen on click.
          disabled={busy} → cannot be clicked while a fetch/delete is running.

          Tailwind classes (normal, not busy):
            p-1.5 rounded-lg    → small padded round button area
            text-[#8b6b8b]      → muted purple icon colour
            hover:bg-[#e8d8e8]  → light mauve background on hover
            hover:text-[#3b1a3b] → icon darkens on hover
            cursor-pointer      → hand cursor

          Tailwind classes (busy):
            text-[#a090a0]  → lighter grey-purple (disabled look)
            cursor-default  → no hand cursor
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
          {/*
            Icon: spinning loader when busy, three dots (⋮) when normal.
            animate-spin — Tailwind class that adds a CSS rotation animation
          */}
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
          Normal dropdown menu — shown when menuOpen=true and NOT in confirm mode.
          absolute right-0 top-full mt-1 → floats below the button, right-aligned
          bg-white border border-[#d4c4d4] rounded-xl shadow-lg z-20
            → white card with mauve border, big shadow, above other content
          py-1 min-w-35 overflow-hidden → compact vertical padding, minimum width

          Menu items:
            Open      → dark plum text, light mauve hover background
            Duplicate → same as Open
            Divider   → thin mauve horizontal rule (h-px bg-[#e8d8e8])
            Delete    → red text, red hover background (visually dangerous action)
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
            {onDuplicate && (
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
            )}
            {onDelete && (
              <>
                <div className="h-px bg-[#e8d8e8] mx-2 my-1" />
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/*
          Delete confirmation panel — replaces the dropdown when confirmingDelete=true.
          absolute right-0 top-full mt-1 → same position as the dropdown
          border border-red-200 → red border to signal danger
          p-3 min-w-45          → slightly wider and padded for the confirm buttons

          "Yes, Delete" → calls onDelete(pkValue) which TableSearch handles
          "Cancel"      → hides this panel, goes back to normal menu state
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
