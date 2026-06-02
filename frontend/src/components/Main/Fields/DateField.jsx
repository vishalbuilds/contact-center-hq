/*
  DateField.jsx — a calendar date picker for date fields.

  Used by: HOOForm and RecordForm / TableForm for any field in schema.json
  that has "type": "date" (e.g. exceptionDate in the HOO exception table).

  DATE FORMAT CONVERSION
  ──────────────────────
  The browser's native <input type="date"> always requires and returns dates
  in YYYY-MM-DD format (ISO 8601). However, this app stores dates in
  DynamoDB as MM/DD/YYYY strings (e.g. "06/25/2025").

  Two helper functions handle the conversion so the parent form and the
  database always use MM/DD/YYYY while the input element uses YYYY-MM-DD:

    toInputValue(v)   — converts MM/DD/YYYY → YYYY-MM-DD for the input
    fromInputValue(v) — converts YYYY-MM-DD → MM/DD/YYYY for storage

  WHAT IT SHOWS
  ─────────────
  • Field title (bold, dark plum) with a red * if required
  • Field description (tiny purple hint text)
  • A white date picker input — clicking it opens the browser's date picker
  • A red "This field is required" message if validation failed

  ERROR STATE
  ───────────
  When error=true the border and focus ring turn rose-red.
  Clears when the user picks a date (handled by the parent form).

  PROPS
  ─────
  field    — field object from schema.json:
               { id, title, description, required, ... }
  value    — current date string in MM/DD/YYYY format (or "" if empty)
  onChange — callback: (fieldId, newValue) => void
             newValue is always in MM/DD/YYYY format ready to save to DynamoDB
  error    — boolean; true shows red error border + message
*/
export default function DateField({ field, value, onChange, error }) {
  /*
    inputId — links <label> to <input> for accessibility.
    Format: "field-<fieldId>", e.g. "field-exceptionDate"
  */
  const inputId = `field-${field.id}`;

  /*
    toInputValue — converts the stored MM/DD/YYYY format to YYYY-MM-DD
    so the browser's date input can display it correctly.

    Cases handled:
      ""              → ""            (empty, leave as-is)
      "2025-06-25"    → "2025-06-25"  (already YYYY-MM-DD, pass through)
      "06/25/2025"    → "2025-06-25"  (convert MM/DD/YYYY → YYYY-MM-DD)
  */
  function toInputValue(v) {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const [m, d, y] = v.split("/");
    if (y && m && d) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return v;
  }

  /*
    fromInputValue — converts the browser's YYYY-MM-DD back to MM/DD/YYYY
    before storing it in form state (and eventually DynamoDB).

    Cases handled:
      ""              → ""            (empty, leave as-is)
      "2025-06-25"    → "06/25/2025"  (convert to storage format)
  */
  function fromInputValue(v) {
    if (!v) return "";
    const [y, m, d] = v.split("-");
    if (y && m && d) return `${m}/${d}/${y}`;
    return v;
  }

  return (
    /*
      Wrapper — vertical stack with 4px gaps.
    */
    <div className="flex flex-col gap-1">

      {/*
        Label — clicking it opens the date picker (linked via htmlFor/id).
        text-xs font-semibold text-[#3b1a3b] → small bold dark-plum
        Red * if required.
      */}
      <label htmlFor={inputId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>

      {/*
        Description — explains what date this field represents.
        (e.g. "Exception date" for the HOO exception table)
        text-[10px] text-[#7a4f7a] leading-tight → tiny muted-purple hint text
      */}
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>

      {/*
        Date input — the browser's native calendar date picker.

        type="date"           → shows a calendar icon; clicking opens the picker
        value={toInputValue}  → converts MM/DD/YYYY → YYYY-MM-DD for the browser
        onChange              → converts YYYY-MM-DD → MM/DD/YYYY before calling
                                the parent's onChange with the storage format

        Tailwind classes match other Field components for visual consistency.
        Error-conditional border/ring: same rose-red pattern.
      */}
      <input
        id={inputId}
        type="date"
        value={toInputValue(value)}
        onChange={(e) => onChange(field.id, fromInputValue(e.target.value))}
        className={`mt-1 px-3 py-1.5 text-sm text-[#3b1a3b] bg-white rounded-lg border
          focus:outline-none focus:ring-1 transition-colors duration-150
          ${error
            ? "border-rose-600 focus:border-rose-600 focus:ring-rose-600"
            : "border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700"
          }`}
      />

      {/* Validation error */}
      {error && <p className="text-[10px] text-rose-600 mt-0.5">This field is required</p>}
    </div>
  );
}
