/**
 * Institution wall-clock helpers (ADR-012 / ADR-017).
 * Do not use the API host OS timezone for academic "today" or schedule binding.
 */

export const DEFAULT_INSTITUTION_TIMEZONE = "Africa/Mogadishu";

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD for `now` in the given IANA timezone. */
export function todayDateOnlyInTimeZone(
  now = new Date(),
  timeZone: string = DEFAULT_INSTITUTION_TIMEZONE
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    // Extremely unlikely; fall back to UTC calendar date.
    return now.toISOString().slice(0, 10);
  }
  return `${y}-${m}-${d}`;
}

/** ClassSession.date is stored as UTC midnight of the calendar YYYY-MM-DD. */
export function sessionDateToDateStr(dateUtcMidnight: Date): string {
  return dateUtcMidnight.toISOString().slice(0, 10);
}

function wallPartsInTimeZone(instant: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;

  let hour = Number(get("hour"));
  // Some engines emit "24" for midnight
  if (hour === 24) hour = 0;

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/**
 * Convert a campus wall-clock (date + HH:mm) in `timeZone` to an absolute UTC Date.
 * Does not depend on process.env.TZ / OS local timezone.
 */
export function zonedWallClockToUtc(
  dateStr: string,
  clock: string,
  timeZone: string = DEFAULT_INSTITUTION_TIMEZONE
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = Number(m[3] ?? "0");
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const y = Number(dateStr.slice(0, 4));
  const mo = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));

  // Initial guess: treat wall time as if it were UTC, then correct via Intl.
  let guess = Date.UTC(y, mo - 1, d, hour, minute, second);

  for (let i = 0; i < 5; i++) {
    const wall = wallPartsInTimeZone(new Date(guess), timeZone);
    const wallAsUtc = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second
    );
    const desiredAsUtc = Date.UTC(y, mo - 1, d, hour, minute, second);
    const diff = wallAsUtc - desiredAsUtc;
    if (diff === 0) break;
    guess -= diff;
  }

  return new Date(guess);
}

/** Debug/helper: format an instant as HH:mm:ss in the institution zone. */
export function formatClockInTimeZone(
  instant: Date,
  timeZone: string = DEFAULT_INSTITUTION_TIMEZONE
): string {
  const w = wallPartsInTimeZone(instant, timeZone);
  return `${pad2(w.hour)}:${pad2(w.minute)}:${pad2(w.second)}`;
}
