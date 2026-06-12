import { useState, useEffect } from "react";
import { useUser } from "../../context/UserContext.jsx";
import {
  tzLabel,
  getActiveTZ,
  getBrowserTZ,
  getTZAbbr,
  setActiveTZ,
  getUTCOffsetMin,
  fmtUTCOffset,
  TIMEZONES,
} from "../../utils/timezone.js";

const ACCESS_LABEL = { admin: "Admin", viewer: "Viewer" };
const ACCESS_STYLE = {
  admin: "bg-rose-100 text-rose-700",
  viewer: "bg-blue-100 text-blue-700",
};

/* Format a Date as "2:30 PM" in the given IANA timezone */
function currentTimeIn(ianaName, now) {
  return now.toLocaleTimeString("en-US", {
    timeZone: ianaName,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Header() {
  const [userOpen, setUserOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeTZ, setActiveTZState] = useState(() => getActiveTZ());

  const { user, loading } = useUser();
  const displayName = loading ? "…" : user?.name || user?.username || "Unknown";
  const accessLevel = user?.accessLevel ?? "";
  const initial =
    displayName !== "…" ? displayName.charAt(0).toUpperCase() : "?";

  /* Live clock — only ticks while the dropdown is open */
  useEffect(() => {
    if (!tzOpen) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [tzOpen]);

  const browserTZ = getBrowserTZ();
  const customActive = activeTZ !== browserTZ;

  /*
    Build the displayed list.
    Prepend the browser's detected timezone if it isn't already in TIMEZONES
    so the user can always reach it regardless of their locale.
  */
  const tzList = TIMEZONES.some((t) => t.iana === browserTZ)
    ? TIMEZONES
    : [{ iana: browserTZ, label: "Detected", group: "Detected" }, ...TIMEZONES];

  const handleSelectTZ = (ianaName) => {
    setActiveTZ(ianaName);
    setActiveTZState(ianaName);
    setTzOpen(false);
  };

  const handleRestoreTZ = () => {
    setActiveTZ(null);
    setActiveTZState(getBrowserTZ());
    setTzOpen(false);
  };

  return (
    <header id="app-header" className="bg-rose-900 shadow-md">
      <div
        id="app-header-inner"
        className="w-full px-6 h-10 flex items-center justify-between"
      >
        {/* ── Brand ──────────────────────────────────────────────────── */}
        <span
          id="app-header-brand-title"
          className="text-xl font-semibold text-white tracking-wide"
        >
          Contact Center HQ
        </span>

        {/* ── Right side: timezone dropdown + user dropdown ──────────── */}
        <div className="flex items-center gap-2">
          {/* ── Timezone badge / dropdown trigger ──────────────────────── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!tzOpen) setNow(new Date());
                setTzOpen((v) => !v);
                setUserOpen(false);
              }}
              className="flex items-center gap-1 text-xs font-medium text-rose-200 bg-rose-800 hover:bg-rose-700 px-2.5 py-1 rounded-full border border-rose-700 transition-colors cursor-pointer select-none"
            >
              {tzLabel()}
              <svg
                className={`w-3 h-3 transition-transform duration-150 ${tzOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {tzOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  role="button"
                  tabIndex={0}
                  aria-label="Close timezone picker"
                  onClick={() => setTzOpen(false)}
                  onKeyDown={(e) => e.key === "Escape" && setTzOpen(false)}
                />

                {/* Dropdown */}
                <div className="absolute right-0 mt-1.5 w-80 bg-white rounded-xl shadow-xl z-20 border border-[#e4d4e4] overflow-hidden">
                  {/* ── Restore detected option (only when custom TZ is active) ── */}
                  {customActive && (
                    <div className="border-b border-[#e4d4e4]">
                      <button
                        type="button"
                        onClick={handleRestoreTZ}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <span className="text-base leading-none text-rose-500 shrink-0">
                          ↩
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#3b1a3b]">
                            Restore detected timezone
                          </p>
                          <p className="text-[10px] text-[#8b6b8b] mt-0.5 truncate">
                            {browserTZ} · {getTZAbbr(browserTZ)} ·{" "}
                            {fmtUTCOffset(getUTCOffsetMin(browserTZ))}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#5b2d5b] shrink-0 tabular-nums">
                          {currentTimeIn(browserTZ, now)}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* ── Timezone list with group headers ─────────────────── */}
                  <div className="max-h-72 overflow-y-auto">
                    {(() => {
                      let lastGroup = null;
                      return tzList.map(({ iana, label, group }) => {
                        const isActive = iana === activeTZ;
                        const abbr = getTZAbbr(iana);
                        const showHeader = group !== lastGroup;
                        lastGroup = group;

                        return (
                          <div key={iana}>
                            {/* Group header row */}
                            {showHeader && (
                              <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#a090a0] border-b border-[#f0e8f0]">
                                {group}
                              </div>
                            )}

                            {/* Timezone row */}
                            <button
                              type="button"
                              onClick={() => handleSelectTZ(iana)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer
                                ${isActive ? "bg-rose-50" : "hover:bg-[#f5f0f5]"}`}
                            >
                              {/* Checkmark */}
                              <span
                                className={`text-xs text-rose-600 w-3 shrink-0 leading-none ${isActive ? "opacity-100" : "opacity-0"}`}
                              >
                                ✓
                              </span>

                              {/* Label */}
                              <span
                                className={`flex-1 text-xs font-medium truncate ${isActive ? "text-rose-800" : "text-[#3b1a3b]"}`}
                              >
                                {label}
                              </span>

                              {/* Abbreviation */}
                              <span className="text-[10px] text-[#8b6b8b] shrink-0 w-8 text-right">
                                {abbr}
                              </span>

                              {/* Current local time in this timezone */}
                              <span
                                className={`text-xs font-semibold shrink-0 w-16 text-right tabular-nums ${isActive ? "text-rose-700" : "text-[#5b2d5b]"}`}
                              >
                                {currentTimeIn(iana, now)}
                              </span>
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── User dropdown ──────────────────────────────────────────── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserOpen((v) => !v);
                setTzOpen(false);
              }}
              className="flex items-center gap-2 bg-rose-800 hover:bg-rose-700 text-white text-sm px-3 py-1 rounded transition-colors cursor-pointer"
            >
              <span className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold">
                {initial}
              </span>
              <span>{loading ? "Loading…" : displayName}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-150 ${userOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {userOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  role="button"
                  tabIndex={0}
                  aria-label="Close user menu"
                  onClick={() => setUserOpen(false)}
                  onKeyDown={(e) => e.key === "Escape" && setUserOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-56 bg-white rounded shadow-lg z-20 py-2 text-sm text-gray-700">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-semibold text-gray-900">{displayName}</p>
                    {user?.email && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {user.email}
                      </p>
                    )}
                    {accessLevel && (
                      <p className="mt-1.5">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_STYLE[accessLevel] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {ACCESS_LABEL[accessLevel] ?? accessLevel}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
