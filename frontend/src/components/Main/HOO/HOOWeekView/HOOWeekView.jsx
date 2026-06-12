import { useState, useEffect } from "react";
import DaySlot from "./DaySlot/DaySlot.jsx";
import HOOForm from "../HOOForm/HOOForm.jsx";
import { buildFormValues } from "../buildFormValues.js";
import { getQueueRecords, deleteHooRecord } from "../../api/hoo.js";
import { useUser } from "../../../../context/UserContext.jsx";

/*
  HOOWeekView.jsx — the 7-column week grid for HOO records.

  Used by: HOOModal (view === "week") after the user selects a queue.

  TWO DISPLAY MODES (controlled by hooConfig.id === "schedule")
  ─────────────────────────────────────────────────────────────
  SCHEDULE mode (hooConfig.id === "schedule"):
    Columns = Mon | Tue | Wed | Thu | Fri | Sat | Sun (fixed, no dates)
    sortKey = "dayOfWeek" — records are grouped by day name string
    No navigation arrows, no date picker panel

  EXCEPTION mode (hooConfig.id !== "schedule", e.g. "exception"):
    Columns = 7 actual calendar dates for the currently visible week
    sortKey = "exceptionDate" — records are grouped by "MM/DD/YYYY" date string
    Navigation arrows let the user move week by week (weekOffset state)
    "Select Date" button opens a right-side panel with a date picker and
    a summary list of all exception records visible in the current week

  API CALL: getQueueRecords
  ─────────────────────────
  On mount (via useEffect) this component calls getQueueRecords() to fetch
  all HOO records for selectedQueue.queueArn from DynamoDB.
  key={selectedQueue?.queueArn} on the parent (HOOModal) forces a full
  remount when a different queue is selected, so useEffect re-fires and
  fresh records are loaded — no stale data from the previous queue.

  INLINE FORM PANEL
  ─────────────────
  When the user clicks "+ Create", "Edit", or "Duplicate" on any DaySlot,
  an InlineFormPanel slides in BELOW the 7-column grid (not a new screen).
  The grid area shrinks to maxHeight 34% so both grid and form are visible.
  The currently active day's DaySlot column gets isActive=true which adds
  a rose border + ring glow to show which day is being edited.

  PROPS
  ─────
  hooConfig     — full config object from schema.json (id, tableName, fields, keys)
  selectedQueue — { queueArn, queueName } for the queue whose records are shown
*/

/*
  getWeekStart — returns the Monday of the week containing `date`.
  JavaScript's getDay() returns 0 for Sunday and 1–6 for Mon–Sat.
  The formula `day === 0 ? -6 : 1 - day` shifts any date back to Monday:
    Monday (1)  → diff =  0  (no change)
    Tuesday (2) → diff = -1
    Sunday (0)  → diff = -6
  setHours(0,0,0,0) strips the time component so comparisons are date-only.
*/
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* addDays — returns a new Date that is `n` days after `date` */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/*
  toDateStr — converts a Date object to the MM/DD/YYYY format used in DynamoDB.
  padStart(2,"0") ensures single-digit months/days get a leading zero
  (e.g. June → "06", the 3rd → "03").
*/
function toDateStr(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}/${d}/${date.getFullYear()}`;
}

/*
  formatWeekLabel — returns a readable week range string for the navigation bar.
  Example: "Jun 2 – Jun 8, 2025"
  addDays(weekStart, 6) gives the Sunday that ends the week.
*/
function formatWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekStart.getFullYear()}`;
}

export default function HOOWeekView({
  hooConfig,
  resourceType,
  selectedQueue,
}) {
  const { canWrite } = useUser();
  const isSchedule = hooConfig.id === "schedule";
  const slotKey = hooConfig.sortKey;
  const DAYS_OF_WEEK = hooConfig.fields?.find((f) => f.id === "dayOfWeek")
    ?.options ?? [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  /*
    records              — all HOO records for this queue from DynamoDB
    fetchLoading         — true while the initial API call is in flight
    weekOffset           — how many weeks forward/back from today (0 = current week)
    inlineForm           — null when no form is open; object when open:
                             { mode: "create"|"edit"|"duplicate", label, initialValues }
    showPanel            — true when the right-side "Select Date" panel is open
    panelDate            — the value of the date input inside the panel (YYYY-MM-DD)
    confirmDeleteSortKey — the sortKey of the record currently awaiting delete
                           confirmation in the right panel (null = no confirm showing)
    deleteError          — string error message if a delete API call fails
  */
  const [records, setRecords] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [inlineForm, setInlineForm] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [panelDate, setPanelDate] = useState("");
  const [confirmDeleteSortKey, setConfirmDeleteSortKey] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const queueArn = selectedQueue?.queueArn;

  /*
    Initial data fetch — runs once when the component mounts.
    key={selectedQueue?.queueArn} on HOOModal forces a fresh mount each time
    a new queue is selected, so this effect always loads the right queue's data.
    getQueueRecords fetches all records for this queue from DynamoDB.
    setFetchLoading(false) in the finally block hides the loading spinner
    whether the fetch succeeded or failed.
  */
  useEffect(() => {
    if (!queueArn) return;
    getQueueRecords(hooConfig.tableName, queueArn, hooConfig.partitionKey)
      .then(setRecords)
      .finally(() => setFetchLoading(false));
  }, [queueArn, hooConfig]);

  /*
    openEdit — opens the inline form panel in edit mode for an existing record.
    Sets inlineForm with mode="edit", the slotKey value as the label (used to
    show which day/date is being edited in the panel header and to highlight the
    correct DaySlot column with isActive=true), and pre-filled field values.
  */
  const openEdit = (record) => {
    setInlineForm({
      mode: "edit",
      label: record[slotKey],
      initialValues: buildFormValues(hooConfig, record),
    });
  };

  /*
    openDuplicate — opens the inline form in duplicate mode.
    Copies all field values from the record, then clears the partition key,
    sort key, and GSI key back to their defaults so the user must supply new
    unique key values before creating. This prevents a 409 conflict.
  */
  const openDuplicate = (record) => {
    const vals = buildFormValues(hooConfig, record);
    const clearIds = [
      hooConfig.partitionKey,
      hooConfig.GSIKey,
      hooConfig.sortKey,
    ].filter(Boolean);
    clearIds.forEach((id) => {
      const field = hooConfig.fields?.find((f) => f.id === id);
      const def = field?.defaultValue ?? "";
      vals[id] =
        field?.type === "boolean" ? def === true || def === "true" : def;
    });
    setInlineForm({
      mode: "duplicate",
      label: record[slotKey],
      initialValues: vals,
    });
  };

  /*
    openCreate — opens the inline form in create mode for a specific day/date.
    Pre-fills the partition key (queueArn) and GSI key (queueName) from the
    currently selected queue, and sets the sort key to the clicked slot value
    (e.g. "Monday" or "06/25/2025") so the user doesn't have to type those.
  */
  const openCreate = (slotValue) => {
    const vals = buildFormValues(hooConfig, null);
    vals[hooConfig.partitionKey] = selectedQueue?.queueArn ?? "";
    vals[hooConfig.GSIKey] = selectedQueue?.queueName ?? "";
    vals[slotKey] = slotValue;
    setInlineForm({ mode: "create", label: slotValue, initialValues: vals });
  };

  /*
    handleFormDone — called by HOOForm after a successful create/edit.
    Re-fetches all records from the API to pick up the change, then closes
    the inline form panel. This ensures the grid always shows fresh data.
  */
  const handleFormDone = async () => {
    const refreshed = await getQueueRecords(
      hooConfig.tableName,
      selectedQueue.queueArn,
      hooConfig.partitionKey,
    );
    setRecords(refreshed);
    setInlineForm(null);
  };

  /*
    handleDelete — called when the user confirms deletion on a DaySlot card
    or in the right-side panel's record list.
    1. Calls deleteHooRecord API (throws on failure)
    2. If the deleted record's form was open, closes the inline form
    3. Re-fetches records to update the grid
    4. On failure: sets deleteError which shows a red banner
  */
  const handleDelete = async (record) => {
    const recQueueArn = record[hooConfig.partitionKey];
    const sortValue = record[slotKey];
    setDeleteError(null);
    try {
      await deleteHooRecord(
        hooConfig.tableName,
        recQueueArn,
        sortValue,
        hooConfig.partitionKey,
        hooConfig.sortKey,
      );
      if (inlineForm?.label === sortValue) setInlineForm(null);
      const refreshed = await getQueueRecords(
        hooConfig.tableName,
        selectedQueue.queueArn,
        hooConfig.partitionKey,
      );
      setRecords(refreshed);
    } catch {
      setDeleteError("Delete failed — please try again.");
    }
  };

  /*
    handlePanelDateChange — called when the user picks a date in the right panel.
    Converts the picked date to a weekOffset so the grid navigates to that week.
    Formula: (weekStart of target − weekStart of today) / milliseconds in 7 days
    Math.round handles DST changes which make some weeks ≠ exactly 7×24×60×60×1000 ms.
  */
  const handlePanelDateChange = (isoDate) => {
    setPanelDate(isoDate);
    if (!isoDate) return;
    const target = new Date(isoDate + "T00:00:00");
    const todayBase = new Date();
    todayBase.setHours(0, 0, 0, 0);
    const diff =
      getWeekStart(target).getTime() - getWeekStart(todayBase).getTime();
    setWeekOffset(Math.round(diff / (7 * 24 * 60 * 60 * 1000)));
  };

  if (fetchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8b6b8b] text-sm">
        Loading records…
      </div>
    );
  }

  // ── Schedule view ─────────────────────────────────────────────────────────

  if (isSchedule) {
    const byDay = {};
    records.forEach((r) => {
      const key = r[slotKey];
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(r);
    });

    return (
      <div
        id="hoo-week-view-schedule"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div
          className="overflow-y-auto px-8 py-3"
          style={{
            flex: inlineForm ? "0 0 auto" : "1 1 auto",
            maxHeight: inlineForm ? "34%" : undefined,
          }}
        >
          <p className="text-xs text-[#8b6b8b] mb-3">
            Weekly schedule for{" "}
            <span className="font-semibold text-[#3b1a3b]">
              {selectedQueue?.queueName}
            </span>
          </p>
          {deleteError && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {deleteError}
            </div>
          )}
          <div className="grid grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <DaySlot
                key={day}
                label={day.slice(0, 3)}
                sublabel={day}
                records={byDay[day] ?? []}
                isSchedule
                isActive={inlineForm?.label === day}
                onEdit={canWrite(resourceType) ? openEdit : null}
                onCreate={canWrite(resourceType) ? () => openCreate(day) : null}
                onDelete={canWrite(resourceType) ? handleDelete : null}
                onDuplicate={canWrite(resourceType) ? openDuplicate : null}
                onView={openEdit}
              />
            ))}
          </div>
        </div>
        {inlineForm && (
          <InlineFormPanel
            key={inlineForm.label}
            inlineForm={inlineForm}
            hooConfig={hooConfig}
            resourceType={resourceType}
            onClose={() => setInlineForm(null)}
            onDone={handleFormDone}
          />
        )}
      </div>
    );
  }

  // ── Exception view ────────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const baseWeekStart = getWeekStart(today);
  const weekStart = addDays(baseWeekStart, weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDate = {};
  records.forEach((r) => {
    const key = r[slotKey];
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });
  const todayStr = toDateStr(today);

  const visibleWeekRecords = weekDates.flatMap((date) =>
    (byDate[toDateStr(date)] ?? []).map((r) => ({
      ...r,
      _dateStr: toDateStr(date),
      _dateObj: date,
    })),
  );

  return (
    <div
      id="hoo-week-view-exceptions"
      className="flex-1 flex flex-col overflow-hidden"
    >
      <div
        className="flex flex-row overflow-hidden"
        style={{
          flex: inlineForm ? "0 0 auto" : "1 1 auto",
          maxHeight: inlineForm ? "34%" : undefined,
        }}
      >
        {/* Grid */}
        <div
          className={`flex-1 min-w-0 overflow-y-auto py-3 ${showPanel ? "px-4" : "px-8"}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer shrink-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 text-center min-w-0">
              <span className="text-sm font-semibold text-[#3b1a3b]">
                {formatWeekLabel(weekStart)}
              </span>
              {weekOffset === 0 && (
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Current Week
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer shrink-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowPanel((p) => !p)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer
                ${
                  showPanel
                    ? "bg-rose-700 text-white border-rose-800 hover:bg-rose-900"
                    : "bg-white text-[#5b2d5b] border-[#d4c4d4] hover:border-rose-400 hover:text-rose-700"
                }`}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {showPanel ? "Hide Panel" : "Select Date"}
            </button>
          </div>
          <p className="text-xs text-[#8b6b8b] mb-2">
            Exceptions for{" "}
            <span className="font-semibold text-[#3b1a3b]">
              {selectedQueue?.queueName}
            </span>
          </p>
          {deleteError && (
            <div className="mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {deleteError}
            </div>
          )}
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const dateStr = toDateStr(date);
              return (
                <DaySlot
                  key={dateStr}
                  label={date.toLocaleDateString("en-US", { weekday: "short" })}
                  sublabel={date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  records={byDate[dateStr] ?? []}
                  isToday={dateStr === todayStr}
                  isSchedule={false}
                  isActive={inlineForm?.label === dateStr}
                  onEdit={canWrite(resourceType) ? openEdit : null}
                  onCreate={
                    canWrite(resourceType) ? () => openCreate(dateStr) : null
                  }
                  onDelete={canWrite(resourceType) ? handleDelete : null}
                  onDuplicate={canWrite(resourceType) ? openDuplicate : null}
                  onView={openEdit}
                />
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        {showPanel && (() => {
          // All exceptions for this queue sorted chronologically
          const parseSlotDate = (s) => {
            if (!s) return new Date("invalid");
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
              const [m, d, y] = s.split("/");
              return new Date(`${y}-${m}-${d}T00:00:00`);
            }
            return new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
          };
          const allSorted = [...records].sort(
            (a, b) => parseSlotDate(a[slotKey]) - parseSlotDate(b[slotKey]),
          );

          // Navigate to the week containing a record and open it
          const handleRecordOpen = (record) => {
            const d = parseSlotDate(record[slotKey]);
            if (!isNaN(d)) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              handlePanelDateChange(`${y}-${m}-${day}`);
            }
            openEdit(record);
          };

          return (
            <div className="w-80 shrink-0 min-h-0 border-l border-[#d4c4d4] bg-[#faf7fa] flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-4 border-b border-[#e4d4e4] bg-white">
                <p className="text-xs font-semibold text-[#5b2d5b] mb-2">
                  Jump to week
                </p>
                <input
                  type="date"
                  value={panelDate}
                  onChange={(e) => handlePanelDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm text-[#3b1a3b] bg-white border border-[#d4c4d4] rounded-lg focus:outline-none focus:border-rose-400"
                />
                <p className="text-[10px] text-[#a090a0] mt-1.5">
                  Pick any date to navigate to that week
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-scroll px-4 py-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-[#3b1a3b]">
                  {allSorted.length === 0
                    ? "No exceptions for this queue"
                    : `All exceptions — ${allSorted.length} total`}
                </p>

                {allSorted.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#f0e8f0] flex items-center justify-center mb-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b6b8b" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    </div>
                    <p className="text-xs text-[#a090a0]">
                      No holidays or exceptions scheduled.
                    </p>
                  </div>
                ) : (
                  allSorted.map((record, idx) => {
                    const p = record.payload ?? {};
                    const dateObj = parseSlotDate(record[slotKey]);
                    const isCurrentWeek = visibleWeekRecords.some(
                      (r) => r[slotKey] === record[slotKey]
                    );

                    return (
                      <div
                        key={`${idx}-${record[slotKey]}`}
                        onClick={() => handleRecordOpen(record)}
                        className="bg-white rounded-xl border border-[#e4d4e4] overflow-hidden cursor-pointer group hover:border-rose-300 hover:shadow-sm transition-all"
                      >
                        <div className="px-3 py-2 bg-[#f5f0f5] border-b border-[#e4d4e4] flex items-center justify-between group-hover:bg-[#ede4ed] transition-colors">
                          <span className="text-xs font-bold text-[#5b2d5b]">
                            {isNaN(dateObj)
                              ? record[slotKey]
                              : dateObj.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isCurrentWeek && (
                              <span className="text-[9px] font-semibold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">
                                This week
                              </span>
                            )}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0b0c0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-rose-400 transition-colors">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </div>
                        </div>

                        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#3b1a3b] truncate">
                            {p.exceptionType ?? "Exception"}
                          </span>
                          {p.fullClose && (
                            <span className="shrink-0 text-[9px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded">
                              Full Close
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {inlineForm && (
        <InlineFormPanel
          key={inlineForm.label}
          inlineForm={inlineForm}
          hooConfig={hooConfig}
          resourceType={resourceType}
          onClose={() => setInlineForm(null)}
          onDone={handleFormDone}
        />
      )}
    </div>
  );
}

/*
  InlineFormPanel — the form panel that slides in below the 7-column grid.

  Rendered inside HOOWeekView when inlineForm state is not null.
  It does NOT navigate to a new screen — it appears within the same view so
  the user can still see the week grid above (shrunk to max 34% height).

  STRUCTURE
  ─────────
  • A header bar with the mode label ("Edit — Monday", "New Record — Jun 5")
    and a ✕ close button that sets inlineForm=null
  • The full HOOForm component below the header

  key={inlineForm.label} on the parent InlineFormPanel (set in HOOWeekView)
  forces a fresh remount when the user switches from editing one day to another,
  clearing all form state (errors, dirty check, etc.) automatically.

  PROPS
  ─────
  inlineForm  — { mode, label, initialValues } from HOOWeekView state
  hooConfig   — passed straight through to HOOForm
  onClose     — sets inlineForm=null, collapses the panel
  onDone      — called after successful save; refreshes records and collapses panel
*/
function InlineFormPanel({
  inlineForm,
  hooConfig,
  resourceType,
  onClose,
  onDone,
}) {
  return (
    /*
      Panel wrapper — sits below the grid in the flex column layout.
      flex-1 flex flex-col overflow-hidden → fills remaining height
      border-t-2 border-[#c8b8c8]         → thick mauve top border visually
                                             separates the panel from the grid
      bg-[#ede5ed]                         → slightly darker lavender than the
                                             modal background to differentiate it
    */
    <div className="flex-1 flex flex-col overflow-hidden border-t-2 border-[#c8b8c8] bg-[#ede5ed]">
      {/*
        Panel header — shows the mode + day label and the close button.
        shrink-0 → stays fixed height; HOOForm below scrolls if needed
        border-b border-[#d4c4d4] → thin mauve bottom divider
      */}
      <div className="shrink-0 flex items-center justify-between px-8 py-3 border-b border-[#d4c4d4]">
        {/*
          Mode label — tells the user what they are doing and for which day/date.
          Examples: "Edit — Monday", "Duplicate — Jun 5", "New Record — Friday"
        */}
        <span className="text-sm font-semibold text-[#3b1a3b]">
          {(() => {
            let prefix;
            if (inlineForm.mode === "edit") prefix = "Edit";
            else if (inlineForm.mode === "duplicate") prefix = "Duplicate";
            else prefix = "New Record";
            return `${prefix} — ${inlineForm.label}`;
          })()}
        </span>

        {/*
          Close (✕) button — collapses the form panel back to the full-height grid.
          p-1.5 rounded-lg → small round button area
          hover:bg-[#d4c8d4] → light mauve hover background
          aria-label="Close" → accessible label for screen readers
        */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#8b6b8b] hover:bg-[#d4c8d4] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/*
        HOOForm — the actual form component rendered inside this panel.
        Receives the same props it would get in full-screen form mode.
        onCancel={onClose} → Cancel collapses the panel (same as the ✕ button)
        onDone={onDone}    → success refreshes the grid records
      */}
      <HOOForm
        hooConfig={hooConfig}
        resourceType={resourceType}
        formMode={inlineForm.mode}
        initialValues={inlineForm.initialValues}
        onDone={onDone}
        onCancel={onClose}
      />
    </div>
  );
}
