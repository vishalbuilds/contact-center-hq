import { useState, useEffect, useRef } from "react";
import { useUser } from "../../../../context/UserContext.jsx";
import StringField from "../../Fields/StringField.jsx";
import DropdownField from "../../Fields/DropdownField.jsx";
import BooleanField from "../../Fields/BooleanField.jsx";
import IntegerField from "../../Fields/IntegerField.jsx";
import DateField from "../../Fields/DateField.jsx";
import TimeField from "../../Fields/TimeField.jsx";
import { createHooRecord, updateHooRecord } from "../../api/hoo.js";
import { localToEST } from "../../../../utils/timezone.js";

/*
  HOOForm.jsx — the create / edit / duplicate form for HOO records.

  Used by:
    • HOOModal (view === "form") — full-screen form reached from the search screen
    • HOOWeekView's InlineFormPanel — slides in below the week grid when the user
      clicks "+ Create", "Edit", or "Duplicate" on a DaySlot

  FORM MODES
  ──────────
  "create"    → all fields start from schema.json defaultValues (blank).
                Submit calls createHooRecord (POST).
  "duplicate" → all fields pre-filled from an existing record, but the
                partition key and sort key are cleared so a new unique record
                can be created. An amber info banner explains this.
                Submit calls createHooRecord (POST).
  "edit"      → all fields pre-filled from the existing record.
                Submit calls updateHooRecord (PUT).

  FIELD RENDERING
  ───────────────
  Fields are rendered dynamically from hooConfig.fields using the FIELD_COMPONENTS
  map. Each field.type string maps to the correct input component:
    string    → StringField
    dropdown  → DropdownField
    boolean   → BooleanField
    integer   → IntegerField
    date      → DateField
    time      → TimeField
  If a type is missing from the map, StringField is the fallback.
  Fields with field.hidden=true are skipped entirely.

  PAYLOAD FIELDS
  ──────────────
  Fields marked "isPayload": true in schema.json are grouped into a nested
  payload object before being sent to the API. All other fields are top-level
  attributes. This matches the DynamoDB record structure.

  DIRTY CHECK
  ───────────
  isDirty = JSON.stringify(formValues) !== JSON.stringify(initialValues)
  Compares the current form state to the original values as a JSON string.
  If nothing has changed, Cancel closes immediately. If something changed,
  Cancel shows a "Discard unsaved changes?" amber confirmation banner.

  SUBMIT FLOW
  ───────────
  1. Validate all required fields → mark errors if any are empty
  2. Validate partition key and sort key are non-empty
  3. Build the body object (top-level fields + payload nested object)
  4. Call createHooRecord or updateHooRecord
  5. On success: flash the button green ("Created!" / "Saved!") for 1.5 s,
     then call onDone() which refreshes the parent and closes this form
  6. On conflict (409): show a specific error (record already exists)
  7. On other errors: show a generic error banner

  PROPS
  ─────
  hooConfig      — full config object from schema.json (fields, tableName, keys)
  formMode       — "create" | "edit" | "duplicate"
  initialValues  — pre-filled form values built by buildFormValues()
  onDone         — called after a successful submit; refreshes parent and closes form
  onCancel       — called when the user cancels; closes the form without saving
*/

/*
  FIELD_COMPONENTS — maps each schema field.type to its input component.
  Any unknown type falls back to StringField (plain text input).
*/
const FIELD_COMPONENTS = {
  string: StringField,
  dropdown: DropdownField,
  boolean: BooleanField,
  integer: IntegerField,
  date: DateField,
  time: TimeField,
};

export default function HOOForm({
  hooConfig,
  resourceType,
  formMode,
  initialValues,
  onDone,
  onCancel,
}) {
  const { canWrite } = useUser();
  /*
    formValues     — the current value of every field; starts from initialValues
    errors         — { [fieldId]: true } for fields that failed validation
    submitError    — a string error message shown in the red banner above the form
    submitting     — true while the API call is in flight (disables the submit button)
    submitDone     — true after a successful submit (turns button green, auto-closes)
    confirmDiscard — true when Cancel was clicked on a dirty form (shows amber banner)
    doneTimerRef   — holds the setTimeout ID so it can be cleared if the component
                     unmounts before the 1.5 s is up (prevents memory leaks)
  */
  const [formValues, setFormValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const doneTimerRef = useRef(null);

  /* Cleanup: cancel the auto-close timer if the component unmounts early */
  useEffect(
    () => () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    },
    [],
  );

  /* Shorthand for the key field IDs used throughout this component */
  const pkId = hooConfig.partitionKey;
  const skId = hooConfig.sortKey;

  /*
    isDirty — true if any field value differs from what it was when the form opened.
    Uses JSON.stringify so nested objects (like boolean values) compare correctly.
  */
  const isDirty = JSON.stringify(formValues) !== JSON.stringify(initialValues);

  /*
    handleChange — called by every field component on every keystroke / selection.
    Updates that field's value in formValues and clears its individual error.
    Also clears the top-level submitError and confirmDiscard banner if they were showing.
  */
  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
    if (submitError) setSubmitError("");
    if (confirmDiscard) setConfirmDiscard(false);
  };

  /*
    handleCancel — called when the Cancel button is clicked.
    If the form has no unsaved changes: closes immediately via onCancel().
    If the form has unsaved changes: shows the amber "Discard?" banner instead.
  */
  const handleCancel = () => {
    if (!isDirty) {
      onCancel?.();
      return;
    }
    setConfirmDiscard(true);
  };

  /*
    handleSubmit — validates, builds the request body, calls the API, handles response.
  */
  const validateForm = () => {
    const newErrors = {};
    hooConfig.fields?.forEach((f) => {
      if (f.hidden) return;
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    const pkVal = formValues[pkId];
    const skVal = skId ? formValues[skId] : undefined;
    if (!pkVal?.toString().trim()) {
      setErrors((prev) => ({ ...prev, [pkId]: true }));
      setSubmitError(`${pkId} is required.`);
      return false;
    }
    if (skId && !skVal?.toString().trim()) {
      setErrors((prev) => ({ ...prev, [skId]: true }));
      setSubmitError(`${skId} is required.`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!validateForm()) return;

    const pkVal = formValues[pkId];
    const skVal = skId ? formValues[skId] : undefined;

    /*
      Step 3: build the body object.
      Fields with isPayload=true go into a nested payload object.
      In create/duplicate mode: skip empty strings to avoid storing blank attributes.
      In edit mode: include empty strings so the user can clear a field.
    */
    const body = {};
    const payloadObj = {};
    hooConfig.fields?.forEach((f) => {
      let v = formValues[f.id];
      if (v === undefined) return;
      if (formMode !== "edit" && v === "") return;
      /* Time fields are displayed in local time — convert back to EST for storage */
      if (f.type === "time" && v) v = localToEST(v);
      if (f.isPayload) payloadObj[f.id] = v;
      else body[f.id] = v;
    });
    if (Object.keys(payloadObj).length > 0) body.payload = payloadObj;

    /* Step 4: send the API request */
    setSubmitting(true);
    try {
      if (formMode === "create" || formMode === "duplicate") {
        const res = await createHooRecord(
          hooConfig.tableName,
          body,
          pkId,
          skId,
        );
        /* 409 Conflict — a record with this pk+sk already exists */
        if (res.status === 409) {
          setSubmitError(
            `A record for ${pkId}="${pkVal}" / ${skId}="${skVal}" already exists.`,
          );
          return;
        }
        if (!res.ok) {
          setSubmitError("Failed to create record. Please try again.");
          return;
        }
      } else {
        const res = await updateHooRecord(
          hooConfig.tableName,
          pkVal,
          skVal,
          body,
          pkId,
          skId,
        );
        if (!res.ok) {
          setSubmitError("Failed to save record. Please try again.");
          return;
        }
      }
      /* Step 5: success — flash green then auto-close after 1.5 s */
      setSubmitDone(true);
      doneTimerRef.current = setTimeout(onDone, 1500);
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /*
    getSubmitLabel — returns the button label for the current state.
    submitDone=true → "Saved!" or "Created!" (green flash)
    submitting=true → "Saving…" or "Creating…"
    idle            → "Save" or "Create"
  */
  const getSubmitLabel = () => {
    if (submitDone) return formMode === "edit" ? "Saved!" : "Created!";
    if (submitting) return formMode === "edit" ? "Saving…" : "Creating…";
    return formMode === "edit" ? "Save" : "Create";
  };

  return (
    /*
      Form container — fills remaining space in the modal or inline panel.
      flex-1 flex flex-col overflow-hidden → takes all available height,
      stacks the scrollable field area and the fixed footer bar vertically
    */
    <div id="hoo-form" className="flex-1 flex flex-col overflow-hidden">
      {/* ── Scrollable field area ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/*
          Duplicate mode info banner — amber box explaining the user must set
          new unique key values before creating (pre-filled IDs were cleared).
          bg-amber-50 border border-amber-200 → soft yellow background + border
          text-amber-700 → dark amber text
        */}
        {formMode === "duplicate" && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            Fields copied. Enter a new <strong>{pkId}</strong>
            {skId && (
              <>
                {" "}
                and <strong>{skId}</strong>
              </>
            )}{" "}
            to create the record.
          </div>
        )}

        {/*
          Submit error banner — shown when the API returns an error.
          bg-red-50 border border-red-200 → soft red background + border
          Appears above the fields so it is immediately visible.
        */}
        {submitError && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/*
          Discard confirmation banner — shown when Cancel is clicked on a dirty form.
          Two buttons: "Keep Editing" (dismiss banner) and "Discard" (actually close).
          bg-amber-50 border border-amber-200 → same amber style as duplicate banner
        */}
        {confirmDiscard && (
          <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
            <span className="text-sm text-amber-700">
              Discard unsaved changes?
            </span>
            <div className="flex gap-2 shrink-0">
              {/* Keep Editing — hides the banner, user stays on the form */}
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 cursor-pointer"
              >
                Keep Editing
              </button>
              {/* Discard — actually calls onCancel to close the form */}
              <button
                type="button"
                onClick={() => onCancel?.()}
                className="px-3 py-1 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/*
          Field list — renders one field component per entry in hooConfig.fields.
          flex flex-col gap-4 max-w-lg → vertical stack, 16px gaps, max 512px wide

          For each field:
            hidden=true → skipped (not shown to the user)
            type → picks the right component from FIELD_COMPONENTS
            error → passed down so the field shows red border + message if invalid
        */}
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

      {/* ── Fixed footer bar — Cancel + Submit ─────────────────────── */}
      {/*
        shrink-0         → footer never shrinks; the field area scrolls instead
        border-t border-[#c8b8c8] → thin mauve dividing line above the footer
        flex items-center justify-between → Cancel on the left, Submit on the right
        px-8 py-4        → 32px left/right, 16px top/bottom padding
      */}
      <div className="shrink-0 flex items-center justify-between px-8 py-4 border-t border-[#c8b8c8]">
        {/*
          Cancel button — calls handleCancel which either closes immediately (clean
          form) or shows the discard confirmation banner (dirty form).
          Disabled while submitting or after a successful submit.
          disabled:opacity-40 → 40% opacity makes it visually unavailable.
        */}
        {onCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting || submitDone}
            className="px-4 py-2 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-lg hover:bg-[#f5f0f5] transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}

        {/*
          Submit button — calls handleSubmit; changes colour and label based on state.

          Normal (rose):   bg-rose-700 border-rose-800  (dark rose)
                           hover:bg-rose-900             (darkens on hover)
                           active:scale-95               (press effect)
                           disabled:opacity-60           (while loading)
          Success (green): bg-emerald-600 border-emerald-700
                           stays for 1.5 s then auto-closes

          transition-all duration-150 → colour changes animate smoothly
        */}
        {canWrite(resourceType) && (
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
        )}
      </div>
    </div>
  );
}
