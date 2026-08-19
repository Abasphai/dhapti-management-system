import { Prisma, type AttendanceStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { calcAttendancePercentage } from "../lib/attendanceCalc.js";
import { resolveDepartmentFilter } from "../lib/departmentScope.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { hasPermission, Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  classSectionInclude,
  serializeClassSection,
} from "../lib/serializeClass.js";
import {
  enrollmentInclude,
  serializeEnrollment,
  uiEnrollmentStatus,
} from "../lib/serializeEnrollment.js";
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "../middleware/auth.js";

export const classesRouter = Router();

classesRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const academicStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

const classBodySchema = z.object({
  courseId: z.string().min(1),
  teacherId: z.string().min(1),
  section: z.string().min(1).max(20),
  academicYear: z.string().min(4).max(20),
  semester: z.string().min(1).max(40),
  room: z.string().max(80).optional().nullable(),
  dayOfWeek: z.string().max(40).optional().nullable(),
  startTime: z.string().max(20).optional().nullable(),
  endTime: z.string().max(20).optional().nullable(),
  status: academicStatusSchema.optional(),
});

async function assertTeacherAssignedToCourse(
  teacherId: string,
  courseId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const link = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId, teacherId } },
  });
  if (!link) {
    return {
      ok: false,
      status: 400,
      message: "Teacher is not assigned to this course",
    };
  }
  return { ok: true };
}

async function validateClassActors(courseId: string, teacherId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true, departmentId: true },
  });
  if (!course) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Course not found",
    };
  }
  if (course.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE courses can be used for new or reassigned classes",
    };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { status: true } } },
  });
  if (!teacher) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Teacher not found",
    };
  }
  if (teacher.user.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE teachers can be assigned to classes",
    };
  }

  const assigned = await assertTeacherAssignedToCourse(teacherId, courseId);
  if (!assigned.ok) {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: assigned.message,
    };
  }

  return { ok: true as const, course, teacher };
}

classesRouter.get(
  "/",
  requirePermission(Permission.CLASSES_READ),
  async (req: AuthedRequest, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const courseId = String(req.query.courseId ?? "").trim();
    const teacherId = String(req.query.teacherId ?? "").trim();
    const requestedDept = String(req.query.departmentId ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();

    const scoped = resolveDepartmentFilter(req, res, requestedDept);
    if (!scoped.ok) return;
    const departmentId = scoped.departmentId ?? "";

    const and: Prisma.ClassSectionWhereInput[] = [];

    if (q) {
      and.push({
        OR: [
          { section: { contains: q } },
          { room: { contains: q } },
          { academicYear: { contains: q } },
          { semester: { contains: q } },
          { dayOfWeek: { contains: q } },
          { course: { code: { contains: q } } },
          { course: { title: { contains: q } } },
          { teacher: { fullName: { contains: q } } },
          { teacher: { facultyCode: { contains: q } } },
        ],
      });
    }

    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      and.push({ status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED" });
    }
    if (courseId) and.push({ courseId });
    if (teacherId) and.push({ teacherId });
    if (academicYear) and.push({ academicYear });
    if (semester) and.push({ semester });
    if (departmentId) and.push({ course: { departmentId } });
    if (facultyId) {
      and.push({
        course: {
          OR: [{ facultyId }, { department: { facultyId } }],
        },
      });
    }

    const where: Prisma.ClassSectionWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.classSection.count({ where }),
      prisma.classSection.findMany({
        where,
        include: classSectionInclude,
        orderBy: [
          { academicYear: "desc" },
          { semester: "asc" },
          { course: { code: "asc" } },
          { section: "asc" },
        ],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeClassSection),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/**
 * Students enrolled in a class section.
 * Admin: enrollments.read. Teacher: own ClassSection only (JWT ownership).
 * Includes attendance % using the Phase 1H policy.
 */
classesRouter.get(
  "/:id/students",
  async (req: AuthedRequest, res) => {
    const classSectionId = paramId(req.params.id);
    const classSection = await prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: {
        id: true,
        teacherId: true,
        semester: true,
        academicYear: true,
      },
    });
    if (!classSection) {
      return sendError(res, 404, "NOT_FOUND", "Class not found");
    }

    const canAdmin = hasPermission(
      req.user!.role,
      Permission.ENROLLMENTS_READ
    );
    let teacherOwns = false;
    if (req.user!.role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      teacherOwns = !!teacher && teacher.id === classSection.teacherId;
    }
    if (!canAdmin && !teacherOwns) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "Not allowed to view this class roster"
      );
    }

    const status = String(req.query.status ?? "").trim().toUpperCase();
    const where: {
      classSectionId: string;
      status?: "ACTIVE" | "COMPLETED" | "DROPPED";
    } = { classSectionId };
    if (status && ["ACTIVE", "COMPLETED", "DROPPED"].includes(status)) {
      where.status = status as "ACTIVE" | "COMPLETED" | "DROPPED";
    } else if (teacherOwns && !canAdmin) {
      // Teacher roster defaults to ACTIVE enrollments
      where.status = "ACTIVE";
    }

    const rows = await prisma.enrollment.findMany({
      where,
      include: enrollmentInclude,
      orderBy: { student: { fullName: "asc" } },
    });

    const studentIds = rows.map((r) => r.studentId);
    const completedSessions =
      studentIds.length === 0
        ? []
        : await prisma.classSession.findMany({
            where: { classSectionId, status: "COMPLETED" },
            select: {
              id: true,
              studentAttendance: {
                where: { studentId: { in: studentIds } },
                select: { studentId: true, status: true },
              },
            },
          });

    const attendanceByStudent = new Map<string, number | null>();
    for (const studentId of studentIds) {
      const statuses: Array<AttendanceStatus | "ABSENT"> = [];
      for (const session of completedSessions) {
        const mark = session.studentAttendance.find(
          (a) => a.studentId === studentId
        );
        statuses.push(mark?.status ?? "ABSENT");
      }
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
      attendanceByStudent.set(
        studentId,
        calcAttendancePercentage({ present, late, absent, excused })
      );
    }

    return res.json({
      classSectionId: classSection.id,
      academicYear: classSection.academicYear,
      semester: classSection.semester,
      data: rows.map((row) => {
        const attendancePercent = attendanceByStudent.get(row.studentId) ?? null;
        return {
          enrollmentId: row.id,
          status: uiEnrollmentStatus(row.status),
          accountStatus: row.status,
          enrolledAt: row.enrolledAt.toISOString(),
          studentId: row.student.id,
          studentCode: row.student.studentCode,
          name: row.student.fullName,
          fullName: row.student.fullName,
          email: row.student.email,
          program: row.student.program,
          faculty: row.student.faculty?.name ?? null,
          department: row.student.department?.name ?? null,
          semester: classSection.semester,
          academicYear: classSection.academicYear,
          attendancePercent,
          enrollment: serializeEnrollment(row),
        };
      }),
    });
  }
);

classesRouter.get(
  "/:id",
  requirePermission(Permission.CLASSES_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.classSection.findUnique({
      where: { id },
      include: classSectionInclude,
    });
    if (!row) return sendError(res, 404, "NOT_FOUND", "Class not found");
    return res.json(serializeClassSection(row));
  }
);

classesRouter.post(
  "/",
  requirePermission(Permission.CLASSES_CREATE),
  async (req, res) => {
    const parsed = classBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid class payload");
    }

    const data = parsed.data;
    const check = await validateClassActors(data.courseId, data.teacherId);
    if (!check.ok) {
      return sendError(res, check.status, check.code, check.message);
    }

    const section = data.section.trim().toUpperCase();
    const academicYear = data.academicYear.trim();
    const semester = data.semester.trim();

    try {
      const created = await prisma.classSection.create({
        data: {
          courseId: data.courseId,
          teacherId: data.teacherId,
          section,
          academicYear,
          semester,
          room: data.room?.trim() || null,
          dayOfWeek: data.dayOfWeek?.trim() || null,
          startTime: data.startTime?.trim() || null,
          endTime: data.endTime?.trim() || null,
          status: data.status ?? "ACTIVE",
        },
        include: classSectionInclude,
      });
      return res.status(201).json(serializeClassSection(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A class with this course, section, academic year, and semester already exists"
        );
      }
      throw err;
    }
  }
);

classesRouter.patch(
  "/:id/status",
  requirePermission(Permission.CLASSES_UPDATE),
  async (req, res) => {
    const statusParsed = academicStatusSchema.safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status");
    }
    const id = paramId(req.params.id);
    try {
      const updated = await prisma.classSection.update({
        where: { id },
        data: { status: statusParsed.data },
        include: classSectionInclude,
      });
      return res.json(serializeClassSection(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return sendError(res, 404, "NOT_FOUND", "Class not found");
      }
      throw err;
    }
  }
);

classesRouter.patch(
  "/:id",
  requirePermission(Permission.CLASSES_UPDATE),
  async (req, res) => {
    const schema = classBodySchema.partial();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid class payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.classSection.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Class not found");

    const data = parsed.data;
    const nextCourseId = data.courseId ?? existing.courseId;
    const nextTeacherId = data.teacherId ?? existing.teacherId;

    if (data.courseId || data.teacherId) {
      const check = await validateClassActors(nextCourseId, nextTeacherId);
      if (!check.ok) {
        return sendError(res, check.status, check.code, check.message);
      }
    }

    try {
      const updated = await prisma.classSection.update({
        where: { id },
        data: {
          courseId: data.courseId,
          teacherId: data.teacherId,
          section: data.section?.trim().toUpperCase(),
          academicYear: data.academicYear?.trim(),
          semester: data.semester?.trim(),
          room:
            data.room === undefined ? undefined : data.room?.trim() || null,
          dayOfWeek:
            data.dayOfWeek === undefined
              ? undefined
              : data.dayOfWeek?.trim() || null,
          startTime:
            data.startTime === undefined
              ? undefined
              : data.startTime?.trim() || null,
          endTime:
            data.endTime === undefined
              ? undefined
              : data.endTime?.trim() || null,
          status: data.status,
        },
        include: classSectionInclude,
      });
      return res.json(serializeClassSection(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A class with this course, section, academic year, and semester already exists"
        );
      }
      throw err;
    }
  }
);

/**
 * Soft-delete → INACTIVE. Hard delete not used (Enrollment references ClassSection).
 */
classesRouter.delete(
  "/:id",
  requirePermission(Permission.CLASSES_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const existing = await prisma.classSection.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Class not found");

    const updated = await prisma.classSection.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: classSectionInclude,
    });

    return res.json({
      ok: true,
      deactivated: true,
      class: serializeClassSection(updated),
    });
  }
);
