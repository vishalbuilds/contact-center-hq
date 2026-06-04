/*
  timezone.js — local ↔ Eastern-time conversion with user-selectable timezone.

  The storage timezone is America/New_York (DST-aware Eastern time).
  Times are stored as "wall-clock Eastern" — 09:00 means 9 AM Eastern whether
  that is EST (UTC-5) or EDT (UTC-4) at the time the record is saved.
  The "active" timezone is either the browser's detected timezone (default)
  or one the user has chosen from the dropdown (persisted in localStorage).

  All conversion functions (localToEST, estToLocal) and display functions
  (tzAbbr, tzLabel) automatically use the active timezone, so changing it
  from the header dropdown is the only thing a caller needs to do.
*/

const STORAGE_TZ = "America/New_York";

/* ── Core offset helper ────────────────────────────────────────────────────── */

/*
  getUTCOffsetMin — returns the UTC offset in minutes for any IANA timezone
  at the current instant (DST-aware).
  Uses Intl.DateTimeFormat.formatToParts — spec-guaranteed structured output,
  no locale-string re-parsing that varies across browsers.
*/
export function getUTCOffsetMin(ianaName) {
  const now = Date.now();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaName,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const tzAsUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour % 24, // some engines return "24" for midnight with hour12:false
    +parts.minute,
    +parts.second,
  );
  return Math.round((tzAsUtc - now) / 60_000);
}

/* Short timezone abbreviation for any IANA name (e.g. "IST", "EST", "PDT") */
export function getTZAbbr(ianaName) {
  return new Date()
    .toLocaleTimeString("en-US", { timeZone: ianaName, timeZoneName: "short" })
    .split(" ")
    .at(-1);
}

/* Format minutes-from-UTC as a display string: "+5:30", "-8:00", "+0:00" */
export function fmtUTCOffset(offsetMin) {
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0
    ? `UTC${sign}${h}`
    : `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
}

/* ── Active timezone (browser default or user-selected) ────────────────────── */

let _storedTZ = (() => {
  try {
    return localStorage.getItem("cc-hq-tz") || null;
  } catch {
    return null;
  }
})();

export function getBrowserTZ() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/* Returns the active timezone IANA name (stored or browser-detected) */
export function getActiveTZ() {
  return _storedTZ ?? getBrowserTZ();
}

/* True when the user has selected a timezone different from the browser's */
export function isCustomTZ() {
  return _storedTZ !== null;
}

/*
  setActiveTZ — update the active timezone.
  Pass null (or the browser's own timezone) to restore the detected default.
*/
export function setActiveTZ(ianaName) {
  if (!ianaName || ianaName === getBrowserTZ()) {
    _storedTZ = null;
    try {
      localStorage.removeItem("cc-hq-tz");
    } catch {
      /* localStorage may be blocked */
    }
  } else {
    _storedTZ = ianaName;
    try {
      localStorage.setItem("cc-hq-tz", ianaName);
    } catch {
      /* localStorage may be blocked */
    }
  }
}

/* ── Storage-relative display helpers ──────────────────────────────────────── */

/* How many minutes the active timezone is ahead (+) or behind (-) the storage TZ */
export function offsetFromESTMin() {
  return getUTCOffsetMin(getActiveTZ()) - getUTCOffsetMin(STORAGE_TZ);
}

/* Short abbreviation for the active timezone */
export function tzAbbr() {
  return getTZAbbr(getActiveTZ());
}

/* Offset from EST as signed string: "+10:30", "-3:00" */
export function estOffsetLabel() {
  const offset = offsetFromESTMin();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

/* Full badge label: "IST (ET+10:30)" or just "ET abbr" when offset is 0 */
export function tzLabel() {
  const abbr = tzAbbr();
  const offset = offsetFromESTMin();
  if (offset === 0) return abbr;
  return `${abbr} (ET${estOffsetLabel()})`;
}

/* ── Time string conversion ─────────────────────────────────────────────────── */

/* HH:MM in active local time → HH:MM in EST */
export function localToEST(timeStr) {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const estMin = (((h * 60 + m - offsetFromESTMin()) % 1440) + 1440) % 1440;
  return `${String(Math.floor(estMin / 60)).padStart(2, "0")}:${String(estMin % 60).padStart(2, "0")}`;
}

/* HH:MM in EST → HH:MM in active local time */
export function estToLocal(timeStr) {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const localMin = (((h * 60 + m + offsetFromESTMin()) % 1440) + 1440) % 1440;
  return `${String(Math.floor(localMin / 60)).padStart(2, "0")}:${String(localMin % 60).padStart(2, "0")}`;
}

/* ── Timezone list for the dropdown ─────────────────────────────────────────── */

/*
  Each entry has an iana name, display label, and group.
  The Header dropdown renders a group header row whenever the group changes.
  United States timezones are listed first, International below.
*/
export const TIMEZONES = [
  // ── United States ─────────────────────────────────────────────────────────
  { iana: "America/New_York", label: "Eastern", group: "United States" },
  { iana: "America/Chicago", label: "Central", group: "United States" },
  { iana: "America/Denver", label: "Mountain", group: "United States" },
  {
    iana: "America/Phoenix",
    label: "Mountain – Arizona",
    group: "United States",
  },
  { iana: "America/Los_Angeles", label: "Pacific", group: "United States" },
  { iana: "America/Anchorage", label: "Alaska", group: "United States" },
  { iana: "Pacific/Honolulu", label: "Hawaii", group: "United States" },
  { iana: "America/Adak", label: "Hawaii-Aleutian", group: "United States" },
  {
    iana: "America/Indiana/Indianapolis",
    label: "Indiana – Eastern",
    group: "United States",
  },
  {
    iana: "America/Indiana/Knox",
    label: "Indiana – Central",
    group: "United States",
  },
  {
    iana: "America/Indiana/Tell_City",
    label: "Indiana – Perry Co.",
    group: "United States",
  },
  {
    iana: "America/Kentucky/Louisville",
    label: "Kentucky – Eastern",
    group: "United States",
  },
  {
    iana: "America/North_Dakota/Center",
    label: "North Dakota – Central",
    group: "United States",
  },
  {
    iana: "America/Puerto_Rico",
    label: "Puerto Rico – Atlantic",
    group: "United States",
  },
  { iana: "Pacific/Guam", label: "Guam – Chamorro", group: "United States" },
  {
    iana: "Pacific/Pago_Pago",
    label: "American Samoa",
    group: "United States",
  },
  // ── International ─────────────────────────────────────────────────────────
  { iana: "UTC", label: "UTC", group: "International" },
  { iana: "Europe/London", label: "London", group: "International" },
  { iana: "Europe/Paris", label: "Central European", group: "International" },
  { iana: "Asia/Dubai", label: "Gulf", group: "International" },
  { iana: "Asia/Kolkata", label: "India", group: "International" },
  { iana: "Asia/Bangkok", label: "Indochina", group: "International" },
  { iana: "Asia/Shanghai", label: "China", group: "International" },
  { iana: "Asia/Tokyo", label: "Japan", group: "International" },
  { iana: "Asia/Seoul", label: "Korea", group: "International" },
  { iana: "Australia/Sydney", label: "Sydney", group: "International" },
  { iana: "Pacific/Auckland", label: "New Zealand", group: "International" },
];
