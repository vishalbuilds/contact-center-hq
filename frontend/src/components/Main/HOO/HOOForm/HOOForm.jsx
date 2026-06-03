import { useState, useEffect, useRef } from "react";
import StringField from "../../Fields/StringField.jsx";
import DropdownField from "../../Fields/DropdownField.jsx";
import BooleanField from "../../Fields/BooleanField.jsx";
import IntegerField from "../../Fields/IntegerField.jsx";
import DateField from "../../Fields/DateField.jsx";
import TimeField from "../../Fields/TimeField.jsx";
import { createHooRecord, updateHooRecord } from "../../api/hoo.js";

const FIELD_COMPONENTS = {
  string:   StringField,
  dropdown: DropdownField,
  boolean:  BooleanField,
  integer:  IntegerField,
  date:     DateField,
  time:     TimeField,
};

export default function HOOForm({ hooConfig, formMode, initialValues, onDone, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const doneTimerRef = useRef(null);

  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  const pkId = hooConfig.partitionKey;
  const skId = hooConfig.sortKey;

  const isDirty = hooConfig.fields?.some(
    (f) => !f.hidden && formValues[f.id] !== initialValues[f.id]
  ) ?? false;

  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
    if (submitError) setSubmitError("");
    if (confirmDiscard) setConfirmDiscard(false);
  };

  const handleCancel = () => {
    if (!isDirty) { onCancel?.(); return; }
    setConfirmDiscard(true);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const newErrors = {};
    hooConfig.fields?.forEach((f) => {
      if (f.hidden) return;
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const pkVal = formValues[pkId];
    const skVal = skId ? formValues[skId] : undefined;

    if (!pkVal?.toString().trim()) {
      setErrors((prev) => ({ ...prev, [pkId]: true }));
      setSubmitError(`${pkId} is required.`);
      return;
    }
    if (skId && !skVal?.toString().trim()) {
      setErrors((prev) => ({ ...prev, [skId]: true }));
      setSubmitError(`${skId} is required.`);
      return;
    }

    const body = {};
    const payloadObj = {};
    hooConfig.fields?.forEach((f) => {
      const v = formValues[f.id];
      if (v === undefined) return;
      if (formMode !== "edit" && v === "") return;
      if (f.isPayload) payloadObj[f.id] = v;
      else body[f.id] = v;
    });
    if (Object.keys(payloadObj).length > 0) body.payload = payloadObj;

    setSubmitting(true);
    try {
      if (formMode === "create" || formMode === "duplicate") {
        const res = await createHooRecord(hooConfig.tableName, body, pkId, skId);
        if (res.status === 409) {
          setSubmitError(`A record for ${pkId}="${pkVal}" / ${skId}="${skVal}" already exists.`);
          return;
        }
        if (!res.ok) { setSubmitError("Failed to create record. Please try again."); return; }
      } else {
        const res = await updateHooRecord(hooConfig.tableName, pkVal, skVal, body, pkId, skId);
        if (!res.ok) { setSubmitError("Failed to save record. Please try again."); return; }
      }
      setSubmitDone(true);
      doneTimerRef.current = setTimeout(onDone, 1500);
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getSubmitLabel = () => {
    if (submitDone) return formMode === "edit" ? "Saved!" : "Created!";
    if (submitting) return formMode === "edit" ? "Saving…" : "Creating…";
    return formMode === "edit" ? "Save" : "Create";
  };

  return (
    <div id="hoo-form" className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {formMode === "duplicate" && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            Fields copied. Enter a new <strong>{pkId}</strong>
            {skId && <> and <strong>{skId}</strong></>} to create the record.
          </div>
        )}
        {submitError && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}
        {confirmDiscard && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
            <span className="text-sm text-amber-700">Discard unsaved changes?</span>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setConfirmDiscard(false)}
                className="px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 cursor-pointer">
                Keep Editing
              </button>
              <button type="button" onClick={() => onCancel?.()}
                className="px-3 py-1 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer">
                Discard
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4 max-w-lg">
          {hooConfig.fields?.map((field) => {
            if (field.hidden) return null;
            const Component = FIELD_COMPONENTS[field.type] ?? StringField;
            return (
              <Component
                key={field.id}
                field={field}
                value={formValues[field.id]}
                onChange={handleChange}
                error={errors[field.id]}
              />
            );
          })}
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-between px-8 py-4 border-t border-[#c8b8c8]">
        {onCancel ? (
          <button type="button" onClick={handleCancel} disabled={submitting || submitDone}
            className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] transition-colors cursor-pointer disabled:opacity-40">
            Cancel
          </button>
        ) : <span />}
        <button type="button" onClick={handleSubmit} disabled={submitting || submitDone}
          className={`px-5 py-2 text-sm font-semibold text-white rounded-lg border transition-all duration-150 cursor-pointer
            ${submitDone
              ? "bg-emerald-600 border-emerald-700"
              : "bg-rose-700 border-rose-800 hover:bg-rose-900 active:scale-95 disabled:opacity-60"}`}>
          {getSubmitLabel()}
        </button>
      </div>
    </div>
  );
}
