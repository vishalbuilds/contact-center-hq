import { useState, useEffect, useRef } from "react";
import { createTableRecord, updateTableRecord } from "../../api/table.js";
import StringField from "../../Fields/StringField.jsx";
import DropdownField from "../../Fields/DropdownField.jsx";
import BooleanField from "../../Fields/BooleanField.jsx";
import IntegerField from "../../Fields/IntegerField.jsx";
import DateField from "../../Fields/DateField.jsx";
import TimeField from "../../Fields/TimeField.jsx";

/*
  TableForm.jsx — the create / edit / duplicate form for generic DynamoDB table records.

  Used by: TableModal (view === "form") for all "table" type schema cards
  (Initial Config, User DID Mapping, Voicemail Access, Outbound Mapping).

  FORM MODES
  ──────────
  "create"    → all fields start from schema.json defaultValues.
                Submit calls createTableRecord (POST).
  "duplicate" → all fields pre-filled from an existing record, but the
                primary key is cleared so a new unique record can be created.
                An amber info banner explains this to the user.
                Submit calls createTableRecord (POST).
  "edit"      → all fields pre-filled from the existing record.
                Submit calls updateTableRecord (PUT).

  FIELD RENDERING
  ───────────────
  Every field in tableConfig.fields is rendered dynamically using the
  FIELD_COMPONENTS map (field.type → component). Unknown types fall back to
  StringField. All fields are shown (none are hidden in the table form).

  PRIMARY KEY ERROR
  ─────────────────
  pkError is a separate error string (not part of the errors object) displayed
  below the primary key field specifically. It handles:
    • "PK is required" when creating with an empty key
    • "A record with this key already exists" (409 Conflict from the API)
    • "Failed to create/save record" for other API errors

  SUBMIT FLOW
  ───────────
  1. Validate all required fields → mark errors if empty
  2. In create/duplicate mode: validate the primary key is non-empty
  3. Build the body (top-level fields + nested payload object)
  4. Call createTableRecord or updateTableRecord
  5. On success: flash green ("Created!" / "Saved!") for 1.5 s, then onDone()
  6. On 409 Conflict: show "record already exists" pkError
  7. On other failures: show generic pkError

  PROPS
  ─────
  tableConfig    — full config object from schema.json (fields, tableName)
  pkField        — the primary key field object (from getPrimaryKeyField in TableModal)
  formMode       — "create" | "edit" | "duplicate"
  initialValues  — pre-filled values built by buildInitialFormValues in TableModal
  onDone         — called after a successful submit; TableModal returns to "search"
*/

/*
  FIELD_COMPONENTS — maps each schema field.type to its React component.
  Fallback: StringField for any unknown type.
*/
const FIELD_COMPONENTS = {
  string:   StringField,
  dropdown: DropdownField,
  boolean:  BooleanField,
  integer:  IntegerField,
  date:     DateField,
  time:     TimeField,
};

export default function TableForm({ tableConfig, pkField, formMode, initialValues, onDone }) {
  /*
    formValues  — current value for every field in the form
    errors      — { [fieldId]: true } for fields that failed required validation
    pkError     — string error shown specifically below the primary key field
    submitting  — true while the API call is in flight
    submitDone  — true after success (turns button green, triggers auto-close)
    doneTimerRef — setTimeout handle; cleared on unmount to avoid memory leaks
  */
  const [formValues, setFormValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [pkError, setPkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const doneTimerRef = useRef(null);

  /* Clear the auto-close timer if the component unmounts before it fires */
  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  /*
    handleChange — called by each field component on every change.
    Updates formValues for that field, clears its individual validation error,
    and clears the pkError if the user edits the primary key field.
  */
  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
    if (pkError && pkField && fieldId === pkField.id) setPkError("");
  };

  /*
    handleSubmit — validates, builds the request body, calls the API.
  */
  const handleSubmit = async () => {
    if (!pkField || submitting) return;

    /* Step 1: validate all required fields */
    const newErrors = {};
    tableConfig.fields?.forEach((f) => {
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const pkId = pkField.id;
    const pkVal = formValues[pkId];

    /* Step 2: in create/duplicate mode the primary key must not be empty */
    if (formMode === "create" || formMode === "duplicate") {
      if (!pkVal || !String(pkVal).trim()) {
        setPkError(`${pkField.title ?? "Primary key"} is required.`);
        return;
      }
    }

    /*
      Step 3: build the body.
      Fields with isPayload=true go into a nested payload object.
      Empty strings and undefined values are skipped to avoid storing blank
      DynamoDB attributes.
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
        /* 409 Conflict — a record with this primary key already exists */
        if (res.status === 409) { setPkError(`A record with this ${pkField.title ?? "key"} already exists.`); return; }
        if (!res.ok) { setPkError("Failed to create record. Please try again."); return; }
      } else {
        const res = await updateTableRecord(tableConfig.tableName, pkId, pkVal, body);
        if (!res.ok) { setPkError("Failed to save record. Please try again."); return; }
      }
      /* Step 5: success — flash green then call onDone after 1.5 s */
      setSubmitDone(true);
      doneTimerRef.current = setTimeout(onDone, 1500);
    } catch {
      setPkError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /*
    getSubmitLabel — returns the correct button text for the current state.
    submitDone  → "Saved!" / "Created!"  (green flash state)
    submitting  → "Saving…" / "Creating…"
    idle        → "Save" / "Create"
  */
  const getSubmitLabel = () => {
    if (submitDone) return formMode === "edit" ? "Saved!" : "Created!";
    if (submitting) return formMode === "edit" ? "Saving…" : "Creating…";
    return formMode === "edit" ? "Save" : "Create";
  };

  return (
    /*
      Form container — fills all remaining height in the modal below the header.
      flex-1 flex flex-col overflow-hidden → scrollable field area + fixed footer
    */
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Scrollable field area ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {/*
          Duplicate mode banner — amber box reminding the user to enter a
          new unique primary key value before creating the record.
        */}
        {formMode === "duplicate" && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            All fields copied. Set a new unique{" "}
            <strong>{pkField?.title ?? "primary key"}</strong> before creating.
          </div>
        )}

        {/*
          Field list — one component per field in tableConfig.fields.
          flex flex-col gap-4 max-w-lg → vertical stack, 16px gaps, max 512px wide.

          For each field:
            Component = FIELD_COMPONENTS[field.type] ?? StringField
            isPk = true when this field is the primary key field
            pkError is shown below the pk field specifically (not via the
            standard error prop which only shows "This field is required")
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
                {/*
                  pkError message — shown below the primary key field only.
                  Handles "already exists" and other API errors for the PK.
                  text-xs text-red-500 mt-1 → small red text, 4px top gap
                */}
                {isPk && pkError && (
                  <p className="text-xs text-red-500 mt-1">{pkError}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Fixed footer — Submit button ─────────────────────────── */}
      {/*
        shrink-0 flex justify-end → footer stays fixed; button sits on the right
        border-t border-[#c8b8c8] → thin mauve dividing line above the footer
        px-8 py-4 → padding around the button

        Submit button states:
          Normal  → bg-rose-700 (dark rose)
          Success → bg-emerald-600 (green flash for 1.5 s)
          Loading → disabled:opacity-60
      */}
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
