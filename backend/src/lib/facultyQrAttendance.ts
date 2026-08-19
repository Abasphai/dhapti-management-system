import { createHash, randomBytes } from "node:crypto";

import type { AttendanceQrMode } from "@prisma/client";

import {
  cacheAttendanceQrRaw,
  clearAttendanceQrRawCacheMany,
  getCachedAttendanceQrRaw,
} from "./attendanceQrTokenCache.js";
import { todayDateOnly, parseDateOnly } from "./attendanceCalc.js";
import {
  DEFAULT_INSTITUTION_TIMEZONE,
  sessionDateToDateStr,
  zonedWallClockToUtc,
} from "./institutionTime.js";
import {
  getFacultyAttendancePolicy,
  getInstitutionTimezone,
  getSystemSettings,
} from "./settings.js";
import { prisma } from "./prisma.js";

/** Opaque QR payload prefix — never embeds PII. */
export const QR_PAYLOAD_PREFIX = "DHAPTI-ATT:";

export function hashAttendanceQrToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function mintRawAttendanceQrToken(): string {
  return randomBytes(32).toString("base64url");
}

export function encodeQrPayload(rawToken: string): string {
  return `${QR_PAYLOAD_PREFIX}${rawToken}`;
}

export function extractRawTokenFromPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(QR_PAYLOAD_PREFIX)) {
    const t = trimmed.slice(QR_PAYLOAD_PREFIX.length).trim();
    return t || null;
  }
  // Allow bare token (scanner may strip prefix in some apps)
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("t") || url.searchParams.get("token");
    if (t) return t.trim() || null;
  } catch {
    /* not a URL */
  }
  return null;
}

/** Parse "HH:mm" or "HH:mm:ss" into minutes from midnight. */
export function parseClockToMinutes(clock: string | null | undefined): number | null {
  if (!clock?.trim()) return null;
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

/**
 * Combine ClassSession calendar date (UTC-midnight YYYY-MM-DD) with wall-clock
 * schedule string in the institution timezone.
 */
export function scheduledInstant(
  dateUtcMidnight: Date,
  clock: string | null | undefined,
  _now = new Date(),
  timeZone: string = DEFAULT_INSTITUTION_TIMEZONE
): Date | null {
  if (!clock?.trim()) return null;
  const dateStr = sessionDateToDateStr(dateUtcMidnight);
  return zonedWallClockToUtc(dateStr, clock.trim(), timeZone);
}

export function computeLateByMinutes(
  scheduledStart: Date | null,
  checkInAt: Date,
  graceMinutes: number
): number {
  if (!scheduledStart) return 0;
  const graceMs = graceMinutes * 60_000;
  const threshold = scheduledStart.getTime() + graceMs;
  if (checkInAt.getTime() <= threshold) return 0;
  return Math.floor((checkInAt.getTime() - scheduledStart.getTime()) / 60_000);
}

/**
 * QR scan temporal gate: institution date + configurable early-start / late-end window.
 */
export function evaluateQrAttendanceWindow(input: {
  sessionDate: Date;
  startClock: string | null | undefined;
  endClock: string | null | undefined;
  now: Date;
  timeZone: string;
  earlyStartMinutes: number;
  lateEndMinutes: number;
}): { ok: true } | { ok: false; message: string } {
  const sessionDay = sessionDateToDateStr(input.sessionDate);
  const today = todayDateOnly(input.now, input.timeZone);

  if (sessionDay < today) {
    return {
      ok: false,
      message:
        "This class session is not scheduled for today. Scan attendance only for today's classes.",
    };
  }
  if (sessionDay > today) {
    return {
      ok: false,
      message:
        "This class session is scheduled for a future date and cannot be attended yet.",
    };
  }

  const start = scheduledInstant(
    input.sessionDate,
    input.startClock,
    input.now,
    input.timeZone
  );
  const end = scheduledInstant(
    input.sessionDate,
    input.endClock,
    input.now,
    input.timeZone
  );

  // Makeup / unscheduled clock: date match is enough when clocks are absent.
  if (!start || !end) {
    return { ok: true };
  }

  const windowStart =
    start.getTime() - input.earlyStartMinutes * 60_000;
  const windowEnd = end.getTime() + input.lateEndMinutes * 60_000;
  const t = input.now.getTime();

  if (t < windowStart) {
    return {
      ok: false,
      message:
        "Attendance is not open yet for this class. Please wait until the allowed start window.",
    };
  }
  if (t > windowEnd) {
    return {
      ok: false,
      message:
        "The attendance window for this class has closed. Contact an administrator if you need a correction.",
    };
  }
  return { ok: true };
}

export type DisplayMode = AttendanceQrMode | "IDLE";

/**
 * Department display mode:
 * - END if any in-progress faculty attendance today in this department
 * - START if any scheduled/not-started session today exists
 * - IDLE otherwise
 *
 * Limitation (documented): one display cannot show START and END simultaneously
 * when multiple classes overlap; teachers needing the opposite action may use manual attendance.
 */
export async function resolveDepartmentDisplayMode(
  departmentId: string,
  now = new Date(),
  timeZone?: string
): Promise<{
  mode: DisplayMode;
  hint: string;
  activeCount: number;
  awaitingStartCount: number;
}> {
  const tz = timeZone ?? (await getInstitutionTimezone());
  const dateStr = todayDateOnly(now, tz);
  const date = parseDateOnly(dateStr)!;

  const sessions = await prisma.classSession.findMany({
    where: {
      date,
      classSection: {
        status: "ACTIVE",
        course: { departmentId },
      },
    },
    include: {
      teacherAttendance: true,
      classSection: {
        select: {
          startTime: true,
          endTime: true,
          room: true,
          course: { select: { code: true, title: true } },
        },
      },
    },
  });

  let activeCount = 0;
  let awaitingStartCount = 0;

  for (const s of sessions) {
    const ta = s.teacherAttendance;
    if (ta && !ta.endedAt && (ta.status === "ACTIVE" || ta.status === "LATE")) {
      activeCount += 1;
      continue;
    }
    if (s.status === "COMPLETED" || s.status === "CANCELLED") continue;
    if (ta?.endedAt) continue;
    awaitingStartCount += 1;
  }

  if (activeCount > 0) {
    return {
      mode: "END",
      hint: "END ATTENDANCE",
      activeCount,
      awaitingStartCount,
    };
  }
  if (awaitingStartCount > 0 || sessions.length > 0) {
    return {
      mode: "START",
      hint: "START ATTENDANCE",
      activeCount,
      awaitingStartCount,
    };
  }
  return {
    mode: "IDLE",
    hint: "NO ACTIVE SESSIONS",
    activeCount: 0,
    awaitingStartCount: 0,
  };
}

/** Safe public session summary for display (no teacher PII). */
export async function listSafeDisplaySessions(
  departmentId: string,
  now = new Date(),
  timeZone?: string
) {
  const tz = timeZone ?? (await getInstitutionTimezone());
  const dateStr = todayDateOnly(now, tz);
  const date = parseDateOnly(dateStr)!;

  const sessions = await prisma.classSession.findMany({
    where: {
      date,
      classSection: {
        status: "ACTIVE",
        course: { departmentId },
      },
      status: { in: ["SCHEDULED", "OPEN"] },
    },
    include: {
      teacherAttendance: { select: { status: true, endedAt: true } },
      classSection: {
        select: {
          room: true,
          startTime: true,
          endTime: true,
          section: true,
          course: { select: { code: true, title: true } },
        },
      },
    },
    orderBy: { scheduledStartTime: "asc" },
    take: 8,
  });

  return sessions.map((s) => {
    const inProgress =
      !!s.teacherAttendance &&
      !s.teacherAttendance.endedAt &&
      (s.teacherAttendance.status === "ACTIVE" ||
        s.teacherAttendance.status === "LATE");
    return {
      courseCode: s.classSection.course.code,
      courseTitle: s.classSection.course.title,
      section: s.classSection.section,
      room: s.classSection.room,
      scheduledStartTime: s.scheduledStartTime ?? s.classSection.startTime,
      scheduledEndTime: s.scheduledEndTime ?? s.classSection.endTime,
      state: inProgress ? "IN_PROGRESS" : "AWAITING",
    };
  });
}

/** Per location+mode async mutex (SQLite has no partial unique index for active tokens). */
const mintLocks = new Map<string, Promise<unknown>>();

async function withMintLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = mintLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = prev.then(() => gate);
  mintLocks.set(
    key,
    next.catch(() => undefined).then(() => undefined)
  );
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (mintLocks.get(key) === next) {
      mintLocks.delete(key);
    }
  }
}

async function findActiveValidToken(
  locationId: string,
  mode: AttendanceQrMode,
  now: Date
) {
  return prisma.attendanceQRToken.findFirst({
    where: {
      locationId,
      mode,
      active: true,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { issuedAt: "desc" },
  });
}

/**
 * Get or mint the current active QR token for a location + mode.
 * Rotates when expired or missing. Does NOT revoke on teacher scan (multi-teacher safe).
 * Public callers must not pass forceRotate.
 */
export async function getOrRotateQrToken(input: {
  locationId: string;
  departmentId: string;
  mode: AttendanceQrMode;
  now?: Date;
}) {
  const issued = await issueDisplayQrToken({
    locationId: input.locationId,
    departmentId: input.departmentId,
    mode: input.mode,
    now: input.now,
  });
  return {
    tokenId: issued.tokenId,
    rawToken: issued.payload
      ? issued.payload.slice(QR_PAYLOAD_PREFIX.length)
      : null,
    payload: issued.payload,
    issuedAt: issued.issuedAt,
    expiresAt: issued.expiresAt,
    reused: issued.reused,
  };
}

/**
 * Public display mint:
 * - Reuse active valid token whenever possible (return payload from memory cache).
 * - Never revoke a still-valid token because of anonymous ?force=1.
 * - Mint only when no valid active token exists, or cache was lost after restart
 *   (single rotate under mutex — not DoS-able via force query).
 *
 * SQLite: no partial unique index; mutex + transaction enforce one active mint path.
 */
export async function issueDisplayQrToken(input: {
  locationId: string;
  departmentId: string;
  mode: AttendanceQrMode;
  now?: Date;
  /**
   * Ignored for public safety (H1). Kept for API compatibility — admin regenerate
   * uses revokeAttendanceTokensForLocation instead.
   */
  forceNewPayload?: boolean;
}) {
  void input.forceNewPayload; // intentionally ignored — anonymous force must not rotate
  const now = input.now ?? new Date();
  const lockKey = `${input.locationId}:${input.mode}`;

  return withMintLock(lockKey, async () => {
    const policy = await getFacultyAttendancePolicy();
    const ttlMs = policy.qrTokenTtlSeconds * 1000;

    const existing = await findActiveValidToken(
      input.locationId,
      input.mode,
      now
    );

    if (existing) {
      const cached = getCachedAttendanceQrRaw(existing.id, now);
      if (cached) {
        return {
          tokenId: existing.id,
          payload: encodeQrPayload(cached),
          keepClientPayload: false as const,
          issuedAt: existing.issuedAt,
          expiresAt: existing.expiresAt,
          ttlSeconds: policy.qrTokenTtlSeconds,
          reused: true as const,
        };
      }
      // Process restart: active hash exists but raw is gone — must mint once to serve kiosk.
      // Still under mutex so concurrent display polls do not thrash.
    }

    return prisma.$transaction(async (tx) => {
      // Deactivate any active rows for this location+mode (expired or cache-miss rotate)
      const prior = await tx.attendanceQRToken.findMany({
        where: {
          locationId: input.locationId,
          mode: input.mode,
          active: true,
        },
        select: { id: true },
      });
      if (prior.length > 0) {
        await tx.attendanceQRToken.updateMany({
          where: {
            locationId: input.locationId,
            mode: input.mode,
            active: true,
          },
          data: { active: false, revokedAt: now },
        });
        clearAttendanceQrRawCacheMany(prior.map((p) => p.id));
      }

      const rawToken = mintRawAttendanceQrToken();
      const expiresAt = new Date(now.getTime() + ttlMs);
      const created = await tx.attendanceQRToken.create({
        data: {
          locationId: input.locationId,
          departmentId: input.departmentId,
          mode: input.mode,
          tokenHash: hashAttendanceQrToken(rawToken),
          issuedAt: now,
          expiresAt,
          active: true,
        },
      });

      cacheAttendanceQrRaw(created.id, rawToken, expiresAt);

      return {
        tokenId: created.id,
        payload: encodeQrPayload(rawToken),
        keepClientPayload: false as const,
        issuedAt: created.issuedAt,
        expiresAt: created.expiresAt,
        ttlSeconds: policy.qrTokenTtlSeconds,
        reused: false as const,
      };
    });
  });
}

/** Admin/manual regeneration — revoke all active tokens for a location. */
export async function revokeAttendanceTokensForLocation(
  locationId: string,
  now = new Date()
) {
  const active = await prisma.attendanceQRToken.findMany({
    where: { locationId, active: true },
    select: { id: true },
  });
  const result = await prisma.attendanceQRToken.updateMany({
    where: { locationId, active: true },
    data: { active: false, revokedAt: now },
  });
  clearAttendanceQrRawCacheMany(active.map((t) => t.id));
  return result;
}

export async function lookupValidQrToken(rawToken: string, now = new Date()) {
  const tokenHash = hashAttendanceQrToken(rawToken);
  const row = await prisma.attendanceQRToken.findUnique({
    where: { tokenHash },
    include: {
      location: {
        select: {
          id: true,
          departmentId: true,
          name: true,
          code: true,
          status: true,
          roomHint: true,
        },
      },
    },
  });
  return { row, tokenHash, now };
}

export async function universityDisplayName() {
  const s = await getSystemSettings();
  return s.universityName;
}
