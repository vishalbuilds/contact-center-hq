export default function ModalHeader({ title, description, formMode, onBack, onClose, badge }) {
  const modeBadge = {
    create:    { label: "Creating",    cls: "bg-blue-100 text-blue-700 border-blue-200"   },
    duplicate: { label: "Duplicating", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    edit:      { label: "Editing",     cls: "bg-green-100 text-green-700 border-green-200" },
  };

  return (
    <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b border-[#c8b8c8] shrink-0">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer"
            title="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-[#3b1a3b]">{title}</h2>
            {badge}
            {formMode && modeBadge[formMode] && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${modeBadge[formMode].cls}`}>
                {modeBadge[formMode].label}
              </span>
            )}
          </div>
          <p className="text-sm text-[#5b2d5b] mt-0.5">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="px-4 py-1.5 text-sm font-semibold text-[#5b2d5b] bg-[#d4c8d4] rounded-lg border border-[#b8a8b8] hover:bg-[#c0b0c0] active:scale-95 transition-all duration-150 cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
