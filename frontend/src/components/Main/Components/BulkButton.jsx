import { useRef, useState, useEffect } from "react";

const MODES = [
  { id: "get",    label: "Get Data",    icon: "↓", desc: "Fetch records by queue / record name" },
  { id: "create", label: "Bulk Create", icon: "+", desc: "Create new records — fails if already exists" },
  { id: "update", label: "Bulk Update", icon: "↻", desc: "Update existing records — fails if not found" },
];

/*
  BulkButton — upload icon that opens a small dropdown with three bulk operations.
  Viewers (isAdmin=false) only see "Get Data"; admins see all three.

  Props:
    onOpenModal(mode) — called with "get" | "create" | "update" when an item is clicked
    isAdmin           — controls whether Create and Update options are shown
*/
export default function BulkButton({ onOpenModal, isAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visibleModes = MODES.filter((m) => m.id === "get" || isAdmin);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Bulk operations"
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 rounded-xl text-[#8b6b8b] bg-white border border-[#d4c4d4] hover:bg-[#f5f0f5] hover:text-[#3b1a3b] transition-colors cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#d4c4d4] rounded-xl shadow-lg z-20 py-1 w-56 overflow-hidden">
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-[#8b6b8b] uppercase tracking-wider">
            Bulk Operations
          </p>
          {visibleModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setOpen(false); onOpenModal?.(m.id); }}
              className="w-full text-left px-4 py-2.5 hover:bg-[#f5f0f5] transition-colors cursor-pointer"
            >
              <p className="text-sm font-medium text-[#3b1a3b]">
                <span className="mr-1.5 text-rose-700">{m.icon}</span>{m.label}
              </p>
              <p className="text-[10px] text-[#8b6b8b] mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
