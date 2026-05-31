export default function TimeField({ field, value, onChange, error }) {
  const inputId = `field-${field.id}`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>
      <input
        id={inputId}
        type="time"
        value={value ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
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
