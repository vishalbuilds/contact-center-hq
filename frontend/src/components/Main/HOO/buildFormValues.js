import { estToLocal } from "../../../utils/timezone.js";

/*
  buildFormValues.js — builds the initial values object for the HOO form.

  Used by: HOOModal (handleCreateNew, handleOpen, handleDuplicate) and
  HOOWeekView (openEdit, openDuplicate, openCreate) to prepare the object
  that is passed as initialValues to HOOForm.

  WHY THIS EXISTS
  ───────────────
  Every field in schema.json needs a starting value before the form renders.
  If we are editing or duplicating an existing record the values come from
  that record. If we are creating a new record the values come from the field's
  defaultValue in schema.json.

  Without this helper every caller would have to write the same loop to map
  field definitions to their starting values — centralising it here means
  the logic only lives in one place.

  HOW FIELDS ARE READ
  ───────────────────
  Each field in schema.json can be either:
    • a top-level attribute on the record  (no "isPayload" flag)
    • inside the record.payload object     ("isPayload": true)

  This function checks f.isPayload to know which source to read from.

  SPECIAL CASE: autoGenerate = "uuid"
  When a new record is being created (record = null) and a field has
  "autoGenerate": "uuid" in schema.json, a fresh UUID is generated
  automatically using crypto.randomUUID(). This is used for fields
  that need a globally unique identifier without the user typing one.

  BOOLEAN NORMALISATION
  ─────────────────────
  DynamoDB can return booleans as the string "true" or the actual boolean true.
  This function always converts them to a real JavaScript boolean (true/false)
  so BooleanField always receives a proper boolean, never a string.

  PARAMETERS
  ──────────
  hooConfig  — the full config object for this HOO table from schema.json
               (contains .fields, .partitionKey, .sortKey, etc.)
  record     — the existing DynamoDB record object if editing/duplicating,
               or null when creating a brand-new record

  RETURNS
  ───────
  An object keyed by field.id with the starting value for every field.
  Example:
    {
      queueArn:  "arn:aws:connect:us-east-1:123:queue/MyQueue",
      queueName: "Support Queue",
      dayOfWeek: "Monday",
      startTime: "09:00",   ← from record.payload
      endTime:   "17:00",   ← from record.payload
      timezone:  "America/New_York",
      vmMenu:    false,
      offerVm:   false,
    }
*/
export function buildFormValues(hooConfig, record) {
  const vals = {};

  hooConfig.fields?.forEach((f) => {
    /*
      Determine the source object for this field:
        isPayload=true  → read from record.payload (nested object)
        isPayload=false → read from record directly (top-level attribute)
    */
    const src = f.isPayload ? record?.payload : record;

    /*
        Normal value resolution — priority order:
          1. src[f.id]       → value from the existing record (edit/duplicate)
          2. f.defaultValue  → value from schema.json if record doesn't have this field
          3. ""              → empty string as the final fallback

        Boolean normalisation: if the field type is boolean, convert the raw
        value to a real JS boolean. DynamoDB might return true, false, "true",
        or "false" — we always want a real boolean so BooleanField works correctly.

        Time normalisation: time fields are stored in DynamoDB as EST.
        Convert to the user's local time for display only when reading from
        an existing record (record != null). Default values are left as-is.
      */
    const raw = src
      ? (src[f.id] ?? f.defaultValue ?? "")
      : (f.defaultValue ?? "");

    if (f.type === "boolean") {
      vals[f.id] = raw === true || raw === "true";
    } else if (f.type === "time" && record && raw) {
      /* EST (storage) → local (display) */
      vals[f.id] = estToLocal(raw);
    } else {
      vals[f.id] = raw;
    }
  });

  return vals;
}
