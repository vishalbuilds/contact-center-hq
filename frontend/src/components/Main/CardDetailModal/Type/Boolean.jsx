export default function BooleanField({ field, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#3b1a3b]">
        {field.title}
        {field.required && <span className="text-rose-700 ml-1">*</span>}
      </label>
      <p className="text-[10px] text-[#7a4f7a] leading-tight">{field.description}</p>
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => onChange(field.id, true)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer
            ${value === true
              ? "bg-rose-700 text-white border-rose-800"
              : "bg-[#d4c8d4] text-[#5b2d5b] border-[#b8a8b8] hover:bg-[#c0b0c0]"
            }`}
        >
          True
        </button>
        <button
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
    </div>
  );
}
