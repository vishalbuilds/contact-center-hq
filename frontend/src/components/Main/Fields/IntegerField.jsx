/*
  IntegerField.jsx — a whole-number input for numeric fields.

  Used by: HOOForm and RecordForm / TableForm for any field in schema.json
  that has "type": "integer". Currently no fields use this type but it is
  available and ready if schema.json adds one.

  WHAT IT SHOWS
  ─────────────
  • Field title (bold, dark plum) with a red * if required
  • Field description (tiny purple hint text)
  • A white number input — the browser shows up/down spinner arrows by default
    • step=1 ensures only whole numbers can be entered (no decimals)
    • min/max come from field.min and field.max in schema.json (optional)
  • A red "This field is required" message if validation failed

  VALUE HANDLING
  ──────────────
  When the user clears the box: the value becomes "" (empty string) which is
  stored as-is so the field appears empty rather than showing 0.
  When the user types a number: e.target.value is converted with Number() so
  the parent form stores an actual number, not a string.

  ERROR STATE
  ───────────
  When error=true the border and focus ring turn rose-red. Clears when the
  user starts typing (handled by the parent form).

  PROPS
  ─────
  field    — field object from schema.json:
               { id, title, description, required, defaultValue, min?, max?, ... }
  value    — current number or "" managed by parent form state
  onChange — callback: (fieldId, newValue) => void
             newValue is "" when the box is empty, or a Number otherwise
  error    — boolean; true shows red error border and message
*/
export default function IntegerField({ field, value, onChange, error }) {
  /*
    inputId — links <label> to <input> for accessibility (clicking label focuses input).
    Format: "field-<fieldId>"
  */
  const inputId = `field-${field.id}`;

  return (
    /*
      Wrapper — vertical stack with 4px gaps between label, description, input, error.
    */
    <div className="flex flex-col gap-1">
      {/*
        Label — clicking focuses the number input.
        text-xs font-semibold text-[#3b1a3b] → small bold dark-plum
        Red * if required.
      */}
      <label htmlFor={inputId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>

      {/*
        Description — explains what the number represents.
        text-[10px] text-[#7a4f7a] leading-tight → tiny muted-purple hint text
      */}
      <p className="text-[10px] text-[#7a4f7a] leading-tight">
        {field.description}
      </p>

      {/*
        Number input — the editable box.

        type="number"   → browser renders up/down arrows; only numbers allowed
        step={1}        → only whole numbers (integers), no decimal steps
        min={field.min} → optional minimum value from schema.json
        max={field.max} → optional maximum value from schema.json
        value={value ?? ""} → controlled; ?? "" prevents undefined
        onChange        → when the box is empty: stores ""; otherwise Number(value)
                           so the parent always holds a real number or empty string
        placeholder     → shows the defaultValue as a grey hint while empty

        Tailwind classes match StringField for visual consistency.
        Error-conditional border/ring: same rose-red pattern as other fields.
      */}
      <input
        id={inputId}
        type="number"
        step={1}
        min={field.min}
        max={field.max}
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            field.id,
            e.target.value === "" ? "" : Number(e.target.value),
          )
        }
        className={`mt-1 px-3 py-1.5 text-sm text-[#3b1a3b] bg-white rounded-lg border
          focus:outline-none focus:ring-1 placeholder:text-[#b8a8b8] transition-colors duration-150
          ${
            error
              ? "border-rose-600 focus:border-rose-600 focus:ring-rose-600"
              : "border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700"
          }`}
        placeholder={
          field.defaultValue !== undefined ? String(field.defaultValue) : ""
        }
      />

      {/* Validation error */}
      {error && (
        <p className="text-[10px] text-rose-600 mt-0.5">
          This field is required
        </p>
      )}
    </div>
  );
}
