/*
  BooleanField.jsx — a True / False toggle for yes/no fields.

  Used by: HOOForm and RecordForm / TableForm for any field in schema.json
  that has "type": "boolean" (e.g. enableRecording, vmMenu, offerVm,
  fullClose, onLeave, firstTimeLogin…).

  WHY TWO BUTTONS INSTEAD OF A CHECKBOX
  ──────────────────────────────────────
  A pair of pill buttons ("True" / "False") is clearer and easier to tap
  on small screens than a tiny checkbox. The selected state is highlighted
  in dark rose and the unselected one stays in muted lavender.

  WHAT IT SHOWS
  ─────────────
  • Field title (bold, dark plum) with a red * if required
  • Field description (tiny purple hint text)
  • Two buttons side by side: "True" and "False"
    – The active button (matching current value) is dark rose with white text
    – The inactive button is muted lavender
  • A red error message if validation failed (though booleans always have a
    value so this rarely triggers)

  PROPS
  ─────
  field    — the field object from schema.json:
               { id, title, description, required, defaultValue (true/false), ... }
  value    — boolean; the currently selected value in parent form state
  onChange — callback: (fieldId, newValue) => void
             called with true or false when either button is clicked
  error    — boolean; true shows the red error message
*/
export default function BooleanField({ field, value, onChange, error }) {
  return (
    /*
      Wrapper — stacks all elements vertically with 4px gaps.
    */
    <div className="flex flex-col gap-1">

      {/*
        Title — shown as a plain <span> (not a <label>) because there is no
        single focusable input to link it to; the two buttons form the input.
        text-xs font-semibold text-[#3b1a3b] → small bold dark-plum text

        Red asterisk if the field is marked required in schema.json.
      */}
      <span className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </span>

      {/*
        Description — hint text explaining the boolean's purpose.
        (e.g. "enable or disable call recording for this user")
        text-[10px] text-[#7a4f7a] leading-tight → very small muted-purple text
      */}
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>

      {/*
        Button group — the two toggles sit side by side.
        mt-1 flex gap-2 → 4px top gap, 8px space between buttons
        role="group" aria-label → marks these as a related control group
                                   for screen readers
      */}
      <div className="mt-1 flex gap-2" role="group" aria-label={field.title}>

        {/*
          "True" button — calls onChange with the boolean true when clicked.

          Active state (value === true):
            bg-rose-700 text-white border-rose-800
            → filled dark-rose background, white text, dark-rose border
          Inactive state (value !== true):
            bg-[#d4c8d4] text-[#5b2d5b] border-[#b8a8b8]
            → muted lavender background, purple text, mauve border
            hover:bg-[#c0b0c0] → slightly darker on hover

          Common classes:
            px-4 py-1.5         → comfortable button padding
            text-xs font-semibold → small bold label
            rounded-lg border   → rounded corners with border
            transition-all duration-150 → smooth colour change
            cursor-pointer      → hand cursor
        */}
        <button
          type="button"
          onClick={() => onChange(field.id, true)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer
            ${value === true
              ? "bg-rose-700 text-white border-rose-800"
              : "bg-[#d4c8d4] text-[#5b2d5b] border-[#b8a8b8] hover:bg-[#c0b0c0]"
            }`}
        >
          True
        </button>

        {/*
          "False" button — calls onChange with the boolean false when clicked.
          Same active/inactive logic as the True button but mirrors the value check.
        */}
        <button
          type="button"
          onClick={() => onChange(field.id, false)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer
            ${value === false
              ? "bg-rose-700 text-white border-rose-800"
              : "bg-[#d4c8d4] text-[#5b2d5b] border-[#b8a8b8] hover:bg-[#c0b0c0]"
            }`}
        >
          False
        </button>
      </div>

      {/* Validation error — rarely triggered for booleans since they always have a value */}
      {error && <p className="text-[10px] text-rose-600 mt-0.5">This field is required</p>}
    </div>
  );
}
