import { useState, useRef, useEffect } from "react";

export default function ResultRow({ pkTitle, pkValue, onOpen, onDuplicate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#d4c4d4] hover:border-rose-300 transition-colors">
      <div>
        <p className="text-xs text-[#8b6b8b] uppercase tracking-wide leading-tight">
          {pkTitle}
        </p>
        <p className="font-mono text-sm font-semibold text-[#3b1a3b]">{pkValue}</p>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Options"
          className="p-1.5 rounded-lg text-[#8b6b8b] hover:bg-[#e8d8e8] hover:text-[#3b1a3b] transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {menuOpen && !confirmingDelete && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-[#d4c4d4] rounded-xl shadow-lg z-20 py-1 min-w-35 overflow-hidden">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onOpen(pkValue); }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#3b1a3b] hover:bg-[#f5f0f5] transition-colors cursor-pointer"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDuplicate(pkValue); }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#3b1a3b] hover:bg-[#f5f0f5] transition-colors cursor-pointer"
            >
              Duplicate
            </button>
            <div className="h-px bg-[#e8d8e8] mx-2 my-1" />
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}

        {menuOpen && confirmingDelete && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-red-200 rounded-xl shadow-lg z-20 p-3 min-w-45">
            <p className="text-sm font-semibold text-[#3b1a3b] mb-3">Delete this record?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(pkValue); }}
                className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 active:scale-95 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 px-3 py-1.5 text-xs font-semibold text-[#5b2d5b] bg-[#e8d8e8] rounded-lg hover:bg-[#d4c4d4] active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
