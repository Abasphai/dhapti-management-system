import { Router } from "express";
import { z } from "zod";

import { writeAudit } from "../lib/audit.js";
import { parseDateOnly, todayDateOnly } from "../lib/attendanceCalc.js";
import { sendError, type ErrorCode } from "../lib/errors.js";
import {
  computeLateByMinutes,
  evaluateQrAttendanceWindow,
  extractRawTokenFromPayload,
  issueDisplayQrToken,
  listSafeDisplaySessions,
  lookupValidQrToken,
  resolveDepartmentDisplayMode,
  scheduledInstant,
  universityDisplayName,
} from "../lib/facultyQrAttendance.js";
import { clientIp, createRateLimiter } from "../lib/rateLimit.js";
import {
  getFacultyAttendancePolicy,
  getInstitutionTimezone,
} from "../lib/settings.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeSession, sessionInclude } from "../lib/serializeAttendance.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";
import {
  teacherCheckInSession,
  teacherCheckOutSession,
} from "./teacherAttendanceTimer.js";

export const facultyQrAttendanceRouter = Router();

const displayRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 120,
  keyFn: (req) => `display:${clientIp(req)}`,
  message: "Too many display requests. Please try again shortly.",
});

const scanRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 40,
  keyFn: (req) => {
    const u = (req as AuthedRequest).user?.id;
    return u ? `qr-scan:user:${u}` : `qr-scan:ip:${clientIp(req)}`;
  },
  message: "Too many QR scan attempts. Please try again shortly.",
});

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: {
      user: { select: { status: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  });
}

function auditQr(
  actorId: string | null | undefined,
  action: string,
  meta: Record<string, unknown>
) {
  void writeAudit({
    actorId: actorId ?? null,
    action,
    entityType: "AttendanceQRToken",
    meta,
  });
}

/**
 * GET /attendance/display/:locationId
 * Public kiosk display — opaque QR payload + safe department/session info only.
 * Anonymous ?force=1 is ignored (H1): valid tokens are reused; mint only when needed.
 */
facultyQrAttendanceRouter.get(
  "/attendance/display/:locationId",
  displayRateLimit,
  async (req, res) => {
    const locationId = String(req.params.locationId ?? "").trim();
    if (!locationId) {
      return sendError(res, 400, "BAD_REQUEST", "locationId is required");
    }

    const location = await prisma.attendanceLocation.findUnique({
      where: { id: locationId },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!location || location.status !== "ACTIVE") {
      return sendError(res, 404, "NOT_FOUND", "Attendance display not found");
    }

    const now = new Date();
    const timeZone = await getInstitutionTimezone();
    const modeInfo = await resolveDepartmentDisplayMode(
      location.departmentId,
      now,
      timeZone
    );
    const sessions = await listSafeDisplaySessions(
      location.departmentId,
      now,
      timeZone
    );
    const universityName = await universityDisplayName();
    const dateStr = todayDateOnly(now, timeZone);

    if (modeInfo.mode === "IDLE") {
      return res.json({
        universityName,
        location: {
          id: location.id,
          name: location.name,
          code: location.code,
          roomHint: location.roomHint,
        },
        department: location.department,
        serverTime: now.toISOString(),
        timeZone,
        date: dateStr,
        mode: "IDLE",
        modeLabel: modeInfo.hint,
        qr: null,
        sessions,
        disclaimer:
          "Dynamic QR Verified Attendance — presence near the display is not cryptographic proof of identity.",
      });
    }

    // H1: ignore anonymous force — issueDisplayQrToken never revokes a valid token for force.
    const issued = await issueDisplayQrToken({
      locationId: location.id,
      departmentId: location.departmentId,
      mode: modeInfo.mode,
      now,
    });

    return res.json({
      universityName,
      location: {
        id: location.id,
        name: location.name,
        code: location.code,
        roomHint: location.roomHint,
      },
      department: location.department,
      serverTime: now.toISOString(),
      timeZone,
      date: dateStr,
      mode: modeInfo.mode,
      modeLabel: modeInfo.hint,
      qr: {
        tokenId: issued.tokenId,
        payload: issued.payload,
        keepClientPayload: issued.keepClientPayload,
        issuedAt: issued.issuedAt.toISOString(),
        expiresAt: issued.expiresAt.toISOString(),
        ttlSeconds: issued.ttlSeconds,
        remainingMs: Math.max(0, issued.expiresAt.getTime() - now.getTime()),
      },
      sessions,
      counts: {
        active: modeInfo.activeCount,
        awaitingStart: modeInfo.awaitingStartCount,
      },
      disclaimer:
        "Dynamic QR Verified Attendance — presence near the display is not cryptographic proof of identity.",
    });
  }
);

/**
 * POST /teacher/attendance/qr-scan
 * Body: { token, sessionId, confirmEarlyExit? }
 * Server derives teacher, department, mode action from auth + token.
 */
facultyQrAttendanceRouter.post(
  "/teacher/attendance/qr-scan",
  requireAuth,
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  scanRateLimit,
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      token: z.string().min(8).max(500),
      sessionId: z.string().min(1),
      confirmEarlyExit: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "token and sessionId are required");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.user.status !== "ACTIVE") {
      auditQr(req.user?.id, "UNAUTHORIZED_ATTEMPT", { reason: "inactive_teacher" });
      return sendError(res, 403, "FORBIDDEN", "Active teacher profile required");
    }

    const rawToken = extractRawTokenFromPayload(parsed.data.token);
    auditQr(req.user!.id, "QR_SCAN_ATTEMPT", {
      teacherId: teacher.id,
      sessionId: parsed.data.sessionId,
    });

    if (!rawToken) {
      auditQr(req.user!.id, "INVALID_QR", { teacherId: teacher.id });
      return sendError(res, 400, "BAD_REQUEST", "Invalid attendance QR code.");
    }

    const { row: qrRow, now } = await lookupValidQrToken(rawToken);
    if (!qrRow) {
      auditQr(req.user!.id, "INVALID_QR", { teacherId: teacher.id });
      return sendError(res, 400, "BAD_REQUEST", "Invalid attendance QR code.");
    }

    if (!qrRow.active || qrRow.revokedAt) {
      auditQr(req.user!.id, "EXPIRED_QR", {
        teacherId: teacher.id,
        tokenId: qrRow.id,
        reason: "revoked",
      });
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "This QR code has expired. Please scan the current QR code."
      );
    }

    if (qrRow.expiresAt.getTime() <= now.getTime()) {
      auditQr(req.user!.id, "EXPIRED_QR", {
        teacherId: teacher.id,
        tokenId: qrRow.id,
      });
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "This QR code has expired. Please scan the current QR code."
      );
    }

    if (qrRow.location.status !== "ACTIVE") {
      auditQr(req.user!.id, "QR_SCAN_FAILED", {
        teacherId: teacher.id,
        reason: "location_inactive",
      });
      return sendError(res, 400, "BAD_REQUEST", "This attendance location is inactive.");
    }

    if (!teacher.departmentId || teacher.departmentId !== qrRow.departmentId) {
      auditQr(req.user!.id, "WRONG_DEPARTMENT", {
        teacherId: teacher.id,
        teacherDepartmentId: teacher.departmentId,
        qrDepartmentId: qrRow.departmentId,
      });
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "This QR code belongs to another department."
      );
    }

    const session = await prisma.classSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: {
        teacherAttendance: true,
        classSection: {
          include: {
            course: { select: { id: true, departmentId: true, code: true, title: true } },
            teacher: { select: { id: true } },
          },
        },
      },
    });

    if (!session) {
      return sendError(res, 404, "NOT_FOUND", "Class session not found");
    }

    if (session.classSection.teacherId !== teacher.id) {
      auditQr(req.user!.id, "UNAUTHORIZED_ATTEMPT", {
        teacherId: teacher.id,
        sessionId: session.id,
        reason: "not_assigned",
      });
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You are not assigned to this class session."
      );
    }

    if (session.classSection.course.departmentId !== qrRow.departmentId) {
      auditQr(req.user!.id, "WRONG_DEPARTMENT", {
        teacherId: teacher.id,
        sessionId: session.id,
        reason: "session_department_mismatch",
      });
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "This QR code belongs to another department."
      );
    }

    const policy = await getFacultyAttendancePolicy();
    const timeZone = policy.institutionTimezone;

    const windowCheck = evaluateQrAttendanceWindow({
      sessionDate: session.date,
      startClock: session.scheduledStartTime ?? session.classSection.startTime,
      endClock: session.scheduledEndTime ?? session.classSection.endTime,
      now,
      timeZone,
      earlyStartMinutes: policy.earlyStartMinutes,
      lateEndMinutes: policy.lateEndMinutes,
    });
    if (!windowCheck.ok) {
      auditQr(req.user!.id, "QR_SCAN_FAILED", {
        teacherId: teacher.id,
        sessionId: session.id,
        reason: "outside_attendance_window",
      });
      return sendError(res, 400, "BAD_REQUEST", windowCheck.message);
    }

    // ——— START ———
    if (qrRow.mode === "START") {
      if (
        session.teacherAttendance ||
        session.actualStartTime ||
        session.status === "OPEN"
      ) {
        auditQr(req.user!.id, "DUPLICATE_ATTEMPT", {
          teacherId: teacher.id,
          sessionId: session.id,
          action: "START",
        });
        return sendError(
          res,
          409,
          "CONFLICT",
          "Attendance has already been started for this class."
        );
      }

      if (session.status === "COMPLETED") {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Attendance has already been completed."
        );
      }

      const scheduledStart = scheduledInstant(
        session.date,
        session.scheduledStartTime ?? session.classSection.startTime ?? null,
        now,
        timeZone
      );
      const lateByMinutes = computeLateByMinutes(
        scheduledStart,
        now,
        policy.graceMinutes
      );

      const result = await teacherCheckInSession({
        sessionId: session.id,
        teacherId: teacher.id,
        method: "QR",
        attendanceLocationId: qrRow.locationId,
        startQrTokenId: qrRow.id,
        lateByMinutes,
        initialStatus: lateByMinutes > 0 ? "LATE" : "ACTIVE",
      });

      if (!result.ok) {
        auditQr(req.user!.id, "QR_SCAN_FAILED", {
          teacherId: teacher.id,
          sessionId: session.id,
          code: result.code,
        });
        return sendError(
          res,
          result.status,
          result.code as ErrorCode,
          result.message
        );
      }

      auditQr(req.user!.id, "QR_SCAN_SUCCESS", {
        teacherId: teacher.id,
        sessionId: session.id,
        action: "START",
        lateByMinutes,
      });
      auditQr(req.user!.id, "START_ATTENDANCE", {
        teacherId: teacher.id,
        sessionId: session.id,
        method: "QR",
        lateByMinutes,
      });

      const refreshed = await prisma.classSession.findUnique({
        where: { id: session.id },
        include: sessionInclude,
      });

      return res.json({
        action: "START",
        lateByMinutes,
        onTime: lateByMinutes === 0,
        statusLabel: lateByMinutes > 0 ? "LATE" : "ON_TIME",
        session: serializeSession(refreshed!),
        message:
          lateByMinutes > 0
            ? `Attendance started (late by ${lateByMinutes} min).`
            : "Attendance started on time.",
      });
    }

    // ——— END ———
    if (qrRow.mode === "END") {
      if (!session.teacherAttendance || !session.actualStartTime) {
        auditQr(req.user!.id, "WRONG_MODE", {
          teacherId: teacher.id,
          sessionId: session.id,
          reason: "end_without_start",
        });
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "Attendance cannot be ended before it is started."
        );
      }

      if (session.teacherAttendance.endedAt || session.status === "COMPLETED") {
        auditQr(req.user!.id, "DUPLICATE_ATTEMPT", {
          teacherId: teacher.id,
          sessionId: session.id,
          action: "END",
        });
        return sendError(
          res,
          409,
          "CONFLICT",
          "Attendance has already been completed."
        );
      }

      const result = await teacherCheckOutSession({
        sessionId: session.id,
        teacherId: teacher.id,
        confirmEarlyExit: parsed.data.confirmEarlyExit,
        method: "QR",
        endQrTokenId: qrRow.id,
      });

      if (!result.ok) {
        if (result.code === "EARLY_EXIT_CONFIRMATION_REQUIRED") {
          auditQr(req.user!.id, "QR_SCAN_FAILED", {
            teacherId: teacher.id,
            sessionId: session.id,
            code: result.code,
          });
          return res.status(409).json({
            error: result.message,
            code: result.code,
            completedMinutes: result.completedMinutes,
            requiredMinutes: result.requiredMinutes,
            remainingMinutes: result.remainingMinutes,
            needsEarlyExitConfirm: true,
          });
        }
        auditQr(req.user!.id, "QR_SCAN_FAILED", {
          teacherId: teacher.id,
          sessionId: session.id,
          code: result.code,
        });
        return sendError(
          res,
          result.status,
          result.code as ErrorCode,
          result.message
        );
      }

      auditQr(req.user!.id, "QR_SCAN_SUCCESS", {
        teacherId: teacher.id,
        sessionId: session.id,
        action: "END",
        timerStatus: result.timerStatus,
      });
      auditQr(req.user!.id, "END_ATTENDANCE", {
        teacherId: teacher.id,
        sessionId: session.id,
        method: "QR",
        timerStatus: result.timerStatus,
      });

      return res.json({
        action: "END",
        timerStatus: result.timerStatus,
        statusLabel:
          result.timerStatus === "EARLY_EXIT" ? "EARLY_END" : "COMPLETED",
        completedMinutes: result.completedMinutes,
        requiredMinutes: result.requiredMinutes,
        session: serializeSession(result.session),
        message:
          result.timerStatus === "EARLY_EXIT"
            ? "Attendance ended early."
            : "Attendance completed.",
      });
    }

    auditQr(req.user!.id, "WRONG_MODE", {
      teacherId: teacher.id,
      mode: qrRow.mode,
    });
    return sendError(
      res,
      400,
      "BAD_REQUEST",
      "This QR code cannot be used for this attendance action."
    );
  }
);

/**
 * GET /teacher/attendance/today-summary — live KPIs for faculty dashboard
 */
facultyQrAttendanceRouter.get(
  "/teacher/attendance/today-summary",
  requireAuth,
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const timeZone = await getInstitutionTimezone();
    const dateStr = todayDateOnly(new Date(), timeZone);
    const date = parseDateOnly(dateStr)!;

    const sessions = await prisma.classSession.findMany({
      where: {
        date,
        classSection: { teacherId: teacher.id },
      },
      include: { teacherAttendance: true },
    });

    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let late = 0;
    let earlyEnds = 0;

    for (const s of sessions) {
      const ta = s.teacherAttendance;
      if (!ta) {
        if (s.status !== "CANCELLED") notStarted += 1;
        continue;
      }
      if (!ta.endedAt && (ta.status === "ACTIVE" || ta.status === "LATE")) {
        inProgress += 1;
        if ((ta.lateByMinutes ?? 0) > 0 || ta.status === "LATE") late += 1;
        continue;
      }
      if (ta.status === "EARLY_EXIT") {
        earlyEnds += 1;
        completed += 1;
        continue;
      }
      if (ta.status === "COMPLETED" || ta.endedAt) {
        completed += 1;
        if ((ta.lateByMinutes ?? 0) > 0) late += 1;
      }
    }

    return res.json({
      date: dateStr,
      timeZone,
      totalClasses: sessions.filter((s) => s.status !== "CANCELLED").length,
      completed,
      inProgress,
      notStarted,
      late,
      earlyEnds,
    });
  }
);
