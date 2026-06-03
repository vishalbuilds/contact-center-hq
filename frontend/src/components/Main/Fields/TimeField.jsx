import { useUserSettings } from "../../../context/UserSettingsContext.jsx";
import { convertTime, tzAbbr } from "../utils/tzUtils.js";

export default function TimeField({ field, value, onChange, error }) {
  const { userTz, storedTz } = useUserSettings();
  const inputId = `field-${field.id}`;
  const converting = userTz !== storedTz;

  // Display in user's timezone; stored value is always in storedTz (EST)
  const displayValue = converting && value ? convertTime(value, storedTz, userTz) : (value ?? "");

  const handleChange = (e) => {
    const raw = e.target.value;
    const stored = converting && raw ? convertTime(raw, userTz, storedTz) : raw;
    onChange(field.id, stored);
  };

  // value is already in storedTz — no need to re-convert displayValue back.
  const conversionHint =
    converting && displayValue
      ? `${displayValue} ${tzAbbr(userTz)} → ${value ?? ""} ${tzAbbr(storedTz)}`
      : null;

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
        value={displayValue}
        onChange={handleChange}
        className={`mt-1 px-3 py-1.5 text-sm text-[#3b1a3b] bg-white rounded-lg border
          focus:outline-none focus:ring-1 transition-colors duration-150
          ${error
            ? "border-rose-600 focus:border-rose-600 focus:ring-rose-600"
            : "border-[#b8a8b8] focus:border-rose-700 focus:ring-rose-700"
          }`}
      />
      {conversionHint && (
        <p className="text-[10px] text-[#8b6b8b] font-mono mt-0.5">{conversionHint}</p>
      )}
      {error && <p className="text-[10px] text-rose-600 mt-0.5">This field is required</p>}
    </div>
  );
}
