import { Router } from "express";
import { z } from "zod";

import { Prisma, type TeacherClassTimerStatus } from "@prisma/client";

import { parseDateOnly, todayDateOnly } from "../lib/attendanceCalc.js";
import { sendError, type ErrorCode } from "../lib/errors.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeSession, sessionInclude } from "../lib/serializeAttendance.js";
import {
  REQUIRED_CLASS_MINUTES,
  addMinutes,
  formatCountdown,
  minutesBetween,
  remainingMs,
  resolveTimerStatus,
  verifyCampusLocation,
} from "../lib/teacherSessionTimer.js";
import {
  getFacultyAttendancePolicy,
  getInstitutionTimezone,
} from "../lib/settings.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const teacherAttendanceTimerRouter = Router();
teacherAttendanceTimerRouter.use(requireAuth);

type AttendanceMethodInput = "MANUAL" | "QR" | "ADMIN_OVERRIDE";

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

function serializeActiveTimer(row: {
  id: string;
  sessionId: string;
  teacherId: string;
  classSectionId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  requiredMinutes: number;
  expectedCheckOutAt: Date | null;
  completedMinutes: number | null;
  status: string;
  locationVerified: boolean;
  session: {
    id: string;
    classSectionId: string;
    date: Date;
    status: string;
    classSection: {
      section: string;
      room: string | null;
      course: { code: string; title: string };
    };
  };
}) {
  const now = new Date();
  const remaining = remainingMs(row.startedAt, row.requiredMinutes, now);
  const countdown = formatCountdown(remaining);
  const elapsed = minutesBetween(row.startedAt, now);
  return {
    id: row.id,
    sessionId: row.sessionId,
    teacherId: row.teacherId,
    classSectionId: row.classSectionId ?? row.session.classSectionId,
    checkInTime: row.startedAt.toISOString(),
    checkOutTime: row.endedAt?.toISOString() ?? null,
    expectedCheckOutTime:
      row.expectedCheckOutAt?.toISOString() ??
      addMinutes(row.startedAt, row.requiredMinutes).toISOString(),
    requiredMinutes: row.requiredMinutes,
    completedMinutes: row.completedMinutes,
    elapsedMinutes: elapsed,
    remainingMs: remaining,
    countdown: countdown.label,
    canCheckOutFreely: remaining <= 0,
    status: row.status,
    locationVerified: row.locationVerified,
    courseCode: row.session.classSection.course.code,
    courseTitle: row.session.classSection.course.title,
    section: row.session.classSection.section,
    room: row.session.classSection.room,
    date: row.session.date.toISOString().slice(0, 10),
    sessionStatus: row.session.status,
  };
}

/**
 * Shared check-in used by /sessions/:id/start and /teacher/attendance/check-in.
 * QR path (Phase B+) passes method: "QR" and optional location/token ids.
 */
export async function teacherCheckInSession(input: {
  sessionId: string;
  teacherId: string;
  latitude?: number | null;
  longitude?: number | null;
  method?: AttendanceMethodInput;
  attendanceLocationId?: string | null;
  startQrTokenId?: string | null;
  lateByMinutes?: number | null;
  /** Final initial status — LATE when lateByMinutes > 0 (atomic with create). */
  initialStatus?: Extract<TeacherClassTimerStatus, "ACTIVE" | "LATE">;
}) {
  const method: AttendanceMethodInput = input.method ?? "MANUAL";
  const policy = await getFacultyAttendancePolicy();
  if (method === "MANUAL" && !policy.allowManual) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message:
        "Manual faculty attendance is disabled by policy. Use Dynamic QR Verified Attendance.",
    };
  }

  const session = await prisma.classSession.findUnique({
    where: { id: input.sessionId },
    include: {
      teacherAttendance: true,
      classSection: { select: { id: true, teacherId: true } },
    },
  });
  if (!session) {
    return { ok: false as const, status: 404 as const, code: "NOT_FOUND", message: "Session not found" };
  }
  if (session.classSection.teacherId !== input.teacherId) {
    return { ok: false as const, status: 403 as const, code: "FORBIDDEN", message: "Not your class section" };
  }
  if (session.status === "CANCELLED") {
    return { ok: false as const, status: 400 as const, code: "BAD_REQUEST", message: "Session is cancelled" };
  }
  if (session.status === "COMPLETED") {
    return { ok: false as const, status: 400 as const, code: "BAD_REQUEST", message: "Session is already completed" };
  }
  if (session.teacherAttendance || session.actualStartTime || session.status === "OPEN") {
    return { ok: false as const, status: 409 as const, code: "CONFLICT", message: "Session already started" };
  }

  const geo = verifyCampusLocation(input.latitude, input.longitude);
  if (geo.required && !geo.verified) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "LOCATION_REQUIRED",
      message:
        "Check-in denied: you must be on Dhapti campus to start this class session.",
    };
  }

  const now = new Date();
  const requiredMinutes = policy.requiredMinutesFallback || REQUIRED_CLASS_MINUTES;
  const expectedCheckOutAt = addMinutes(now, requiredMinutes);
  const lateByMinutes = input.lateByMinutes ?? null;
  const status: TeacherClassTimerStatus =
    input.initialStatus ??
    (lateByMinutes != null && lateByMinutes > 0 ? "LATE" : "ACTIVE");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.teacherAttendance.create({
        data: {
          sessionId: session.id,
          teacherId: input.teacherId,
          classSectionId: session.classSectionId,
          startedAt: now,
          requiredMinutes,
          expectedCheckOutAt,
          status,
          locationVerified: geo.verified,
          checkInMethod: method,
          lateByMinutes,
          attendanceLocationId: input.attendanceLocationId ?? null,
          startQrTokenId: input.startQrTokenId ?? null,
        },
      });
      await tx.classSession.update({
        where: { id: session.id },
        data: { status: "OPEN", actualStartTime: now },
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false as const,
        status: 409 as const,
        code: "CONFLICT" as const,
        message: "Session already started",
      };
    }
    throw err;
  }

  const updated = await prisma.classSession.findUnique({
    where: { id: session.id },
    include: sessionInclude,
  });
  return {
    ok: true as const,
    session: updated!,
    locationVerified: geo.verified,
    distanceMeters: geo.distanceMeters,
  };
}

export async function teacherCheckOutSession(input: {
  sessionId: string;
  teacherId: string;
  confirmEarlyExit?: boolean;
  method?: AttendanceMethodInput;
  endQrTokenId?: string | null;
}) {
  const method: AttendanceMethodInput = input.method ?? "MANUAL";
  const policy = await getFacultyAttendancePolicy();
  if (method === "MANUAL" && !policy.allowManual) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message:
        "Manual faculty attendance is disabled by policy. Use Dynamic QR Verified Attendance.",
    };
  }

  const session = await prisma.classSession.findUnique({
    where: { id: input.sessionId },
    include: {
      teacherAttendance: true,
      classSection: { select: { teacherId: true } },
    },
  });
  if (!session) {
    return { ok: false as const, status: 404 as const, code: "NOT_FOUND", message: "Session not found" };
  }
  if (session.classSection.teacherId !== input.teacherId) {
    return { ok: false as const, status: 403 as const, code: "FORBIDDEN", message: "Not your class section" };
  }
  if (!session.teacherAttendance) {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST",
      message: "Session has not been started",
    };
  }
  if (session.teacherAttendance.endedAt || session.actualEndTime) {
    return { ok: false as const, status: 409 as const, code: "CONFLICT", message: "Session already ended" };
  }
  if (session.status === "CANCELLED") {
    return { ok: false as const, status: 400 as const, code: "BAD_REQUEST", message: "Session is cancelled" };
  }

  const now = new Date();
  const checkIn = session.teacherAttendance.startedAt;
  const required =
    session.teacherAttendance.requiredMinutes ??
    policy.requiredMinutesFallback ??
    REQUIRED_CLASS_MINUTES;
  const completed = minutesBetween(checkIn, now);
  const early = completed < required;

  if (early && !input.confirmEarlyExit) {
    return {
      ok: false as const,
      status: 409 as const,
      code: "EARLY_EXIT_CONFIRMATION_REQUIRED",
      message: `You have only completed ${completed} of ${required} minutes. Checking out early will flag this class session as EARLY EXIT in the Admin Audit Logs.`,
      completedMinutes: completed,
      requiredMinutes: required,
      remainingMinutes: required - completed,
    };
  }

  const timerStatus = resolveTimerStatus(checkIn, now, required);

  await prisma.$transaction(async (tx) => {
    await tx.teacherAttendance.update({
      where: { sessionId: session.id },
      data: {
        endedAt: now,
        completedMinutes: completed,
        status: timerStatus,
        checkOutMethod: method,
        endQrTokenId: input.endQrTokenId ?? null,
      },
    });
    await tx.classSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        actualEndTime: now,
      },
    });
  });

  const updated = await prisma.classSession.findUnique({
    where: { id: session.id },
    include: sessionInclude,
  });
  return {
    ok: true as const,
    session: updated!,
    timerStatus,
    completedMinutes: completed,
    requiredMinutes: required,
  };
}

/** POST /teacher/attendance/check-in */
teacherAttendanceTimerRouter.post(
  "/teacher/attendance/check-in",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      sessionId: z.string().min(1).optional(),
      classSectionId: z.string().min(1).optional(),
      date: z.string().optional(),
      latitude: z.number().finite().optional().nullable(),
      longitude: z.number().finite().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid check-in payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Active teacher profile required");
    }

    let sessionId = parsed.data.sessionId;
    if (!sessionId && parsed.data.classSectionId) {
      const dateStr =
        parsed.data.date?.trim() ||
        todayDateOnly(new Date(), await getInstitutionTimezone());
      const date = parseDateOnly(dateStr);
      if (!date) {
        return sendError(res, 400, "BAD_REQUEST", "date must be YYYY-MM-DD");
      }
      const section = await prisma.classSection.findFirst({
        where: {
          id: parsed.data.classSectionId,
          teacherId: teacher.id,
          status: "ACTIVE",
        },
      });
      if (!section) {
        return sendError(res, 404, "NOT_FOUND", "Class section not found");
      }

      // Prefer an in-progress session for this class today.
      let session = await prisma.classSession.findFirst({
        where: {
          classSectionId: section.id,
          date,
          status: "OPEN",
          teacherAttendance: { endedAt: null, status: "ACTIVE" },
        },
        orderBy: { createdAt: "desc" },
      });

      // Else reuse a still-SCHEDULED slot (regular timetable or prior ensure).
      if (!session) {
        session = await prisma.classSession.findFirst({
          where: {
            classSectionId: section.id,
            date,
            status: "SCHEDULED",
          },
          orderBy: { createdAt: "asc" },
        });
      }

      // Else create unscheduled / makeup session for this date (unique start key).
      if (!session) {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const makeupStart = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        let scheduledStartTime = section.startTime || makeupStart;
        const collision = await prisma.classSession.findFirst({
          where: {
            classSectionId: section.id,
            date,
            scheduledStartTime,
          },
        });
        if (collision) {
          // Completed/cancelled slot already used regular start — create makeup slot.
          scheduledStartTime = makeupStart;
          let attempt = 0;
          while (attempt < 5) {
            const exists = await prisma.classSession.findFirst({
              where: {
                classSectionId: section.id,
                date,
                scheduledStartTime,
              },
            });
            if (!exists) break;
            const bump = new Date(now.getTime() + (attempt + 1) * 60_000);
            scheduledStartTime = `${pad(bump.getHours())}:${pad(bump.getMinutes())}`;
            attempt += 1;
          }
        }
        session = await prisma.classSession.create({
          data: {
            classSectionId: section.id,
            date,
            scheduledStartTime,
            scheduledEndTime: section.endTime,
            status: "SCHEDULED",
            topic: collision ? "Makeup / unscheduled session" : null,
          },
        });
      }
      sessionId = session.id;
    }
    if (!sessionId) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "sessionId or classSectionId is required"
      );
    }

    const result = await teacherCheckInSession({
      sessionId,
      teacherId: teacher.id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });
    if (!result.ok) {
      return sendError(
        res,
        result.status,
        result.code as ErrorCode,
        result.message
      );
    }

    return res.json({
      ...serializeSession(result.session),
      locationVerified: result.locationVerified,
      distanceMeters: result.distanceMeters,
      timer: result.session.teacherAttendance
        ? {
            requiredMinutes: REQUIRED_CLASS_MINUTES,
            expectedCheckOutTime: addMinutes(
              result.session.teacherAttendance.startedAt,
              REQUIRED_CLASS_MINUTES
            ).toISOString(),
            countdown: formatCountdown(
              remainingMs(result.session.teacherAttendance.startedAt)
            ).label,
          }
        : null,
    });
  }
);

/** POST /teacher/attendance/check-out */
teacherAttendanceTimerRouter.post(
  "/teacher/attendance/check-out",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      sessionId: z.string().min(1),
      confirmEarlyExit: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "sessionId is required");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Active teacher profile required");
    }

    const result = await teacherCheckOutSession({
      sessionId: parsed.data.sessionId,
      teacherId: teacher.id,
      confirmEarlyExit: parsed.data.confirmEarlyExit,
    });
    if (!result.ok) {
      if (result.code === "EARLY_EXIT_CONFIRMATION_REQUIRED") {
        return res.status(409).json({
          error: result.message,
          code: result.code,
          completedMinutes: result.completedMinutes,
          requiredMinutes: result.requiredMinutes,
          remainingMinutes: result.remainingMinutes,
        });
      }
      return sendError(res, result.status, result.code as ErrorCode, result.message);
    }

    return res.json({
      ...serializeSession(result.session),
      timerStatus: result.timerStatus,
      completedMinutes: result.completedMinutes,
      requiredMinutes: result.requiredMinutes,
    });
  }
);

/** GET /teacher/attendance/active-session */
teacherAttendanceTimerRouter.get(
  "/teacher/attendance/active-session",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const active = await prisma.teacherAttendance.findFirst({
      where: {
        teacherId: teacher.id,
        status: { in: ["ACTIVE", "LATE"] },
        endedAt: null,
      },
      include: {
        session: {
          include: {
            classSection: {
              select: {
                section: true,
                room: true,
                course: { select: { code: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!active) {
      return res.json({ active: false, session: null });
    }

    return res.json({
      active: true,
      session: serializeActiveTimer(active),
    });
  }
);

/** GET /admin/teacher-attendance/live-monitor */
teacherAttendanceTimerRouter.get(
  "/admin/teacher-attendance/live-monitor",
  requireRoles("ADMIN", "DEPARTMENT_ADMIN"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const dateStr =
      String(req.query.date ?? "").trim() ||
      todayDateOnly(new Date(), await getInstitutionTimezone());
    const date = parseDateOnly(dateStr);
    if (!date) {
      return sendError(res, 400, "BAD_REQUEST", "date must be YYYY-MM-DD");
    }

    const { resolveDepartmentFilter } = await import("../lib/departmentScope.js");
    const filter = resolveDepartmentFilter(
      req,
      res,
      String(req.query.departmentId ?? "").trim()
    );
    if (!filter.ok) return;

    const now = new Date();
    const sessions = await prisma.classSession.findMany({
      where: {
        date,
        ...(filter.departmentId
          ? { classSection: { course: { departmentId: filter.departmentId } } }
          : {}),
      },
      include: {
        teacherAttendance: true,
        classSection: {
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                facultyCode: true,
                departmentId: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
            course: {
              select: {
                code: true,
                title: true,
                departmentId: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: [{ scheduledStartTime: "asc" }],
    });

    const activeClasses = [];
    const earlyExits = [];
    const missedClasses = [];
    const completedClasses = [];

    for (const s of sessions) {
      const teacher = s.classSection.teacher;
      const course = s.classSection.course;
      const base = {
        sessionId: s.id,
        classSectionId: s.classSectionId,
        date: dateStr,
        scheduledStartTime: s.scheduledStartTime,
        scheduledEndTime: s.scheduledEndTime,
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        facultyCode: teacher.facultyCode,
        departmentId: course.department?.id ?? teacher.departmentId,
        departmentName:
          course.department?.name ?? teacher.department?.name ?? null,
        departmentCode:
          course.department?.code ?? teacher.department?.code ?? null,
        courseCode: course.code,
        courseTitle: course.title,
        section: s.classSection.section,
        room: s.classSection.room,
        checkInMethod: s.teacherAttendance?.checkInMethod ?? null,
        checkOutMethod: s.teacherAttendance?.checkOutMethod ?? null,
        lateByMinutes: s.teacherAttendance?.lateByMinutes ?? null,
      };

      const ta = s.teacherAttendance;
      if (
        ta &&
        !ta.endedAt &&
        (ta.status === "ACTIVE" || ta.status === "LATE")
      ) {
        const remaining = remainingMs(ta.startedAt, ta.requiredMinutes, now);
        activeClasses.push({
          ...base,
          checkInTime: ta.startedAt.toISOString(),
          expectedCheckOutTime:
            ta.expectedCheckOutAt?.toISOString() ??
            addMinutes(ta.startedAt, ta.requiredMinutes).toISOString(),
          elapsedMinutes: minutesBetween(ta.startedAt, now),
          remainingMs: remaining,
          countdown: formatCountdown(remaining).label,
          locationVerified: ta.locationVerified,
          status:
            ta.status === "LATE" || (ta.lateByMinutes ?? 0) > 0
              ? "LATE"
              : "ACTIVE",
        });
        continue;
      }

      if (ta && ta.status === "EARLY_EXIT") {
        earlyExits.push({
          ...base,
          checkInTime: ta.startedAt.toISOString(),
          checkOutTime: ta.endedAt?.toISOString() ?? null,
          completedMinutes: ta.completedMinutes,
          requiredMinutes: ta.requiredMinutes,
          status: "EARLY_EXIT",
        });
        continue;
      }

      if (ta && (ta.status === "COMPLETED" || ta.endedAt)) {
        completedClasses.push({
          ...base,
          checkInTime: ta.startedAt.toISOString(),
          checkOutTime: ta.endedAt?.toISOString() ?? null,
          completedMinutes: ta.completedMinutes,
          status: "COMPLETED",
        });
        continue;
      }

      // Missed: scheduled for today, start time passed, never checked in
      if (s.status === "SCHEDULED" && !ta) {
        const startHm = s.scheduledStartTime || s.classSection.startTime;
        let missed = true;
        if (startHm && /^\d{2}:\d{2}/.test(startHm)) {
          const [hh, mm] = startHm.split(":").map(Number);
          const scheduled = new Date(date);
          scheduled.setUTCHours(hh, mm, 0, 0);
          if (scheduled.getTime() > now.getTime()) missed = false;
        }
        if (missed) {
          missedClasses.push({
            ...base,
            status: "MISSED",
          });
        }
      }
    }

    const month = dateStr.slice(0, 7);
    const monthStart = parseDateOnly(`${month}-01`)!;
    const [y, m] = month.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0));

    const monthly = await prisma.teacherAttendance.findMany({
      where: {
        startedAt: { gte: monthStart, lte: monthEnd },
        ...(filter.departmentId
          ? {
              session: {
                classSection: { course: { departmentId: filter.departmentId } },
              },
            }
          : {}),
      },
      include: {
        teacher: { select: { id: true, fullName: true, facultyCode: true } },
        session: {
          include: {
            classSection: {
              select: {
                section: true,
                course: { select: { code: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: { startedAt: "asc" },
    });

    return res.json({
      date: dateStr,
      generatedAt: now.toISOString(),
      summary: {
        active: activeClasses.length,
        missed: missedClasses.length,
        earlyExits: earlyExits.length,
        completed: completedClasses.length,
      },
      activeClasses,
      missedClasses,
      earlyExits,
      completedClasses,
      monthlyPayrollRows: monthly.map((row) => ({
        teacherId: row.teacherId,
        teacherName: row.teacher.fullName,
        facultyCode: row.teacher.facultyCode,
        courseCode: row.session.classSection.course.code,
        courseTitle: row.session.classSection.course.title,
        section: row.session.classSection.section,
        checkInTime: row.startedAt.toISOString(),
        checkOutTime: row.endedAt?.toISOString() ?? null,
        completedMinutes: row.completedMinutes,
        requiredMinutes: row.requiredMinutes,
        status: row.status,
        locationVerified: row.locationVerified,
        checkInMethod: row.checkInMethod,
        checkOutMethod: row.checkOutMethod,
      })),
    });
  }
);
