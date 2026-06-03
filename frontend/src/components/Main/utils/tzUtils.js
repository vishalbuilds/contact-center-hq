/**
 * Get the UTC offset in milliseconds for a given IANA timezone at the current
 * moment. Using `new Date()` (not a fixed reference) so DST state is accurate
 * for today — avoids the 1-hour error you'd get by always using a January date.
 */
function _offsetMs(tz) {
  const now = new Date();
  const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return tzDate - utcDate;
}

/**
 * Convert "HH:MM" from one IANA timezone to another.
 * Returns the converted "HH:MM" string, wrapping past midnight if needed.
 */
export function convertTime(hhmm, fromTz, toTz) {
  if (!hhmm || fromTz === toTz) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;

  const ms = (h * 60 + m) * 60000 - _offsetMs(fromTz) + _offsetMs(toTz);
  const norm = ((ms % 86400000) + 86400000) % 86400000;
  const nh = Math.floor(norm / 3600000);
  const nm = Math.floor((norm % 3600000) / 60000);
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// Ask the IANA database directly for the correct abbreviation (handles DST
// for any timezone, not just US zones, and uses the target tz — not the
// browser's local clock — so a UTC browser still gets "EDT" in July).
export function tzAbbr(tz) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz.split("/").pop().replace(/_/g, " ");
  }
}
