import { useState, useEffect } from "react";
import DaySlot from "./DaySlot/DaySlot.jsx";
import HOOForm from "../HOOForm/HOOForm.jsx";
import { buildFormValues } from "../buildFormValues.js";
import { getQueueRecords, deleteHooRecord } from "../../api/hoo.js";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}/${d}/${date.getFullYear()}`;
}

function formatWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekStart.getFullYear()}`;
}

export default function HOOWeekView({ hooConfig, selectedQueue }) {
  const isSchedule = hooConfig.id === "schedule";
  const slotKey = hooConfig.sortKey;

  const [records, setRecords] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [inlineForm, setInlineForm] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [panelDate, setPanelDate] = useState("");
  const [confirmDeleteSortKey, setConfirmDeleteSortKey] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const queueArn = selectedQueue?.queueArn;

  useEffect(() => {
    if (!queueArn) return;
    // fetchLoading/fetchError are already at their initial values on mount
    // (component is keyed on queueArn so it remounts on queue change).
    getQueueRecords(hooConfig.tableName, queueArn, hooConfig.partitionKey)
      .then(setRecords)
      .catch(() => setFetchError("Failed to load records — check your connection and try again."))
      .finally(() => setFetchLoading(false));
  }, [queueArn, hooConfig]);

  const openEdit = (record) => {
    setInlineForm({
      mode: "edit",
      label: record[slotKey],
      initialValues: buildFormValues(hooConfig, record),
    });
  };

  const openDuplicate = (record) => {
    const vals = buildFormValues(hooConfig, record);
    const clearIds = [hooConfig.partitionKey, hooConfig.GSIKey, hooConfig.sortKey].filter(Boolean);
    clearIds.forEach((id) => {
      const field = hooConfig.fields?.find((f) => f.id === id);
      const def = field?.defaultValue ?? "";
      vals[id] = field?.type === "boolean" ? (def === true || def === "true") : def;
    });
    setInlineForm({
      mode: "duplicate",
      label: record[slotKey],
      initialValues: vals,
    });
  };

  const openCreate = (slotValue) => {
    const vals = buildFormValues(hooConfig, null);
    vals[hooConfig.partitionKey] = selectedQueue?.queueArn ?? "";
    vals[hooConfig.GSIKey] = selectedQueue?.queueName ?? "";
    vals[slotKey] = slotValue;
    setInlineForm({ mode: "create", label: slotValue, initialValues: vals });
  };

  const handleFormDone = async () => {
    const refreshed = await getQueueRecords(hooConfig.tableName, selectedQueue.queueArn, hooConfig.partitionKey);
    setRecords(refreshed);
    setInlineForm(null);
  };

  const handleDelete = async (record) => {
    const recQueueArn = record[hooConfig.partitionKey];
    const sortValue = record[slotKey];
    setDeleteError(null);
    try {
      await deleteHooRecord(hooConfig.tableName, recQueueArn, sortValue, hooConfig.partitionKey, hooConfig.sortKey);
      if (inlineForm?.label === sortValue) setInlineForm(null);
      // Optimistic removal — update local state immediately so the UI responds
      // even if the follow-up refresh fails (e.g. transient network issue).
      setRecords((prev) =>
        prev.filter((r) => r[slotKey] !== sortValue || r[hooConfig.partitionKey] !== recQueueArn)
      );
      // Best-effort refresh to pick up any concurrent changes.
      getQueueRecords(hooConfig.tableName, selectedQueue.queueArn, hooConfig.partitionKey)
        .then(setRecords)
        .catch(() => {}); // optimistic removal already applied — ignore refresh failures
    } catch {
      setDeleteError("Delete failed — please try again.");
    }
  };

  const handlePanelDateChange = (isoDate) => {
    setPanelDate(isoDate);
    if (!isoDate) return;
    const target = new Date(isoDate + "T00:00:00");
    const todayBase = new Date();
    todayBase.setHours(0, 0, 0, 0);
    const diff = getWeekStart(target).getTime() - getWeekStart(todayBase).getTime();
    setWeekOffset(Math.round(diff / (7 * 24 * 60 * 60 * 1000)));
  };

  if (fetchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8b6b8b] text-sm">
        Loading records…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {fetchError}
        </div>
      </div>
    );
  }

  if (isSchedule) {
    const byDay = {};
    records.forEach((r) => {
      const key = r[slotKey];
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(r);
    });

    return (
      <div id="hoo-week-view-schedule" className="flex-1 flex flex-col overflow-hidden">
        <div
          className="overflow-y-auto px-8 py-3"
          style={{ flex: inlineForm ? "0 0 auto" : "1 1 auto", maxHeight: inlineForm ? "34%" : undefined }}
        >
          <p className="text-xs text-[#8b6b8b] mb-3">
            Weekly schedule for{" "}
            <span className="font-semibold text-[#3b1a3b]">{selectedQueue?.queueName}</span>
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
                onEdit={openEdit}
                onCreate={() => openCreate(day)}
                onDelete={handleDelete}
                onDuplicate={openDuplicate}
                partitionKey={hooConfig.partitionKey}
              />
            ))}
          </div>
        </div>
        {inlineForm && (
          <InlineFormPanel
            key={inlineForm.label}
            inlineForm={inlineForm}
            hooConfig={hooConfig}
            onClose={() => setInlineForm(null)}
            onDone={handleFormDone}
          />
        )}
      </div>
    );
  }

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
    (byDate[toDateStr(date)] ?? []).map((r) => ({ ...r, _dateStr: toDateStr(date), _dateObj: date }))
  );

  return (
    <div id="hoo-week-view-exceptions" className="flex-1 flex flex-col overflow-hidden">
      <div
        className="flex flex-row overflow-hidden"
        style={{ flex: inlineForm ? "0 0 auto" : "1 1 auto", maxHeight: inlineForm ? "34%" : undefined }}
      >
        <div className={`flex-1 min-w-0 overflow-y-auto py-3 ${showPanel ? "px-4" : "px-8"}`}>
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="flex-1 text-center min-w-0">
              <span className="text-sm font-semibold text-[#3b1a3b]">{formatWeekLabel(weekStart)}</span>
              {weekOffset === 0 && (
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Current Week
                </span>
              )}
            </div>
            <button type="button" onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button type="button" onClick={() => setShowPanel((p) => !p)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer
                ${showPanel ? "bg-rose-700 text-white border-rose-800 hover:bg-rose-900"
                  : "bg-white text-[#5b2d5b] border-[#d4c4d4] hover:border-rose-400 hover:text-rose-700"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {showPanel ? "Hide Panel" : "Select Date"}
            </button>
          </div>
          <p className="text-xs text-[#8b6b8b] mb-2">
            Exceptions for <span className="font-semibold text-[#3b1a3b]">{selectedQueue?.queueName}</span>
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
                  sublabel={date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  records={byDate[dateStr] ?? []}
                  isToday={dateStr === todayStr}
                  isSchedule={false}
                  isActive={inlineForm?.label === dateStr}
                  onEdit={openEdit}
                  onCreate={() => openCreate(dateStr)}
                  onDelete={handleDelete}
                  onDuplicate={openDuplicate}
                  partitionKey={hooConfig.partitionKey}
                />
              );
            })}
          </div>
        </div>

        {showPanel && (
          <div className="w-80 shrink-0 border-l border-[#d4c4d4] bg-[#faf7fa] flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 py-4 border-b border-[#e4d4e4] bg-white">
              <p className="text-xs font-semibold text-[#5b2d5b] mb-2">Jump to week</p>
              <input type="date" value={panelDate} onChange={(e) => handlePanelDateChange(e.target.value)}
                className="w-full px-3 py-1.5 text-sm text-[#3b1a3b] bg-white border border-[#d4c4d4] rounded-lg focus:outline-none focus:border-rose-400" />
              <p className="text-[10px] text-[#a090a0] mt-1.5">Pick any date to navigate to that week</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              <p className="text-xs font-semibold text-[#3b1a3b]">
                {visibleWeekRecords.length === 0
                  ? "No exceptions this week"
                  : `${visibleWeekRecords.length} exception${visibleWeekRecords.length !== 1 ? "s" : ""} this week`}
              </p>
              {visibleWeekRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#f0e8f0] flex items-center justify-center mb-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b6b8b" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <p className="text-xs text-[#a090a0]">No holidays or exceptions scheduled for this week.</p>
                </div>
              ) : (
                visibleWeekRecords.map((record) => {
                  const p = record.payload ?? {};
                  return (
                    <div key={`${record[hooConfig.partitionKey]}-${record[slotKey]}`} className="bg-white rounded-xl border border-[#e4d4e4] overflow-hidden">
                      <div className="px-3 py-2 bg-[#f5f0f5] border-b border-[#e4d4e4] flex items-center justify-between">
                        <span className="text-xs font-bold text-[#5b2d5b]">
                          {record._dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="text-[10px] text-[#a090a0]">{record[slotKey]}</span>
                      </div>
                      <div className="px-3 py-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#3b1a3b]">{p.exceptionType ?? "Exception"}</span>
                          {p.fullClose && (
                            <span className="text-[9px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded">Full Close</span>
                          )}
                        </div>
                        {p.description && <p className="text-xs text-[#5b2d5b] leading-relaxed">{p.description}</p>}
                        {p.timezone && <p className="text-[10px] text-[#a090a0]">{p.timezone}</p>}
                        <div className="flex gap-1.5 flex-wrap">
                          {p.vmMenu && <span className="text-[9px] bg-[#f0e8f0] text-[#7b4b7b] px-2 py-0.5 rounded-full border border-[#e0d0e0]">VM Menu</span>}
                          {p.offerVm && <span className="text-[9px] bg-[#f0e8f0] text-[#7b4b7b] px-2 py-0.5 rounded-full border border-[#e0d0e0]">Offer VM</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => openEdit(record)}
                            className="self-start px-3 py-1 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-900 active:scale-95 transition-all cursor-pointer">
                            Edit
                          </button>
                          <button type="button" onClick={() => openDuplicate(record)}
                            className="self-start px-3 py-1 text-xs font-semibold text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50 hover:border-violet-400 active:scale-95 transition-all cursor-pointer">
                            Duplicate
                          </button>
                          {confirmDeleteSortKey === record[slotKey] ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-[#3b1a3b]">Delete?</span>
                              <button type="button"
                                onClick={() => { handleDelete(record); setConfirmDeleteSortKey(null); }}
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer transition-colors">
                                Yes
                              </button>
                              <button type="button"
                                onClick={() => setConfirmDeleteSortKey(null)}
                                className="px-2 py-1 text-xs font-semibold text-[#5b2d5b] bg-[#e8d8e8] rounded-lg hover:bg-[#d4c4d4] cursor-pointer transition-colors">
                                No
                              </button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => setConfirmDeleteSortKey(record[slotKey])}
                              className="self-start px-3 py-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 active:scale-95 transition-all cursor-pointer">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {inlineForm && (
        <InlineFormPanel
          key={inlineForm.label}
          inlineForm={inlineForm}
          hooConfig={hooConfig}
          onClose={() => setInlineForm(null)}
          onDone={handleFormDone}
        />
      )}
    </div>
  );
}

function InlineFormPanel({ inlineForm, hooConfig, onClose, onDone }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t-2 border-[#c8b8c8] bg-[#ede5ed]">
      <div className="shrink-0 flex items-center justify-between px-8 py-3 border-b border-[#d4c4d4]">
        <span className="text-sm font-semibold text-[#3b1a3b]">
          {inlineForm.mode === "edit"
            ? `Edit — ${inlineForm.label}`
            : inlineForm.mode === "duplicate"
              ? `Duplicate — ${inlineForm.label}`
              : `New Record — ${inlineForm.label}`}
        </span>
        <button type="button" onClick={onClose}
          className="p-1.5 rounded-lg text-[#8b6b8b] hover:bg-[#d4c8d4] transition-colors cursor-pointer" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <HOOForm
        hooConfig={hooConfig}
        formMode={inlineForm.mode}
        initialValues={inlineForm.initialValues}
        onDone={onDone}
        onCancel={onClose}
      />
    </div>
  );
}
