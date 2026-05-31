import { useState } from "react";

export default function DaySlot({
  label, sublabel, records, isToday, isSchedule, isActive, onEdit, onCreate, onDelete, onDuplicate,
}) {
  const hasRecords = records.length > 0;

  return (
    <div
      className={`rounded-xl border p-1.5 flex flex-col gap-1 min-h-16 transition-colors
        ${isActive
          ? "border-rose-600 ring-2 ring-rose-300 bg-rose-50"
          : isToday
            ? "border-rose-400 bg-rose-50"
            : "border-[#d4c4d4] bg-white"}`}
    >
      {/* Day header */}
      <div className="flex items-baseline justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wide leading-none ${isToday ? "text-rose-700" : "text-[#5b2d5b]"}`}>
          {label}
        </span>
        <span className="text-[9px] text-[#a090a0] leading-none">{sublabel}</span>
      </div>

      {/* Records or empty state */}
      <div className="flex-1 flex flex-col gap-1">
        {hasRecords ? (
          records.map((record, i) => (
            <RecordRow
              key={record[Object.keys(record)[0]] ?? i}
              record={record}
              isSchedule={isSchedule}
              onEdit={() => onEdit(record)}
              onDelete={() => onDelete(record)}
              onDuplicate={() => onDuplicate(record)}
            />
          ))
        ) : (
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

function RecordRow({ record, isSchedule, onEdit, onDelete, onDuplicate }) {
  const p = record.payload ?? {};
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    <div className="relative rounded bg-white/80 border border-[#e4d4e4] px-1.5 py-1 flex flex-col gap-0.5 overflow-hidden min-h-13.5">
      {confirmingDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-white/95 rounded px-2">
          <span className="text-[9px] font-semibold text-[#3b1a3b] text-center leading-tight">Delete this entry?</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setConfirmingDelete(false); onDelete(); }}
              className="text-[9px] font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Yes
            </button>
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
      {isSchedule ? (
        <>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono font-semibold text-[#3b1a3b] leading-tight truncate">
              {p.startTime ?? "—"}–{p.endTime ?? "—"}
            </span>
            {actionButtons}
          </div>
          <div className="text-[9px] text-[#8b6b8b] leading-tight truncate">{p.timezone ?? ""}</div>
          {(p.vmMenu || p.offerVm) && (
            <div className="flex gap-1 flex-wrap">
              {p.vmMenu && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">VM&nbsp;Menu</span>}
              {p.offerVm && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">Offer&nbsp;VM</span>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-[#3b1a3b] leading-tight truncate">
              {p.exceptionType ?? "Exception"}
            </span>
            {actionButtons}
          </div>
          {p.description && (
            <div className="text-[9px] text-[#5b2d5b] leading-tight line-clamp-2">{p.description}</div>
          )}
          {p.fullClose && (
            <span className="text-[8px] bg-rose-50 text-rose-600 border border-rose-200 px-1 rounded self-start">Full&nbsp;Close</span>
          )}
          <div className="flex gap-1 flex-wrap">
            {p.vmMenu && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">VM&nbsp;Menu</span>}
            {p.offerVm && <span className="text-[8px] bg-[#f0e8f0] text-[#7b4b7b] px-1 rounded">Offer&nbsp;VM</span>}
          </div>
        </>
      )}
    </div>
  );
}
