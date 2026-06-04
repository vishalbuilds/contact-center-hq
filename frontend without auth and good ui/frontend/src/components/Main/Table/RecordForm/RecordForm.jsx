import { useState, useEffect, useRef } from "react";
import { createTableRecord, updateTableRecord } from "../../api/table.js";
import StringField from "../../Fields/StringField.jsx";
import DropdownField from "../../Fields/DropdownField.jsx";
import BooleanField from "../../Fields/BooleanField.jsx";
import IntegerField from "../../Fields/IntegerField.jsx";
import DateField from "../../Fields/DateField.jsx";
import TimeField from "../../Fields/TimeField.jsx";

const FIELD_COMPONENTS = {
  string:   StringField,
  dropdown: DropdownField,
  boolean:  BooleanField,
  integer:  IntegerField,
  date:     DateField,
  time:     TimeField,
};

export default function RecordForm({ tableConfig, pkField, formMode, initialValues, onDone }) {
  const [formValues, setFormValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [pkError, setPkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const doneTimerRef = useRef(null);

  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
    if (pkError && pkField && fieldId === pkField.id) setPkError("");
  };

  const handleSubmit = async () => {
    if (!pkField || submitting) return;

    const newErrors = {};
    tableConfig.fields?.forEach((f) => {
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const pkId = pkField.id;
    const pkVal = formValues[pkId];

    if (formMode === "create" || formMode === "duplicate") {
      if (!pkVal || !String(pkVal).trim()) {
        setPkError(`${pkField.title ?? "Primary key"} is required.`);
        return;
      }
    }

    const body = {};
    const payloadObj = {};
    tableConfig.fields?.forEach((f) => {
      const v = formValues[f.id];
      if (v === "" || v === undefined) return;
      if (f.isPayload) payloadObj[f.id] = v;
      else body[f.id] = v;
    });
    if (Object.keys(payloadObj).length > 0) body.payload = payloadObj;

    setSubmitting(true);
    try {
      if (formMode === "create" || formMode === "duplicate") {
        const res = await createTableRecord(tableConfig.tableName, pkId, body);
        if (res.status === 409) { setPkError(`A record with this ${pkField.title ?? "key"} already exists.`); return; }
        if (!res.ok) { setPkError("Failed to create record. Please try again."); return; }
      } else {
        const res = await updateTableRecord(tableConfig.tableName, pkId, pkVal, body);
        if (!res.ok) { setPkError("Failed to save record. Please try again."); return; }
      }
      setSubmitDone(true);
      doneTimerRef.current = setTimeout(onDone, 1500);
    } catch {
      setPkError("An unexpected error occurred. Please try again.");
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
    <div id="record-form" className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {formMode === "duplicate" && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            All fields copied. Set a new unique{" "}
            <strong>{pkField?.title ?? "primary key"}</strong> before creating.
          </div>
        )}
        <div className="flex flex-col gap-4 max-w-lg">
          {tableConfig.fields?.map((field) => {
            const Component = FIELD_COMPONENTS[field.type] ?? StringField;
            const isPk = pkField && field.id === pkField.id;
            return (
              <div key={field.id}>
                <Component
                  field={field}
                  value={formValues[field.id]}
                  onChange={handleChange}
                  error={errors[field.id]}
                />
                {isPk && pkError && (
                  <p className="text-xs text-red-500 mt-1">{pkError}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 flex justify-end px-8 py-4 border-t border-[#c8b8c8]">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || submitDone}
          className={`px-5 py-2 text-sm font-semibold text-white rounded-lg border transition-all duration-150 cursor-pointer
            ${submitDone
              ? "bg-emerald-600 border-emerald-700"
              : "bg-rose-700 border-rose-800 hover:bg-rose-900 active:scale-95 disabled:opacity-60"
            }`}
        >
          {getSubmitLabel()}
        </button>
      </div>
    </div>
  );
}
