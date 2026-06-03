import { useState, useRef, useEffect } from "react";
import { useUserSettings } from "../../../context/UserSettingsContext.jsx";

const TZ_OPTIONS = [
  { value: "America/New_York",    label: "Eastern  (EST/EDT)  UTC−5/4" },
  { value: "America/Chicago",     label: "Central  (CST/CDT)  UTC−6/5" },
  { value: "America/Denver",      label: "Mountain (MST/MDT)  UTC−7/6" },
  { value: "America/Los_Angeles", label: "Pacific  (PST/PDT)  UTC−8/7" },
  { value: "UTC",                 label: "UTC                 UTC+0"   },
];

export default function SettingsPanel({ dark = false }) {
  const [open, setOpen] = useState(false);
  const { userTz, setUserTz, storedTz } = useUserSettings();
  const ref = useRef(null);
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isOverridden = userTz !== detected;
  const knownOption = TZ_OPTIONS.some((o) => o.value === detected);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="User settings"
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-lg transition-colors cursor-pointer ${
          dark
            ? "text-rose-200 hover:bg-rose-800 hover:text-white"
            : "text-[#8b6b8b] hover:bg-[#e8d8e8] hover:text-[#3b1a3b]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#d4c4d4] shadow-xl z-100 p-4">
          <h3 className="text-sm font-semibold text-[#3b1a3b] mb-3">User Settings</h3>

          <div className="mb-1">
            <label className="text-xs font-semibold text-[#3b1a3b] block mb-1">Your Timezone</label>
            <p className="text-[10px] text-[#8b6b8b] mb-1.5">
              Auto-detected: <span className="font-mono">{detected}</span>
            </p>
            <select
              value={userTz}
              onChange={(e) => setUserTz(e.target.value)}
              className="w-full px-3 py-1.5 text-sm text-[#3b1a3b] bg-white border border-[#b8a8b8] rounded-lg focus:outline-none focus:border-rose-700 cursor-pointer"
            >
              {!knownOption && (
                <option value={detected}>{detected} (auto-detected)</option>
              )}
              {TZ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {isOverridden && (
              <button
                type="button"
                onClick={() => setUserTz(detected)}
                className="mt-1 text-[10px] text-rose-700 hover:underline cursor-pointer"
              >
                Reset to auto-detected
              </button>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-[#e8d8e8]">
            <p className="text-[10px] text-[#8b6b8b] leading-relaxed">
              Time fields show values in your timezone and convert to{" "}
              <span className="font-mono font-semibold">{storedTz}</span> (EST) before saving.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
