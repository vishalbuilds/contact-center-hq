/*
  ModalHeader.jsx — the top bar that appears inside every modal (Table and HOO).

  Used by: TableModal.jsx and HOOModal.jsx — both modals share this same
  header component so the look and feel is consistent across the whole app.

  WHAT IT SHOWS
  ─────────────
  Left side:
    • optional ← back arrow button (only shown when onBack is provided)
    • the modal title  (e.g. "Queue Schedule Table Config")
    • optional badge   (e.g. the selected queue name pill in HOO week view)
    • optional mode badge showing "Creating", "Editing", or "Duplicating"
      in different colours depending on the current form mode
    • the modal description text below the title

  Right side:
    • a "Cancel" button that closes the modal entirely

  MODE BADGE COLOURS
  ──────────────────
  create    →  blue  (bg-blue-100 text-blue-700 border-blue-200)
  duplicate →  amber (bg-amber-100 text-amber-700 border-amber-200)
  edit      →  green (bg-green-100 text-green-700 border-green-200)

  PROPS
  ─────
  title       — the modal's main heading (from schema.json item.title)
  description — sub-heading text below the title (from schema.json item.description)
  formMode    — "create" | "edit" | "duplicate" | undefined. When undefined
                (search screen) no mode badge is shown
  onBack      — function to call when ← is clicked; if undefined the back
                arrow is hidden entirely (search screen has no back button)
  onClose     — function to call when "Cancel" is clicked; always provided,
                closes the modal and returns to the card grid
  badge       — any extra React node to display next to the title; used in
                HOOModal to show the selected queue name as a purple pill
*/
export default function ModalHeader({ title, description, formMode, onBack, onClose, badge }) {
  /*
    modeBadge — maps each formMode string to the label text and Tailwind
    colour classes for the badge pill. Kept as an object so adding a new
    mode in the future only requires one new entry here.
  */
  const modeBadge = {
    create:    { label: "Creating",    cls: "bg-blue-100 text-blue-700 border-blue-200"   },
    duplicate: { label: "Duplicating", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    edit:      { label: "Editing",     cls: "bg-green-100 text-green-700 border-green-200" },
  };

  return (
    /*
      Header wrapper — a horizontal bar pinned to the top of the modal.

      Tailwind classes:
        flex items-start justify-between → left group and Cancel button sit at
                                            opposite ends of the bar
        px-8 pt-6 pb-4  → 32px left/right, 24px top, 16px bottom padding
        border-b border-[#c8b8c8] → thin mauve divider line below the header
        shrink-0        → prevents the header from shrinking if content below overflows;
                           the body area scrolls instead of the header squishing
    */
    <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b border-[#c8b8c8] shrink-0">

      {/* ── Left group: back arrow + title + badges + description ── */}
      <div className="flex items-center gap-3">

        {/*
          Back arrow button — only rendered when onBack is provided.
          In HOOModal: shown when view is "week" or "form" (takes user back to search).
          In TableModal: shown when view is "form" (takes user back to search).
          When on the search screen: onBack is undefined so this button is hidden.

          Tailwind classes:
            p-1.5           → 6px padding around the SVG icon
            rounded-lg      → rounded button corners
            text-[#5b2d5b]  → medium purple icon colour
            hover:bg-[#d4c8d4] → light mauve background on hover
            transition-colors  → colour change animates smoothly
            cursor-pointer  → hand cursor on hover
        */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer"
            title="Back"
          >
            {/* Left-pointing arrow SVG icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        <div>
          {/*
            Title row — the main heading plus any optional badges side by side.
            flex items-center gap-2 flex-wrap → badges wrap to the next line if
            the title is very long, preventing overflow.
          */}
          <div className="flex items-center gap-2 flex-wrap">
            {/*
              Modal title — large bold dark-plum heading.
              text-xl font-bold → big, bold text
              text-[#3b1a3b]    → dark plum colour
            */}
            <h2 className="text-xl font-bold text-[#3b1a3b]">{title}</h2>

            {/*
              badge — any extra React node passed in by the parent.
              HOOModal passes a purple pill showing the selected queue name
              when the user is in the week view.
              TableModal does not pass a badge (null).
            */}
            {badge}

            {/*
              Form mode badge — shown when the user is on the form screen.
              Renders a small coloured pill: "Creating" (blue), "Editing" (green),
              or "Duplicating" (amber) so the user always knows what they are doing.

              Only renders when formMode is one of the known values AND the parent
              passed formMode as a prop (undefined on the search screen).

              Tailwind classes on the pill:
                text-xs font-semibold → small, semi-bold text inside the pill
                px-2 py-0.5          → tight horizontal/vertical padding
                rounded-full         → fully rounded pill shape
                border               → thin border in the badge colour
            */}
            {formMode && modeBadge[formMode] && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${modeBadge[formMode].cls}`}>
                {modeBadge[formMode].label}
              </span>
            )}
          </div>

          {/*
            Description — a short subtitle below the title.
            text-sm        → small text
            text-[#5b2d5b] → medium purple
            mt-0.5         → 2px gap above this line
          */}
          <p className="text-sm text-[#5b2d5b] mt-0.5">{description}</p>
        </div>
      </div>

      {/*
        Cancel button — always visible on the right side of the header.
        Clicking it calls onClose() which sets selected = null in Main.jsx,
        unmounting the whole modal.

        Tailwind classes:
          px-4 py-1.5        → comfortable click target size
          text-sm font-semibold → readable button label
          text-[#5b2d5b]     → medium purple text
          bg-[#d4c8d4]       → muted lavender background
          rounded-lg         → rounded corners
          border border-[#b8a8b8] → thin mauve border
          hover:bg-[#c0b0c0] → darker lavender on hover
          active:scale-95    → shrinks slightly when pressed (press feedback)
          transition-all duration-150 → all changes animate in 150ms
          cursor-pointer     → hand cursor
      */}
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-1.5 text-sm font-semibold text-[#5b2d5b] bg-[#d4c8d4] rounded-lg border border-[#b8a8b8] hover:bg-[#c0b0c0] active:scale-95 transition-all duration-150 cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
