import { useState } from "react";
import StringField from "../../Fields/StringField.jsx";
import DropdownField from "../../Fields/DropdownField.jsx";
import BooleanField from "../../Fields/BooleanField.jsx";
import IntegerField from "../../Fields/IntegerField.jsx";
import DateField from "../../Fields/DateField.jsx";
import TimeField from "../../Fields/TimeField.jsx";
import { upsertHooRecord } from "../../api/hoo.js";

const FIELD_COMPONENTS = {
  string: StringField, dropdown: DropdownField, boolean: BooleanField,
  integer: IntegerField, date: DateField, time: TimeField,
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function buildDefaults(hooConfig) {
  const vals = {};
  hooConfig.fields?.forEach((f) => {
    if (f.hidden) return;
    vals[f.id] = f.defaultValue ?? "";
  });
  return vals;
}

export default function HOOBulkEditForm({ hooConfig, selectedQueues, onDone, onCancel }) {
  const isSchedule = hooConfig.id === "schedule";

  // Which days (schedule) or date (exception) to write
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [exceptionDate, setExceptionDate] = useState("");

  // Which fields to apply + their values
  const [applyFields, setApplyFields] = useState(new Set());
  const [formValues, setFormValues] = useState(buildDefaults(hooConfig));

  // Submission progress
  const [progress, setProgress] = useState(null); // { total, done, results[] }
  const [submitError, setSubmitError] = useState("");

  const pk = hooConfig.partitionKey;
  const sk = hooConfig.sortKey;
  const gsi = hooConfig.GSIKey;

  const editableFields = hooConfig.fields?.filter(
    (f) => ![pk, sk, gsi].includes(f.id) && !f.hidden
  ) ?? [];

  const toggleDay = (day) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const toggleField = (id) => {
    setApplyFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const buildBody = (queue, sortKeyVal) => {
    const body = { [pk]: queue.queueArn, [gsi]: queue.queueName, [sk]: sortKeyVal };
    const payloadObj = {};
    editableFields.forEach((f) => {
      if (!applyFields.has(f.id)) return;
      const v = formValues[f.id];
      if (f.isPayload) payloadObj[f.id] = v;
      else body[f.id] = v;
    });
    if (Object.keys(payloadObj).length) body.payload = payloadObj;
    return body;
  };

  const handleSubmit = async () => {
    if (applyFields.size === 0) { setSubmitError("Select at least one field to apply."); return; }

    // DateField stores dates as MM/DD/YYYY; HTML date inputs produce YYYY-MM-DD — convert.
    const toSortKey = (iso) => {
      const [y, m, d] = iso.split("-");
      return `${m}/${d}/${y}`;
    };
    const sortKeys = isSchedule ? [...selectedDays] : (exceptionDate ? [toSortKey(exceptionDate)] : []);
    if (sortKeys.length === 0) {
      setSubmitError(isSchedule ? "Select at least one day." : "Enter a date.");
      return;
    }

    const total = selectedQueues.length * sortKeys.length;
    setProgress({ total, done: 0, results: [] });
    setSubmitError("");

    for (const queue of selectedQueues) {
      for (const sk_val of sortKeys) {
        const body = buildBody(queue, sk_val);
        let status = "error";
        let message = "";
        try {
          const res = await upsertHooRecord(hooConfig.tableName, pk, sk, body);
          const data = await res.json();
          status = res.ok ? data.status : "error";
          if (!res.ok) message = data.detail ?? "Request failed";
        } catch {
          message = "Network error";
        }
        setProgress((p) => ({
          ...p,
          done: p.done + 1,
          results: [...p.results, { queue: queue.queueName, sortKey: sk_val, status, message }],
        }));
      }
    }
  };

  const isDone = progress && progress.done === progress.total;
  const failed = progress?.results.filter((r) => r.status === "error") ?? [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Queue summary */}
        <div className="max-w-lg mb-5 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          Editing <strong>{selectedQueues.length}</strong> queue{selectedQueues.length !== 1 ? "s" : ""}:{" "}
          {selectedQueues.map((q) => q.queueName).join(", ")}
        </div>

        {submitError && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Progress view */}
        {progress ? (
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-[#e8d8e8] rounded-full h-2">
                <div
                  className="bg-rose-700 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[#8b6b8b] shrink-0">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
              {progress.results.map((r) => (
                <div key={`${r.queue}-${r.sortKey}`} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                  r.status === "error" ? "bg-red-50 text-red-700" :
                  r.status === "created" ? "bg-emerald-50 text-emerald-700" :
                  "bg-blue-50 text-blue-700"
                }`}>
                  <span>{r.status === "error" ? "✗" : "✓"}</span>
                  <span className="font-medium">{r.queue}</span>
                  <span className="text-[#8b6b8b]">({r.sortKey})</span>
                  <span className="ml-auto">— {r.message || r.status}</span>
                </div>
              ))}
              {progress.done < progress.total && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-[#f5f0f5] text-[#8b6b8b]">
                  <svg className="animate-spin shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Processing…
                </div>
              )}
            </div>
            {isDone && (
              <p className={`mt-3 text-sm font-semibold ${failed.length ? "text-red-700" : "text-emerald-700"}`}>
                Done — {progress.total - failed.length} saved{failed.length ? `, ${failed.length} failed` : ""}.
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-lg flex flex-col gap-6">
            {/* Day / date selector */}
            <div>
              <p className="text-xs font-semibold text-[#3b1a3b] mb-2">
                {isSchedule ? "Apply to days" : "Exception date"} <span className="text-rose-700">*</span>
              </p>
              {isSchedule ? (
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        selectedDays.has(day)
                          ? "bg-rose-700 text-white border-rose-700"
                          : "bg-white text-[#5b2d5b] border-[#d4c4d4] hover:border-rose-400"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="date"
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                  className="px-3 py-1.5 text-sm text-[#3b1a3b] bg-white border border-[#b8a8b8] rounded-lg focus:outline-none focus:border-rose-700"
                />
              )}
            </div>

            {/* Fields with apply toggles */}
            <div>
              <p className="text-xs font-semibold text-[#3b1a3b] mb-2">Fields to apply</p>
              <p className="text-[10px] text-[#8b6b8b] mb-3">Only checked fields will be written to all selected queues.</p>
              <div className="flex flex-col gap-4">
                {editableFields.map((field) => {
                  const Component = FIELD_COMPONENTS[field.type] ?? StringField;
                  const active = applyFields.has(field.id);
                  return (
                    <div key={field.id} className={`flex gap-3 items-start p-3 rounded-xl border transition-colors ${
                      active ? "border-rose-300 bg-rose-50/40" : "border-[#e8d8e8] bg-white/40"
                    }`}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleField(field.id)}
                        className="mt-1 w-4 h-4 accent-rose-700 cursor-pointer shrink-0"
                      />
                      <div className={`flex-1 ${!active ? "opacity-40 pointer-events-none select-none" : ""}`}>
                        <Component
                          field={field}
                          value={formValues[field.id]}
                          onChange={handleChange}
                          error={false}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-8 py-4 border-t border-[#c8b8c8]">
        <button type="button" onClick={isDone ? onDone : onCancel}
          disabled={progress && !isDone}
          className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] transition-colors cursor-pointer disabled:opacity-40">
          {isDone ? "Close" : "Cancel"}
        </button>
        {!progress && (
          <button type="button" onClick={handleSubmit}
            className="px-5 py-2 text-sm font-semibold text-white bg-rose-700 rounded-lg border border-rose-800 hover:bg-rose-900 active:scale-95 transition-all cursor-pointer">
            Apply to {selectedQueues.length} Queue{selectedQueues.length !== 1 ? "s" : ""}
          </button>
        )}
        {isDone && (
          <button type="button" onClick={onDone}
            className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg border border-emerald-700 cursor-pointer">
            Done
          </button>
        )}
      </div>
    </div>
  );
}
