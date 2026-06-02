import { useState } from "react";

/*
  DaySlot.jsx — a single column in the 7-day HOO week grid.

  Used by: HOOWeekView renders one DaySlot per day of the week (Mon–Sun).
  In schedule mode the labels are day names ("Mon", "Monday").
  In exception mode the labels are real calendar dates ("Mon", "Jun 3").

  WHAT IT SHOWS
  ─────────────
  • A day header (short label + sublabel, e.g. "MON" + "Jun 3")
  • If records exist: one RecordRow card per HOO record for that day
  • If no records: a small empty-state with a "+ Create" button

  VISUAL STATES
  ─────────────
  isActive (this day's inline form is currently open):
    border-rose-600 ring-2 ring-rose-300 bg-rose-50
    → rose border, glowing outline ring, pink background
  isToday (this column is today's date, exceptions only):
    border-rose-400 bg-rose-50
    → softer rose border, pink background (no ring)
  Normal:
    border-[#d4c4d4] bg-white
    → standard mauve border, white background

  PROPS
  ─────
  label      — short header text: day abbrev or weekday name ("MON", "Mon")
  sublabel   — secondary header: full day or date ("Monday", "Jun 3")
  records    — array of HOO record objects for this day (may be empty)
  isToday    — boolean; true when this column's date matches today (exceptions only)
  isSchedule — boolean; true for schedule mode, false for exceptions mode.
               Changes what RecordRow displays (time range vs exception type)
  isActive   — boolean; true when the inline form panel is open for this day
  onEdit     — called with the full record object when Edit is clicked
  onCreate   — called (no args) when "+ Create" is clicked
  onDelete   — called with the full record object when Delete is confirmed
  onDuplicate — called with the full record object when Duplicate is clicked
*/
export default function DaySlot({
  label, sublabel, records, isToday, isSchedule, isActive, onEdit, onCreate, onDelete, onDuplicate,
}) {
  const hasRecords = records.length > 0;

  return (
    /*
      Column container — the outer box for one day.
      The id is derived from the label so devtools can identify each column,
      e.g. id="hoo-day-slot-mon" or id="hoo-day-slot-monday"

      Tailwind classes:
        rounded-xl    → large rounded corners
        border        → border (colour from state conditional below)
        p-1.5         → 6px padding inside the column
        flex flex-col gap-1 → stacks header and record list vertically, 4px gaps
        min-h-16      → minimum 64px height so empty columns don't collapse
        transition-colors → border and background colour changes animate smoothly

      State-conditional border + background:
        isActive → rose border + ring glow + pink background
        isToday  → softer rose border + pink background
        normal   → mauve border + white background
    */
    <div
      id={`hoo-day-slot-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`rounded-xl border p-1.5 flex flex-col gap-1 min-h-16 transition-colors
        ${isActive
          ? "border-rose-600 ring-2 ring-rose-300 bg-rose-50"
          : isToday
            ? "border-rose-400 bg-rose-50"
            : "border-[#d4c4d4] bg-white"}`}
    >
      {/* ── Day header ─────────────────────────────────────────────── */}
      {/*
        flex items-baseline justify-between → label on left, sublabel on right,
                                              both aligned to their text baselines
      */}
      <div className="flex items-baseline justify-between">
        {/*
          Short label — the bold day abbreviation shown at the top of the column.
          "MON", "TUE" etc. for schedule; "Mon", "Tue" for exceptions.

          text-[11px] font-bold uppercase tracking-wide leading-none
            → very small all-caps bold text with wide letter spacing
          Colour: rose-700 when today, medium purple otherwise
        */}
        <span className={`text-[11px] font-bold uppercase tracking-wide leading-none ${isToday ? "text-rose-700" : "text-[#5b2d5b]"}`}>
          {label}
        </span>

        {/*
          Sublabel — smaller secondary text on the right side of the header.
          Schedule mode: the full day name ("Monday")
          Exception mode: the formatted date ("Jun 3")
          text-[9px] text-[#a090a0] leading-none → tiny grey-purple text
        */}
        <span className="text-[9px] text-[#a090a0] leading-none">{sublabel}</span>
      </div>

      {/* ── Records or empty state ──────────────────────────────────── */}
      {/*
        flex-1 flex flex-col gap-1 → fills remaining column height,
                                      stacks record cards with 4px gaps
      */}
      <div className="flex-1 flex flex-col gap-1">
        {hasRecords ? (
          /*
            Records exist — render one RecordRow for each HOO record.
            The index `i` is used as the key since records don't have a
            guaranteed unique local id in this context.
          */
          records.map((record, i) => (
            <RecordRow
              key={i}
              record={record}
              isSchedule={isSchedule}
              onEdit={() => onEdit(record)}
              onDelete={() => onDelete(record)}
              onDuplicate={() => onDuplicate(record)}
            />
          ))
        ) : (
          /*
            Empty state — shown when this day has no HOO records yet.
            Centred vertically and horizontally within the column.

            flex-1 flex flex-col items-center justify-center gap-1
              → takes all remaining height, centres content

            "+ Create" button:
              text-[9px] font-semibold text-rose-600 → tiny bold rose-red text
              px-1.5 py-0.5 rounded → very compact pill shape
              border border-rose-200 hover:border-rose-400 → rose border that
              darkens on hover
              transition-colors → smooth border colour change
          */
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className="text-[9px] text-[#c0b0c0]">
              {isSchedule ? "No schedule" : "No exception"}
            </span>
            <button
              type="button"
              onClick={onCreate}
              className="text-[9px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer px-1.5 py-0.5 rounded border border-rose-200 hover:border-rose-400 transition-colors"
            >
              + Create
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/*
  RecordRow — a single HOO record card inside a DaySlot column.

  Shows a compact summary of one record with inline Edit / Duplicate / Delete
  action buttons. When Delete is clicked a confirmation overlay appears on top
  of the card so the user cannot accidentally delete a record.

  SCHEDULE vs EXCEPTION display:
    isSchedule=true  → shows "startTime–endTime" + timezone + VM badges
    isSchedule=false → shows exceptionType + description + "Full Close" badge + VM badges

  DELETE CONFIRMATION OVERLAY
  ───────────────────────────
  When the user clicks Delete, confirmingDelete state flips to true.
  An absolutely-positioned overlay covers the entire card:
    absolute inset-0 z-10 → covers the whole card, sits above everything
    bg-white/95           → nearly opaque white (95% opacity)
  Two buttons: "Yes" (red, confirms delete) and "No" (mauve, dismisses overlay).
  Clicking Yes calls onDelete() which bubbles up through DaySlot → HOOWeekView
  → handleDelete → deleteHooRecord API call.

  PROPS
  ─────
  record     — the full HOO record object from DynamoDB
  isSchedule — boolean; controls which fields are displayed
  onEdit     — called when Edit is clicked
  onDelete   — called when "Yes" is clicked in the delete confirmation
  onDuplicate — called when Duplicate is clicked
*/
function RecordRow({ record, isSchedule, onEdit, onDelete, onDuplicate }) {
  /* payload — all the isPayload fields live here (startTime, endTime, etc.) */
  const p = record.payload ?? {};

  /*
    confirmingDelete — true while the delete confirmation overlay is showing.
    Starts false; flips to true when "Delete" is clicked; back to false when
    "No" is clicked or the delete completes.
  */
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /*
    actionButtons — shared Edit · Duplicate · Delete row used in both
    schedule and exception display modes. Defined once to avoid duplication.

    Buttons use dot separators (·) between them.
    Each button is tiny (text-[9px]) because the columns are very narrow.
    Colours: Edit=rose, Duplicate=violet, Delete=red
  */
  const actionButtons = (
    <div className="flex items-center gap-1.5 shrink-0">
      <button type="button" onClick={onEdit}
        className="text-[9px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer">
        Edit
      </button>
      <span className="text-[9px] text-[#c0b0c0]">·</span>
      <button type="button" onClick={onDuplicate}
        className="text-[9px] font-semibold text-violet-600 hover:text-violet-800 cursor-pointer">
        Duplicate
      </button>
      <span className="text-[9px] text-[#c0b0c0]">·</span>
      <button type="button" onClick={() => setConfirmingDelete(true)}
        className="text-[9px] font-semibold text-red-500 hover:text-red-700 cursor-pointer">
        Delete
      </button>
    </div>
  );

  return (
    /*
      Card wrapper — the white rounded rectangle containing the record data.
      relative → needed so the delete overlay (absolute inset-0) positions
                 itself relative to this card and not the whole page
      overflow-hidden → clips the overlay's rounded corners to match the card
      min-h-13.5      → minimum height so very short records don't look cramped
    */
    <div className="relative rounded bg-white/80 border border-[#e4d4e4] px-1.5 py-1 flex flex-col gap-0.5 overflow-hidden min-h-13.5">

      {/*
        Delete confirmation overlay — shown when confirmingDelete=true.
        Covers the whole card with a near-opaque white background.
        absolute inset-0 z-10 → positioned over the entire card
        bg-white/95           → 95% opaque so the card content is barely visible underneath
        flex flex-col items-center justify-center → centres the prompt text and buttons
      */}
      {confirmingDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-white/95 rounded px-2">
          <span className="text-[9px] font-semibold text-[#3b1a3b] text-center leading-tight">Delete this entry?</span>
          <div className="flex gap-1.5">
            {/* Yes — confirms the delete; closes overlay and calls onDelete */}
            <button
              type="button"
              onClick={() => { setConfirmingDelete(false); onDelete(); }}
              className="text-[9px] font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Yes
            </button>
            {/* No — cancels; hides the overlay without deleting */}
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-[9px] font-semibold text-[#5b2d5b] bg-[#e8d8e8] hover:bg-[#d4c4d4] px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/*
        SCHEDULE display — shown when isSchedule=true.
        Shows: "09:00–17:00" time range + timezone + VM badge pills
        font-mono on the time range makes the colons and digits align neatly.
      */}
      {isSchedule ? (
        <>
          <div className="flex items-center justify-between gap-1">
            {/* Time range: startTime – endTime in monospace font */}
            <span className="text-[10px] font-mono font-semibold text-[#3b1a3b] leading-tight truncate">
              {p.startTime ?? "—"}–{p.endTime ?? "—"}
            </span>
            {actionButtons}
          </div>
          {/* Timezone below the time range */}
          <div className="text-[9px] text-[#8b6b8b] leading-tight truncate">{p.timezone ?? ""}</div>
          {/* VM feature badges — only shown when the boolean flags are true */}
          {(p.vmMenu || p.offerVm) && (
            <div className="flex gap-1 flex-wrap">
              {p.vmMenu  && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">VM&nbsp;Menu</span>}
              {p.offerVm && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">Offer&nbsp;VM</span>}
            </div>
          )}
        </>
      ) : (
        /*
          EXCEPTION display — shown when isSchedule=false.
          Shows: exceptionType title + description + "Full Close" badge + VM badges
        */
        <>
          <div className="flex items-center justify-between gap-1">
            {/* Exception type (e.g. "Holiday", "InvokeMeeting") */}
            <span className="text-[10px] font-semibold text-[#3b1a3b] leading-tight truncate">
              {p.exceptionType ?? "Exception"}
            </span>
            {actionButtons}
          </div>
          {/* Description — clamped to 2 lines so the card stays compact */}
          {p.description && (
            <div className="text-[9px] text-[#5b2d5b] leading-tight line-clamp-2">{p.description}</div>
          )}
          {/*
            Full Close badge — shown only when p.fullClose=true.
            bg-rose-50 text-rose-600 border border-rose-200 → soft red pill
            self-start → aligns to the left edge of the flex column
          */}
          {p.fullClose && (
            <span className="text-[8px] bg-rose-50 text-rose-600 border border-rose-200 px-1 rounded self-start">Full&nbsp;Close</span>
          )}
          {/* VM feature badges */}
          <div className="flex gap-1 flex-wrap">
            {p.vmMenu  && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">VM&nbsp;Menu</span>}
            {p.offerVm && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">Offer&nbsp;VM</span>}
          </div>
        </>
      )}
    </div>
  );
}
