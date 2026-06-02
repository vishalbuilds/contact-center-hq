/*
  StringField.jsx — a plain text input for free-text fields.

  Used by: HOOForm and RecordForm / TableForm for any field in schema.json
  that has "type": "string" (e.g. queueName, supervisor, notes, AgentArn…).
  It is also used as the fallback when a field's type is unknown.

  WHAT IT SHOWS
  ─────────────
  • Field title (bold, dark plum) with a red * if the field is required
  • Field description (tiny purple text) explaining what the field is for
  • A white text input box — placeholder shows the defaultValue from schema.json
  • A red "This field is required" message below if validation failed

  ERROR STATE
  ───────────
  When error=true the input border turns rose-red and the focus ring also
  turns rose-red. The red error message text appears below the input.
  The error clears as soon as the user types anything (handled by the parent form).

  PROPS
  ─────
  field    — the field object from schema.json:
               { id, title, description, required, defaultValue, ... }
  value    — the current string value managed by the parent form's state
  onChange — callback: (fieldId, newValue) => void
             called every time the user types a character
  error    — boolean; true means show the red error border + message
*/
export default function StringField({ field, value, onChange, error }) {
  /*
    inputId — links the <label> to the <input> via the htmlFor/id pair.
    This is important for accessibility: clicking the label focuses the input.
    Format: "field-<fieldId>", e.g. "field-queueName"
  */
  const inputId = `field-${field.id}`;

  return (
    /*
      Wrapper — stacks label, description, input, and error message vertically.
      flex flex-col gap-1 → 4px gap between each child element
    */
    <div className="flex flex-col gap-1">

      {/*
        Label — clicking this focuses the input (linked via htmlFor/id).
        text-xs font-semibold → small bold text
        text-[#3b1a3b]        → dark plum colour

        The red asterisk (*) appears only when field.required is true in schema.json.
        text-rose-700 ml-1 → dark rose colour, 4px left margin from the title text
      */}
      <label htmlFor={inputId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>

      {/*
        Description — a short hint explaining what this field is for.
        Comes from field.description in schema.json (e.g. "Amazon resource name of the agent").
        text-[10px]        → very small, 10px font
        text-[#7a4f7a]     → muted purple
        leading-tight      → tighter line height for compact layout
      */}
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>

      {/*
        Text input — the actual editable box.

        value={value ?? ""}    → controlled input; ?? "" ensures React never
                                  receives undefined (which would make it uncontrolled)
        onChange               → fires on every keystroke; passes the new string
                                  value up to the parent form via onChange(field.id, ...)
        placeholder            → shows the field's defaultValue as a grey hint
                                  while the box is empty

        Tailwind classes:
          mt-1                → 4px gap between description and input
          px-3 py-1.5         → 12px horizontal, 6px vertical padding inside the box
          text-sm             → 14px font size for typed text
          text-[#3b1a3b]      → dark plum for the typed characters
          bg-white            → white background
          rounded-lg          → rounded corners
          border              → adds a border (colour set by the error-conditional below)
          focus:outline-none  → removes the browser's default blue focus ring
          focus:ring-1        → adds a subtle custom focus ring (colour below)
          placeholder:text-[#b8a8b8] → light grey-purple for placeholder text
          transition-colors duration-150 → border/ring colour changes animate smoothly

        Error-conditional border & ring:
          error=true  → border-rose-600 focus:border-rose-600 focus:ring-rose-600
                         (red border, red focus ring)
          error=false → border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700
                         (normal mauve border, dark-rose on focus)
      */}
      <input
        id={inputId}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        className={`mt-1 px-3 py-1.5 text-sm text-[#3b1a3b] bg-white rounded-lg border
          focus:outline-none focus:ring-1 placeholder:text-[#b8a8b8] transition-colors duration-150
          ${error
            ? "border-rose-600 focus:border-rose-600 focus:ring-rose-600"
            : "border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700"
          }`}
        placeholder={field.defaultValue || ""}
      />

      {/*
        Validation error message — only rendered when error=true.
        text-[10px] text-rose-600 mt-0.5 → tiny red text, 2px above gap
      */}
      {error && <p className="text-[10px] text-rose-600 mt-0.5">This field is required</p>}
    </div>
  );
}
