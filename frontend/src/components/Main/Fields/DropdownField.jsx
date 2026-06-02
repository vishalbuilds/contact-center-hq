/*
  DropdownField.jsx — a select (dropdown) menu for fields with a fixed list of choices.

  Used by: HOOForm and RecordForm / TableForm for any field in schema.json
  that has "type": "dropdown" (e.g. defaultLanguage, lob, shift, timezone,
  dayOfWeek, exceptionType…).

  WHAT IT SHOWS
  ─────────────
  • Field title (bold, dark plum) with a red * if the field is required
  • Field description (tiny purple text) explaining what the field is for
  • A white <select> dropdown — options come from field.options in schema.json
  • A red "This field is required" message below if validation failed

  EMPTY OPTION
  ────────────
  If field.options includes an empty string "" it is rendered as "-- Select --"
  so the user knows they need to make a choice. This acts as a placeholder row
  at the top of the dropdown.

  ERROR STATE
  ───────────
  When error=true the select border turns rose-red and the focus ring also
  turns rose-red. The error text appears below. Clears when the user picks
  an option (handled by the parent form).

  PROPS
  ─────
  field    — the field object from schema.json:
               { id, title, description, required, options: string[], ... }
  value    — the currently selected option string managed by parent form state
  onChange — callback: (fieldId, newValue) => void
             called when the user picks a different option
  error    — boolean; true means show red error border + message
*/
export default function DropdownField({ field, value, onChange, error }) {
  /*
    selectId — links the <label> to the <select> for accessibility.
    Format: "field-<fieldId>", e.g. "field-timezone"
  */
  const selectId = `field-${field.id}`;

  return (
    /*
      Wrapper — stacks label, description, select, and error text vertically.
      flex flex-col gap-1 → 4px gap between each child
    */
    <div className="flex flex-col gap-1">

      {/*
        Label — clicking it opens the dropdown (linked via htmlFor/id).
        text-xs font-semibold → small bold text
        text-[#3b1a3b]        → dark plum colour

        Red asterisk (*) appears only when field.required=true in schema.json.
      */}
      <label htmlFor={selectId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>

      {/*
        Description — a short hint about what this dropdown controls.
        (e.g. "Timezone for the schedule", "Type of exception")
        text-[10px] text-[#7a4f7a] leading-tight → tiny muted-purple text
      */}
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>

      {/*
        <select> — the native browser dropdown menu.

        value={value ?? ""}    → controlled; ?? "" prevents undefined value
        onChange               → fires when the user picks a different option;
                                  e.target.value is the new selected string

        Tailwind classes:
          mt-1 px-3 py-1.5    → spacing matching StringField for visual consistency
          text-sm text-[#3b1a3b] → 14px dark-plum text for the selected option
          bg-white            → white background
          rounded-lg          → rounded corners
          border              → border (colour from error conditional)
          focus:outline-none focus:ring-1 → custom focus ring instead of browser default
          transition-colors duration-150  → smooth colour transitions
          cursor-pointer      → shows hand cursor when hovering (dropdown is clickable)

        Error-conditional border & ring:
          error=true  → rose-red border and focus ring
          error=false → normal mauve border, dark-rose on focus
      */}
      <select
        id={selectId}
        value={value ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        className={`mt-1 px-3 py-1.5 text-sm text-[#3b1a3b] bg-white rounded-lg border
          focus:outline-none focus:ring-1 transition-colors duration-150 cursor-pointer
          ${error
            ? "border-rose-600 focus:border-rose-600 focus:ring-rose-600"
            : "border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700"
          }`}
      >
        {/*
          Options loop — renders one <option> per entry in field.options.
          If the option string is "" (empty), the label "-- Select --" is shown
          so users understand they need to pick something.
          Each option uses its own string as both the key and the value attribute.
        */}
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt === "" ? "-- Select --" : opt}
          </option>
        ))}
      </select>

      {/* Validation error — only shown when error=true */}
      {error && <p className="text-[10px] text-rose-600 mt-0.5">This field is required</p>}
    </div>
  );
}
