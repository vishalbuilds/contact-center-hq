import { useState, useEffect, useRef } from "react";
import { createTableRecord, updateTableRecord } from "../../api/table.js";
import StringField from "../../Fields/StringField.jsx";
import DropdownField from "../../Fields/DropdownField.jsx";
import BooleanField from "../../Fields/BooleanField.jsx";
import IntegerField from "../../Fields/IntegerField.jsx";
import DateField from "../../Fields/DateField.jsx";
import TimeField from "../../Fields/TimeField.jsx";

/*
  RecordForm.jsx — the create / edit / duplicate form for generic DynamoDB records.

  Functionally identical to Table/TableForm/TableForm.jsx. Used in modals that
  manage table records (Initial Config, User DID Mapping, Voicemail Access,
  Outbound Mapping).

  FORM MODES
  ──────────
  "create"    → fields start from schema.json defaultValues; POST to create
  "duplicate" → fields pre-filled from existing record, pk cleared; POST to create
  "edit"      → fields pre-filled from existing record; PUT to update

  FIELD RENDERING
  ───────────────
  All fields in tableConfig.fields are rendered using the FIELD_COMPONENTS map
  (field.type → React component). Unknown types fall back to StringField.

  PRIMARY KEY ERROR
  ─────────────────
  pkError is a separate error string shown below the pk field. It handles:
    • Empty pk in create/duplicate mode
    • 409 Conflict (record with this pk already exists)
    • Other API failures

  SUBMIT FLOW
  ───────────
  1. Validate required fields → mark errors
  2. Validate pk is non-empty in create/duplicate mode
  3. Build body (top-level fields + nested payload for isPayload fields)
  4. Call createTableRecord (POST) or updateTableRecord (PUT)
  5. On success: flash green for 1.5 s → call onDone()

  PROPS
  ─────
  tableConfig   — full config from schema.json (fields, tableName)
  pkField       — the primary key field object
  formMode      — "create" | "edit" | "duplicate"
  initialValues — pre-filled values from the parent modal
  onDone        — called after successful save; parent returns to search screen
*/

/*
  FIELD_COMPONENTS — maps field.type to the corresponding input component.
  Fallback: StringField for any unknown type.
*/
const FIELD_COMPONENTS = {
  string: StringField,
  dropdown: DropdownField,
  boolean: BooleanField,
  integer: IntegerField,
  date: DateField,
  time: TimeField,
};

export default function RecordForm({
  tableConfig,
  pkField,
  formMode,
  initialValues,
  onDone,
}) {
  /*
    formValues  — current value for every field
    errors      — { [fieldId]: true } for required fields that are empty
    pkError     — string error shown below the pk field specifically
    submitting  — true while API call is in flight
    submitDone  — true after success (green button for 1.5 s)
    doneTimerRef — setTimeout handle; cleared on unmount
  */
  const [formValues, setFormValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [pkError, setPkError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const doneTimerRef = useRef(null);

  /* Prevent memory leak if the component unmounts before the timer fires */
  useEffect(
    () => () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    },
    [],
  );

  /*
    handleChange — updates formValues for the changed field, clears its error,
    and clears the pkError if the user edits the primary key field.
  */
  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
    if (pkError && pkField && fieldId === pkField.id) setPkError("");
    if (submitError) setSubmitError("");
  };

  /* handleSubmit — validates, builds the body, calls the API */
  const handleSubmit = async () => {
    if (!pkField || submitting) return;

    /* Step 1: validate all required fields */
    const newErrors = {};
    tableConfig.fields?.forEach((f) => {
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const pkId = pkField.id;
    const pkVal = formValues[pkId];

    /* Step 2: pk must be non-empty when creating or duplicating */
    if (formMode === "create" || formMode === "duplicate") {
      if (!pkVal || !String(pkVal).trim()) {
        setPkError(`${pkField.title ?? "Primary key"} is required.`);
        return;
      }
    }

    /*
      Step 3: build the body.
      isPayload=true fields go into a nested payload object.
      Empty strings and undefined values are skipped (no blank DynamoDB attributes).
    */
    const body = {};
    const payloadObj = {};
    tableConfig.fields?.forEach((f) => {
      const v = formValues[f.id];
      if (v === "" || v === undefined) return;
      if (f.isPayload) payloadObj[f.id] = v;
      else body[f.id] = v;
    });
    if (Object.keys(payloadObj).length > 0) body.payload = payloadObj;

    /* Step 4: send the API request */
    setSubmitting(true);
    try {
      if (formMode === "create" || formMode === "duplicate") {
        const res = await createTableRecord(tableConfig.tableName, pkId, body);
        if (res.status === 409) {
          setPkError(
            `A record with this ${pkField.title ?? "key"} already exists.`,
          );
          return;
        }
        if (!res.ok) {
          setPkError("Failed to create record. Please try again.");
          return;
        }
      } else {
        const res = await updateTableRecord(
          tableConfig.tableName,
          pkId,
          pkVal,
          body,
        );
        if (!res.ok) {
          setSubmitError("Failed to save record. Please try again.");
          return;
        }
      }
      /* Step 5: success — flash green button, then call onDone after 1.5 s */
      setSubmitDone(true);
      doneTimerRef.current = setTimeout(onDone, 1500);
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /*
    getSubmitLabel — button text for each state:
      submitDone → "Saved!" / "Created!"
      submitting → "Saving…" / "Creating…"
      idle       → "Save" / "Create"
  */
  const getSubmitLabel = () => {
    if (submitDone) return formMode === "edit" ? "Saved!" : "Created!";
    if (submitting) return formMode === "edit" ? "Saving…" : "Creating…";
    return formMode === "edit" ? "Save" : "Create";
  };

  return (
    /* Form container — fills remaining height; header is provided by the parent modal */
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable field area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/*
          Duplicate mode banner — reminds user to set a new unique pk.
          bg-amber-50 border border-amber-200 → soft yellow warning colour
        */}
        {submitDone && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
            <span className="font-semibold">
              {formMode === "edit" ? "Updated" : "Created"}:
            </span>{" "}
            <span className="font-semibold font-mono">
              {String(formValues[pkField?.id] ?? "")}
            </span>
          </div>
        )}
        {formMode === "duplicate" && !submitDone && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            All fields copied. Set a new unique{" "}
            <strong>{pkField?.title ?? "primary key"}</strong> before creating.
          </div>
        )}
        {submitError && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/*
          Field list — one input component per field in tableConfig.fields.
          isPk=true → renders pkError below that specific field if set.
        */}
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
                {/* pkError — shown only below the primary key field */}
                {isPk && pkError && (
                  <p className="text-xs text-red-500 mt-1">{pkError}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed footer — Submit button on the right */}
      {/*
        shrink-0 flex justify-end → button sits at the right edge
        border-t border-[#c8b8c8] → thin mauve divider above the footer

        Submit button:
          Normal  → bg-rose-700 (dark rose)
          Success → bg-emerald-600 (green flash)
          Loading → disabled:opacity-60
      */}
      <div className="shrink-0 flex justify-end px-8 py-4 border-t border-[#c8b8c8]">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || submitDone}
          className={`px-5 py-2 text-sm font-semibold text-white rounded-lg border transition-all duration-150 cursor-pointer
            ${
              submitDone
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
