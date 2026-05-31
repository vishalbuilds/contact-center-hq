export default function DateField({ field, value, onChange, error }) {
  const inputId = `field-${field.id}`;

  // HTML date input requires YYYY-MM-DD; convert MM/DD/YYYY ↔ YYYY-MM-DD
  function toInputValue(v) {
    if (!v) return "";
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // Convert MM/DD/YYYY → YYYY-MM-DD
    const [m, d, y] = v.split("/");
    if (y && m && d) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return v;
  }

  function fromInputValue(v) {
    // Store as MM/DD/YYYY
    if (!v) return "";
    const [y, m, d] = v.split("-");
    if (y && m && d) return `${m}/${d}/${y}`;
    return v;
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>
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
      {error && <p className="text-[10px] text-rose-600 mt-0.5">This field is required</p>}
    </div>
  );
}
