/**
 * Attendance percentage policy (Phase 1H / ADR-012):
 *   percentage = Present / (Present + Late + Absent) × 100
 * EXCUSED is excluded from the denominator (does not penalize the student).
 * LATE does not count as Present.
 */
export function calcAttendancePercentage(counts: {
  present: number;
  late: number;
  absent: number;
  excused?: number;
}): number | null {
  const denom = counts.present + counts.late + counts.absent;
  if (denom <= 0) return null;
  return Math.round((counts.present / denom) * 10000) / 100;
}

import {
  DEFAULT_INSTITUTION_TIMEZONE,
  todayDateOnlyInTimeZone,
} from "./institutionTime.js";

/** Parse YYYY-MM-DD → Date at UTC midnight. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Academic "today" as YYYY-MM-DD in the institution timezone (default Africa/Mogadishu).
 * Does not use the API host OS timezone. See ADR-012 / ADR-017.
 */
export function todayDateOnly(
  now = new Date(),
  timeZone: string = DEFAULT_INSTITUTION_TIMEZONE
): string {
  return todayDateOnlyInTimeZone(now, timeZone);
}

export function dateOnlyToUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}
