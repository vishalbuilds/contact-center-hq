/*
  TimeField.jsx — a clock time picker for time-of-day fields.

  Used by: HOOForm and RecordForm / TableForm for any field in schema.json
  that has "type": "time" (e.g. startTime and endTime in the HOO schedule table).

  HOW TIME VALUES WORK
  ────────────────────
  The browser's native <input type="time"> uses the HH:MM format (24-hour),
  e.g. "09:00" or "17:30". This is stored directly in DynamoDB as-is, so no
  format conversion is needed (unlike DateField which has to convert formats).

  The browser renders a time picker UI — on most platforms this shows an
  hour/minute spinner or a clock widget.

  WHAT IT SHOWS
  ─────────────
  • Field title (bold, dark plum) with a red * if required
  • Field description (tiny purple hint text)
  • A white time input — clicking it opens the browser's time picker
  • A red "This field is required" message if validation failed

  ERROR STATE
  ───────────
  When error=true the border and focus ring turn rose-red.
  Clears when the user picks a time (handled by the parent form).

  PROPS
  ─────
  field    — field object from schema.json:
               { id, title, description, required, defaultValue, ... }
  value    — current time string in HH:MM format (or "" if empty)
  onChange — callback: (fieldId, newValue) => void
             newValue is the HH:MM string from the browser
  error    — boolean; true shows red error border + message
*/
export default function TimeField({ field, value, onChange, error }) {
  /*
    inputId — links <label> to <input> for accessibility.
    Format: "field-<fieldId>", e.g. "field-startTime"
  */
  const inputId = `field-${field.id}`;

  return (
    /*
      Wrapper — vertical stack with 4px gaps.
    */
    <div className="flex flex-col gap-1">
      {/*
        Label — clicking it opens the time picker (linked via htmlFor/id).
        text-xs font-semibold text-[#3b1a3b] → small bold dark-plum
        Red * if the field is marked required in schema.json.
      */}
      <label htmlFor={inputId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>

      {/*
        Description — explains what this time field represents.
        (e.g. "Schedule start time", "Schedule end time")
        text-[10px] text-[#7a4f7a] leading-tight → tiny muted-purple hint text
      */}
      <p className="text-[10px] text-[#7a4f7a] leading-tight">
        {field.description}
      </p>
      <p className="text-[10px] text-[#8b6b8b] leading-tight mt-0.5">
        Format: HH:MM (24-hour, e.g. 09:00 or 17:30)
      </p>

      {/*
        Time input — the browser's native time picker.

        type="time"       → shows a clock icon; clicking opens the time picker
                            Returns values in HH:MM (24-hour) format
        value={value ?? ""} → controlled; ?? "" prevents undefined
        onChange          → passes the HH:MM string directly to the parent
                            form via onChange(field.id, e.target.value)

        Tailwind classes match other Field components for visual consistency.
        Error-conditional border/ring: rose-red when error, mauve when normal.
      */}
      <input
        id={inputId}
        type="time"
        value={value ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        className={`mt-1 px-3 py-1.5 text-sm text-[#3b1a3b] bg-white rounded-lg border
          focus:outline-none focus:ring-1 transition-colors duration-150
          ${
            error
              ? "border-rose-600 focus:border-rose-600 focus:ring-rose-600"
              : "border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700"
          }`}
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
