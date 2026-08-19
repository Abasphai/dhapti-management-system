import {
  AttendanceStatus,
  ClassSessionStatus,
  Prisma,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import {
  calcAttendancePercentage,
  parseDateOnly,
  todayDateOnly,
} from "../lib/attendanceCalc.js";
import { sendError, type ErrorCode } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  serializeSession,
  serializeStudentClassSummary,
  sessionInclude,
} from "../lib/serializeAttendance.js";
import { ensureTeacherClassSections } from "../lib/ensureTeacherClassSections.js";
import { getSystemSettings } from "../lib/settings.js";
import {
  teacherCheckInSession,
  teacherCheckOutSession,
} from "./teacherAttendanceTimer.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const attendanceStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
]);

const sessionStatusSchema = z.enum([
  "SCHEDULED",
  "OPEN",
  "COMPLETED",
  "CANCELLED",
]);

const createSessionSchema = z.object({
  date: z.string().optional(),
  topic: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const bulkAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: attendanceStatusSchema,
      })
    )
    .min(1)
    .max(200),
});

const classSectionBriefSelect = {
  id: true,
  section: true,
  academicYear: true,
  semester: true,
  room: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  teacherId: true,
  status: true,
  course: {
    select: {
      id: true,
      code: true,
      title: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          faculty: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
  teacher: {
    select: { id: true, fullName: true, facultyCode: true },
  },
} as const;

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

async function validateTeacherOwnsClass(
  teacherId: string,
  classSectionId: string
) {
  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    include: {
      course: { select: { id: true, status: true } },
      teacher: { include: { user: { select: { status: true } } } },
    },
  });
  if (!classSection) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Class section not found",
    };
  }
  if (classSection.teacherId !== teacherId) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "You can only manage attendance for your own classes",
    };
  }
  if (classSection.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE class sections accept attendance",
    };
  }
  if (classSection.course.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Course is not active",
    };
  }

  const courseTeacher = await prisma.courseTeacher.findUnique({
    where: {
      courseId_teacherId: {
        courseId: classSection.courseId,
        teacherId,
      },
    },
  });
  if (!courseTeacher) {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Teacher must be assigned to the course for this class",
    };
  }

  return { ok: true as const, classSection };
}

function resolveDateOnly(raw: unknown): { ok: true; dateStr: string; date: Date } | { ok: false; message: string } {
  const value =
    raw === undefined || raw === null || String(raw).trim() === ""
      ? todayDateOnly()
      : String(raw).trim();
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return { ok: false, message: "date must be YYYY-MM-DD" };
  }
  return { ok: true, dateStr: value, date: parsed };
}

function scheduledStartKey(startTime: string | null | undefined): string {
  return startTime?.trim() || "00:00";
}

function serializeClassSectionBrief(cs: {
  id: string;
  section: string;
  academicYear: string;
  semester: string;
  room: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  teacherId: string;
  course: {
    id: string;
    code: string;
    title: string;
    department?: {
      id: string;
      name: string;
      code: string;
      faculty?: { id: string; name: string; code: string } | null;
    } | null;
  };
  teacher: { id: string; fullName: string; facultyCode: string };
}) {
  return {
    id: cs.id,
    section: cs.section,
    academicYear: cs.academicYear,
    semester: cs.semester,
    room: cs.room,
    dayOfWeek: cs.dayOfWeek,
    startTime: cs.startTime,
    endTime: cs.endTime,
    teacherId: cs.teacherId,
    course: {
      id: cs.course.id,
      code: cs.course.code,
      title: cs.course.title,
    },
    courseCode: cs.course.code,
    courseTitle: cs.course.title,
    teacher: {
      id: cs.teacher.id,
      name: cs.teacher.fullName,
      fullName: cs.teacher.fullName,
      facultyCode: cs.teacher.facultyCode,
    },
    teacherName: cs.teacher.fullName,
    faculty: cs.course.department?.faculty ?? null,
    department: cs.course.department
      ? {
          id: cs.course.department.id,
          name: cs.course.department.name,
          code: cs.course.department.code,
        }
      : null,
  };
}

function serializeSessionForStudent(row: {
  id: string;
  classSectionId: string;
  date: Date;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  status: ClassSessionStatus;
  topic: string | null;
  classSection?: {
    id: string;
    section: string;
    academicYear: string;
    semester: string;
    room: string | null;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    teacherId: string;
    course: { id: string; code: string; title: string };
    teacher: { id: string; fullName: string; facultyCode: string };
  };
}) {
  const cs = row.classSection;
  return {
    id: row.id,
    classSectionId: row.classSectionId,
    date: row.date.toISOString().slice(0, 10),
    scheduledStartTime: row.scheduledStartTime,
    scheduledEndTime: row.scheduledEndTime,
    actualStartTime: row.actualStartTime?.toISOString() ?? null,
    actualEndTime: row.actualEndTime?.toISOString() ?? null,
    status: row.status,
    topic: row.topic,
    ...(cs
      ? {
          classSection: {
            id: cs.id,
            section: cs.section,
            academicYear: cs.academicYear,
            semester: cs.semester,
            room: cs.room,
            dayOfWeek: cs.dayOfWeek,
            startTime: cs.startTime,
            endTime: cs.endTime,
          },
          course: cs.course,
          courseCode: cs.course.code,
          courseTitle: cs.course.title,
          teacherName: cs.teacher.fullName,
        }
      : {}),
  };
}

function buildSessionWhere(query: Record<string, unknown>): Prisma.ClassSessionWhereInput {
  const q = String(query.q ?? "").trim();
  const dateRaw = String(query.date ?? "").trim();
  const facultyId = String(query.facultyId ?? "").trim();
  const departmentId = String(query.departmentId ?? "").trim();
  const courseId = String(query.courseId ?? "").trim();
  const classSectionId = String(query.classSectionId ?? "").trim();
  const teacherId = String(query.teacherId ?? "").trim();
  const statusRaw = String(query.status ?? "").trim().toUpperCase();

  const and: Prisma.ClassSessionWhereInput[] = [];

  if (dateRaw) {
    const d = parseDateOnly(dateRaw);
    if (d) and.push({ date: d });
  }
  if (classSectionId) and.push({ classSectionId });
  if (teacherId) and.push({ classSection: { teacherId } });
  if (courseId) and.push({ classSection: { courseId } });
  if (departmentId) and.push({ classSection: { course: { departmentId } } });
  if (facultyId) {
    and.push({
      classSection: {
        course: {
          OR: [{ facultyId }, { department: { facultyId } }],
        },
      },
    });
  }
  if (statusRaw && sessionStatusSchema.safeParse(statusRaw).success) {
    and.push({ status: statusRaw as ClassSessionStatus });
  }
  if (q) {
    and.push({
      OR: [
        { topic: { contains: q } },
        { notes: { contains: q } },
        { classSection: { section: { contains: q } } },
        { classSection: { room: { contains: q } } },
        { classSection: { course: { code: { contains: q } } } },
        { classSection: { course: { title: { contains: q } } } },
        { classSection: { teacher: { fullName: { contains: q } } } },
        { classSection: { teacher: { facultyCode: { contains: q } } } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

function countStatuses(
  statuses: Array<AttendanceStatus | "ABSENT">
): { present: number; late: number; absent: number; excused: number } {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  for (const s of statuses) {
    if (s === "PRESENT") present += 1;
    else if (s === "LATE") late += 1;
    else if (s === "EXCUSED") excused += 1;
    else absent += 1;
  }
  return { present, late, absent, excused };
}

async function loadSessionWithAccess(sessionId: string) {
  return prisma.classSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });
}

async function assertTeacherOwnsSession(
  teacherId: string,
  sessionId: string
) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      classSection: {
        include: {
          course: { select: { id: true, status: true } },
          teacher: { include: { user: { select: { status: true } } } },
        },
      },
      teacherAttendance: true,
    },
  });
  if (!session) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Session not found",
    };
  }
  if (session.classSection.teacherId !== teacherId) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "Not allowed",
    };
  }
  return { ok: true as const, session };
}

/** After a session completes, warn students below the admin attendance threshold. */
async function maybeWarnLowAttendanceForSection(classSectionId: string) {
  try {
    const settings = await getSystemSettings();
    if (!settings.sendLowAttendanceWarning) return;

    const section = await prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: {
        id: true,
        section: true,
        course: { select: { code: true, title: true } },
      },
    });
    if (!section) return;

    const [enrollments, sessions] = await Promise.all([
      prisma.enrollment.findMany({
        where: { classSectionId, status: "ACTIVE" },
        select: {
          studentId: true,
          student: { select: { userId: true } },
        },
      }),
      prisma.classSession.findMany({
        where: { classSectionId, status: "COMPLETED" },
        select: {
          id: true,
          studentAttendance: {
            select: { studentId: true, status: true },
          },
        },
      }),
    ]);

    if (sessions.length === 0 || enrollments.length === 0) return;

    const courseLabel = `${section.course.code} — ${section.course.title} (${section.section})`;
    const { notifyLowAttendance } = await import("../lib/notifications.js");

    for (const enrollment of enrollments) {
      const statuses: Array<AttendanceStatus | "ABSENT"> = [];
      for (const session of sessions) {
        const mark = session.studentAttendance.find(
          (a) => a.studentId === enrollment.studentId
        );
        statuses.push(mark ? mark.status : "ABSENT");
      }
      const counts = countStatuses(statuses);
      const percentage = calcAttendancePercentage(counts);
      if (
        percentage == null ||
        percentage >= settings.minAttendanceThreshold ||
        !enrollment.student.userId
      ) {
        continue;
      }
      await notifyLowAttendance({
        studentUserId: enrollment.student.userId,
        classSectionId,
        courseLabel,
        percentage,
        threshold: settings.minAttendanceThreshold,
      }).catch((err) => console.error("notifyLowAttendance", err));
    }
  } catch (err) {
    console.error("maybeWarnLowAttendanceForSection", err);
  }
}

async function createScheduledSession(input: {
  classSectionId: string;
  date: Date;
  scheduledStartTime: string;
  scheduledEndTime: string | null;
  topic?: string | null;
  notes?: string | null;
}) {
  return prisma.classSession.create({
    data: {
      classSectionId: input.classSectionId,
      date: input.date,
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      status: "SCHEDULED",
      topic: input.topic?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    include: sessionInclude,
  });
}

/** Teacher: today's (or date) sessions for own ACTIVE class sections — no auto-create. */
attendanceRouter.get(
  "/teachers/me/sessions",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const dateResolved = resolveDateOnly(req.query.date);
    if (!dateResolved.ok) {
      return sendError(res, 400, "BAD_REQUEST", dateResolved.message);
    }

    const classSectionId = String(req.query.classSectionId ?? "").trim();

    // Sync ClassSections from CourseTeacher so My Attendance can start sessions.
    await ensureTeacherClassSections(teacher.id);

    const assigned = await prisma.courseTeacher.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    });
    const assignedCourseIds = assigned.map((a) => a.courseId);

    const sections = await prisma.classSection.findMany({
      where: {
        teacherId: teacher.id,
        status: "ACTIVE",
        ...(assignedCourseIds.length
          ? { courseId: { in: assignedCourseIds } }
          : { courseId: { in: [] } }),
        ...(classSectionId ? { id: classSectionId } : {}),
      },
      select: classSectionBriefSelect,
      orderBy: [
        { course: { code: "asc" } },
        { section: "asc" },
      ],
    });

    const sectionIds = sections.map((s) => s.id);
    const sessions =
      sectionIds.length === 0
        ? []
        : await prisma.classSession.findMany({
            where: {
              classSectionId: { in: sectionIds },
              date: dateResolved.date,
            },
            include: sessionInclude,
          });

    const bySection = new Map(sessions.map((s) => [s.classSectionId, s]));

    return res.json({
      data: sections.map((cs) => {
        const session = bySection.get(cs.id) ?? null;
        return {
          classSection: serializeClassSectionBrief(cs),
          session: session ? serializeSession(session) : null,
        };
      }),
      date: dateResolved.dateStr,
    });
  }
);

/** Teacher: create a SCHEDULED session for a class section. */
attendanceRouter.post(
  "/classes/:id/sessions",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const classSectionId = paramId(req.params.id);
    const parsed = createSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid session payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE teachers can create sessions"
      );
    }

    const check = await validateTeacherOwnsClass(teacher.id, classSectionId);
    if (!check.ok) {
      return sendError(res, check.status, check.code, check.message);
    }

    const dateResolved = resolveDateOnly(parsed.data.date);
    if (!dateResolved.ok) {
      return sendError(res, 400, "BAD_REQUEST", dateResolved.message);
    }

    const scheduledStartTime = scheduledStartKey(check.classSection.startTime);
    const scheduledEndTime = check.classSection.endTime ?? null;

    try {
      const created = await createScheduledSession({
        classSectionId,
        date: dateResolved.date,
        scheduledStartTime,
        scheduledEndTime,
        topic: parsed.data.topic,
        notes: parsed.data.notes,
      });
      return res.status(201).json(serializeSession(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A session already exists for this class on that date"
        );
      }
      throw err;
    }
  }
);

/** Teacher: get-or-create session for date (idempotent Start Class helper). */
attendanceRouter.post(
  "/classes/:id/sessions/ensure",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const classSectionId = paramId(req.params.id);
    const parsed = createSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid session payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE teachers can manage sessions"
      );
    }

    const check = await validateTeacherOwnsClass(teacher.id, classSectionId);
    if (!check.ok) {
      return sendError(res, check.status, check.code, check.message);
    }

    const dateResolved = resolveDateOnly(parsed.data.date);
    if (!dateResolved.ok) {
      return sendError(res, 400, "BAD_REQUEST", dateResolved.message);
    }

    const scheduledStartTime = scheduledStartKey(check.classSection.startTime);
    const scheduledEndTime = check.classSection.endTime ?? null;

    const existing = await prisma.classSession.findUnique({
      where: {
        classSectionId_date_scheduledStartTime: {
          classSectionId,
          date: dateResolved.date,
          scheduledStartTime,
        },
      },
      include: sessionInclude,
    });
    if (existing) {
      return res.json(serializeSession(existing));
    }

    try {
      const created = await createScheduledSession({
        classSectionId,
        date: dateResolved.date,
        scheduledStartTime,
        scheduledEndTime,
        topic: parsed.data.topic,
        notes: parsed.data.notes,
      });
      return res.status(201).json(serializeSession(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const again = await prisma.classSession.findUnique({
          where: {
            classSectionId_date_scheduledStartTime: {
              classSectionId,
              date: dateResolved.date,
              scheduledStartTime,
            },
          },
          include: sessionInclude,
        });
        if (again) return res.json(serializeSession(again));
      }
      throw err;
    }
  }
);

/** Session detail — teacher owner, admin, or enrolled student (limited). */
attendanceRouter.get(
  "/sessions/:id",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const session = await loadSessionWithAccess(id);
    if (!session) {
      return sendError(res, 404, "NOT_FOUND", "Session not found");
    }

    const role = req.user!.role;

    if (role === "ADMIN") {
      return res.json(serializeSession(session));
    }

    if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || session.classSection.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
      return res.json(serializeSession(session));
    }

    if (role === "STUDENT") {
      const student = await resolveStudent(req.user!.id);
      if (!student) {
        return sendError(res, 404, "NOT_FOUND", "Student profile not found");
      }
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          classSectionId: session.classSectionId,
          status: "ACTIVE",
        },
      });
      if (!enrollment) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
      return res.json(serializeSessionForStudent(session));
    }

    return sendError(res, 403, "FORBIDDEN", "Not allowed");
  }
);

/** Teacher: start class — server timestamp, create TeacherAttendance (+ 2h timer). */
attendanceRouter.post(
  "/sessions/:id/start",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE teachers can start sessions"
      );
    }

    const body = z
      .object({
        latitude: z.number().finite().optional().nullable(),
        longitude: z.number().finite().optional().nullable(),
      })
      .safeParse(req.body ?? {});

    const result = await teacherCheckInSession({
      sessionId: id,
      teacherId: teacher.id,
      latitude: body.success ? body.data.latitude : null,
      longitude: body.success ? body.data.longitude : null,
    });
    if (!result.ok) {
      return sendError(
        res,
        result.status,
        result.code as ErrorCode,
        result.message
      );
    }

    return res.json(serializeSession(result.session));
  }
);

/** Teacher: end class — 2h timer; early exit requires confirmEarlyExit. */
attendanceRouter.post(
  "/sessions/:id/end",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE teachers can end sessions"
      );
    }

    const body = z
      .object({ confirmEarlyExit: z.boolean().optional() })
      .safeParse(req.body ?? {});

    const result = await teacherCheckOutSession({
      sessionId: id,
      teacherId: teacher.id,
      confirmEarlyExit: body.success ? body.data.confirmEarlyExit : undefined,
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

    void maybeWarnLowAttendanceForSection(result.session.classSectionId);

    return res.json({
      ...serializeSession(result.session),
      timerStatus: result.timerStatus,
      completedMinutes: result.completedMinutes,
    });
  }
);

/** Teacher: roster + marks for a session (UNMARKED if none). */
attendanceRouter.get(
  "/sessions/:id/attendance",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const owned = await assertTeacherOwnsSession(teacher.id, id);
    if (!owned.ok) {
      return sendError(res, owned.status, owned.code, owned.message);
    }

    const session = await loadSessionWithAccess(id);
    if (!session) {
      return sendError(res, 404, "NOT_FOUND", "Session not found");
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classSectionId: session.classSectionId,
        status: "ACTIVE",
      },
      include: {
        student: {
          select: { id: true, studentCode: true, fullName: true },
        },
      },
      orderBy: { student: { fullName: "asc" } },
    });

    const marks = await prisma.studentAttendance.findMany({
      where: { sessionId: session.id },
    });
    const markByStudent = new Map(marks.map((m) => [m.studentId, m]));

    return res.json({
      session: serializeSession(session),
      data: enrollments.map((e) => {
        const mark = markByStudent.get(e.studentId);
        return {
          studentId: e.student.id,
          studentCode: e.student.studentCode,
          studentName: e.student.fullName,
          status: mark?.status ?? ("UNMARKED" as const),
          attendanceId: mark?.id ?? null,
          markedAt: mark?.markedAt.toISOString() ?? null,
        };
      }),
    });
  }
);

/** Teacher: bulk upsert attendance — OPEN sessions only, all-or-nothing. */
attendanceRouter.post(
  "/sessions/:id/attendance/bulk",
  requireRoles("TEACHER"),
  requirePermission(Permission.ATTENDANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const parsed = bulkAttendanceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Invalid attendance payload (1–200 records required)"
      );
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE teachers can mark attendance"
      );
    }

    const owned = await assertTeacherOwnsSession(teacher.id, id);
    if (!owned.ok) {
      return sendError(res, owned.status, owned.code, owned.message);
    }

    const { session } = owned;
    if (session.status !== "OPEN") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Attendance can only be marked while the session is OPEN"
      );
    }

    const studentIds = parsed.data.records.map((r) => r.studentId);
    const uniqueIds = new Set(studentIds);
    if (uniqueIds.size !== studentIds.length) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Duplicate studentId in records"
      );
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classSectionId: session.classSectionId,
        status: "ACTIVE",
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    });
    const enrolled = new Set(enrollments.map((e) => e.studentId));
    const invalid = studentIds.filter((sid) => !enrolled.has(sid));
    if (invalid.length > 0) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "One or more students are not actively enrolled in this class"
      );
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const record of parsed.data.records) {
        await tx.studentAttendance.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: record.studentId,
            },
          },
          create: {
            sessionId: session.id,
            studentId: record.studentId,
            teacherId: teacher.id,
            status: record.status,
            markedAt: now,
          },
          update: {
            status: record.status,
            teacherId: teacher.id,
            markedAt: now,
          },
        });
      }
    });

    const marks = await prisma.studentAttendance.findMany({
      where: {
        sessionId: session.id,
        studentId: { in: studentIds },
      },
      include: {
        student: {
          select: { id: true, studentCode: true, fullName: true },
        },
      },
    });

    return res.json({
      session: serializeSession((await loadSessionWithAccess(session.id))!),
      data: marks.map((m) => ({
        studentId: m.student.id,
        studentCode: m.student.studentCode,
        studentName: m.student.fullName,
        status: m.status,
        attendanceId: m.id,
        markedAt: m.markedAt.toISOString(),
      })),
    });
  }
);

/**
 * Student: attendance summaries per ACTIVE enrollment.
 * Policy: COMPLETED sessions only; unmarked on completed counts as ABSENT
 * for percentage (teacher should have marked). EXCUSED excluded from denom
 * via calcAttendancePercentage.
 */
attendanceRouter.get(
  "/students/me/attendance",
  requireRoles("STUDENT"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      include: {
        classSection: {
          select: {
            id: true,
            section: true,
            academicYear: true,
            semester: true,
            teacher: { select: { fullName: true } },
            course: { select: { code: true, title: true } },
          },
        },
      },
      orderBy: [
        { classSection: { course: { code: "asc" } } },
        { classSection: { section: "asc" } },
      ],
    });

    const sectionIds = enrollments.map((e) => e.classSectionId);
    const completedSessions =
      sectionIds.length === 0
        ? []
        : await prisma.classSession.findMany({
            where: {
              classSectionId: { in: sectionIds },
              status: "COMPLETED",
            },
            select: {
              id: true,
              classSectionId: true,
              studentAttendance: {
                where: { studentId: student.id },
                select: { status: true },
              },
            },
          });

    const bySection = new Map<
      string,
      { statuses: Array<AttendanceStatus | "ABSENT">; marked: number }
    >();
    for (const sid of sectionIds) {
      bySection.set(sid, { statuses: [], marked: 0 });
    }
    for (const s of completedSessions) {
      const bucket = bySection.get(s.classSectionId);
      if (!bucket) continue;
      const mark = s.studentAttendance[0];
      if (mark) {
        bucket.statuses.push(mark.status);
        bucket.marked += 1;
      } else {
        bucket.statuses.push("ABSENT");
      }
    }

    const settings = await getSystemSettings();
    const data = enrollments.map((e) => {
      const bucket = bySection.get(e.classSectionId)!;
      const counts = countStatuses(bucket.statuses);
      return serializeStudentClassSummary({
        classSectionId: e.classSectionId,
        courseCode: e.classSection.course.code,
        courseTitle: e.classSection.course.title,
        section: e.classSection.section,
        teacherName: e.classSection.teacher.fullName,
        academicYear: e.classSection.academicYear,
        semester: e.classSection.semester,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        excused: counts.excused,
        totalMarked: bucket.marked,
        totalSessions: bucket.statuses.length,
        minAttendanceThreshold: settings.minAttendanceThreshold,
      });
    });

    return res.json({ data });
  }
);

/** Student: session-level detail for one enrolled class. */
attendanceRouter.get(
  "/students/me/attendance/:classSectionId",
  requireRoles("STUDENT"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const classSectionId = paramId(req.params.classSectionId);
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        classSectionId,
        status: "ACTIVE",
      },
      include: {
        classSection: {
          select: {
            id: true,
            section: true,
            academicYear: true,
            semester: true,
            teacher: { select: { fullName: true } },
            course: { select: { code: true, title: true } },
          },
        },
      },
    });
    if (!enrollment) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You are not enrolled in this class"
      );
    }

    const sessions = await prisma.classSession.findMany({
      where: {
        classSectionId,
        status: { in: ["COMPLETED", "OPEN", "SCHEDULED"] },
      },
      include: {
        studentAttendance: {
          where: { studentId: student.id },
          select: { status: true },
        },
      },
      orderBy: [{ date: "desc" }, { scheduledStartTime: "asc" }],
    });

    const completedStatuses: Array<AttendanceStatus | "ABSENT"> = [];
    let marked = 0;
    for (const s of sessions) {
      if (s.status !== "COMPLETED") continue;
      const mark = s.studentAttendance[0];
      if (mark) {
        completedStatuses.push(mark.status);
        marked += 1;
      } else {
        completedStatuses.push("ABSENT");
      }
    }
    const counts = countStatuses(completedStatuses);
    const settings = await getSystemSettings();
    const summary = serializeStudentClassSummary({
      classSectionId: enrollment.classSectionId,
      courseCode: enrollment.classSection.course.code,
      courseTitle: enrollment.classSection.course.title,
      section: enrollment.classSection.section,
      teacherName: enrollment.classSection.teacher.fullName,
      academicYear: enrollment.classSection.academicYear,
      semester: enrollment.classSection.semester,
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      excused: counts.excused,
      totalMarked: marked,
      totalSessions: completedStatuses.length,
      minAttendanceThreshold: settings.minAttendanceThreshold,
    });

    return res.json({
      classSection: summary,
      data: sessions.map((s) => ({
        sessionId: s.id,
        date: s.date.toISOString().slice(0, 10),
        scheduledStartTime: s.scheduledStartTime,
        scheduledEndTime: s.scheduledEndTime,
        status: s.status,
        attendanceStatus: s.studentAttendance[0]?.status ?? "UNMARKED",
      })),
    });
  }
);

/** Admin: paginated class sessions. */
attendanceRouter.get(
  "/attendance/sessions",
  requirePermission(Permission.ATTENDANCE_READ),
  async (req, res) => {
    const dateRaw = String(req.query.date ?? "").trim();
    if (dateRaw && !parseDateOnly(dateRaw)) {
      return sendError(res, 400, "BAD_REQUEST", "date must be YYYY-MM-DD");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildSessionWhere(req.query as Record<string, unknown>);

    const [total, rows] = await Promise.all([
      prisma.classSession.count({ where }),
      prisma.classSession.findMany({
        where,
        include: sessionInclude,
        orderBy: [{ date: "desc" }, { scheduledStartTime: "asc" }],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeSession),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Admin: teacher attendance overview (sessions + derived teacher status). */
attendanceRouter.get(
  "/attendance/teachers",
  requirePermission(Permission.ATTENDANCE_READ),
  async (req, res) => {
    const dateResolved = resolveDateOnly(req.query.date);
    if (!dateResolved.ok) {
      return sendError(res, 400, "BAD_REQUEST", dateResolved.message);
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildSessionWhere({
      ...(req.query as Record<string, unknown>),
      date: dateResolved.dateStr,
    });

    const [total, rows] = await Promise.all([
      prisma.classSession.count({ where }),
      prisma.classSession.findMany({
        where,
        include: sessionInclude,
        orderBy: [
          { classSection: { teacher: { fullName: "asc" } } },
          { scheduledStartTime: "asc" },
        ],
        skip,
        take,
      }),
    ]);

    return res.json({
      date: dateResolved.dateStr,
      data: rows.map((row) => {
        const full = serializeSession(row);
        return {
          sessionId: full.id,
          date: full.date,
          scheduledStartTime: full.scheduledStartTime,
          scheduledEndTime: full.scheduledEndTime,
          actualStartTime: full.actualStartTime,
          actualEndTime: full.actualEndTime,
          status: full.accountStatus,
          teacherAttendanceStatus: full.teacherAttendanceStatus,
          teacher: full.teacher ?? null,
          teacherName: full.teacherName ?? null,
          courseCode: full.courseCode ?? null,
          courseTitle: full.courseTitle ?? null,
          section: full.section ?? null,
          room: full.room ?? null,
          classSectionId: full.classSectionId,
          faculty: full.faculty ?? null,
          department: full.department ?? null,
        };
      }),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/**
 * Admin: aggregated student attendance summaries (enrollment × class section).
 * Same percentage policy as the student portal.
 */
attendanceRouter.get(
  "/attendance/students",
  requirePermission(Permission.ATTENDANCE_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const departmentId = String(req.query.departmentId ?? "").trim();
    const courseId = String(req.query.courseId ?? "").trim();
    const classSectionId = String(req.query.classSectionId ?? "").trim();

    const and: Prisma.EnrollmentWhereInput[] = [{ status: "ACTIVE" }];

    if (classSectionId) and.push({ classSectionId });
    if (courseId) and.push({ classSection: { courseId } });
    if (departmentId) {
      and.push({
        OR: [
          { student: { departmentId } },
          { classSection: { course: { departmentId } } },
        ],
      });
    }
    if (facultyId) {
      and.push({
        OR: [
          { student: { facultyId } },
          {
            classSection: {
              course: {
                OR: [{ facultyId }, { department: { facultyId } }],
              },
            },
          },
        ],
      });
    }
    if (q) {
      and.push({
        OR: [
          { student: { fullName: { contains: q } } },
          { student: { studentCode: { contains: q } } },
          { classSection: { course: { code: { contains: q } } } },
          { classSection: { course: { title: { contains: q } } } },
          { classSection: { section: { contains: q } } },
        ],
      });
    }

    const where: Prisma.EnrollmentWhereInput = { AND: and };

    const [total, enrollments] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              facultyId: true,
              departmentId: true,
            },
          },
          classSection: {
            select: {
              id: true,
              section: true,
              academicYear: true,
              semester: true,
              teacher: { select: { fullName: true } },
              course: { select: { code: true, title: true } },
            },
          },
        },
        orderBy: [
          { student: { fullName: "asc" } },
          { classSection: { course: { code: "asc" } } },
        ],
        skip,
        take,
      }),
    ]);

    const sectionIds = [...new Set(enrollments.map((e) => e.classSectionId))];
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    const completedSessions =
      sectionIds.length === 0
        ? []
        : await prisma.classSession.findMany({
            where: {
              classSectionId: { in: sectionIds },
              status: "COMPLETED",
            },
            select: {
              id: true,
              classSectionId: true,
              studentAttendance: {
                where: { studentId: { in: studentIds } },
                select: { studentId: true, status: true },
              },
            },
          });

    const settings = await getSystemSettings();
    const data = enrollments.map((e) => {
      const statuses: Array<AttendanceStatus | "ABSENT"> = [];
      let marked = 0;
      for (const s of completedSessions) {
        if (s.classSectionId !== e.classSectionId) continue;
        const mark = s.studentAttendance.find((a) => a.studentId === e.studentId);
        if (mark) {
          statuses.push(mark.status);
          marked += 1;
        } else {
          statuses.push("ABSENT");
        }
      }
      const counts = countStatuses(statuses);
      const summary = serializeStudentClassSummary({
        classSectionId: e.classSectionId,
        courseCode: e.classSection.course.code,
        courseTitle: e.classSection.course.title,
        section: e.classSection.section,
        teacherName: e.classSection.teacher.fullName,
        academicYear: e.classSection.academicYear,
        semester: e.classSection.semester,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        excused: counts.excused,
        totalMarked: marked,
        totalSessions: statuses.length,
        minAttendanceThreshold: settings.minAttendanceThreshold,
      });
      return {
        studentId: e.student.id,
        studentCode: e.student.studentCode,
        studentName: e.student.fullName,
        ...summary,
      };
    });

    return res.json({
      data,
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);
