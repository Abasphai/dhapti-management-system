import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { hashPassword } from "../lib/auth.js";
import { resolveDepartmentFilter } from "../lib/departmentScope.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeTeacher } from "../lib/serializeAdmin.js";
import { ensureTeacherClassSections } from "../lib/ensureTeacherClassSections.js";
import {
  classSectionInclude,
  serializeClassSection,
} from "../lib/serializeClass.js";
import {
  assignedCourseInclude,
  serializeAssignedCourse,
  validateTeacherCourseAssignment,
} from "../lib/teacherCourses.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const teachersRouter = Router();

teachersRouter.use(requireAuth);

const teacherBaseInclude = {
  user: { select: { status: true, email: true } },
  department: { select: { id: true, name: true, code: true } },
  courseTeachers: {
    include: { course: { select: { id: true, title: true, code: true } } },
  },
} as const;

const teacherInclude = {
  ...teacherBaseInclude,
  ratings: { select: { overallRating: true } },
} as const;

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/** Load teachers with ratings; fall back without ratings if schema/client mismatch. */
async function findTeachersSafe(args: {
  where: Prisma.TeacherWhereInput;
  skip?: number;
  take?: number;
}) {
  try {
    return await prisma.teacher.findMany({
      where: args.where,
      include: teacherInclude,
      orderBy: { facultyCode: "asc" },
      skip: args.skip,
      take: args.take,
    });
  } catch (err) {
    console.error(
      "[teachers] findMany with ratings failed; retrying without ratings:",
      err
    );
    const rows = await prisma.teacher.findMany({
      where: args.where,
      include: teacherBaseInclude,
      orderBy: { facultyCode: "asc" },
      skip: args.skip,
      take: args.take,
    });
    return rows.map((row) => ({ ...row, ratings: [] as { overallRating: number }[] }));
  }
}

async function findTeacherSafe(id: string) {
  try {
    return await prisma.teacher.findUnique({
      where: { id },
      include: teacherInclude,
    });
  } catch (err) {
    console.error(
      "[teachers] findUnique with ratings failed; retrying without ratings:",
      err
    );
    const row = await prisma.teacher.findUnique({
      where: { id },
      include: teacherBaseInclude,
    });
    return row ? { ...row, ratings: [] as { overallRating: number }[] } : null;
  }
}

teachersRouter.get(
  "/",
  requirePermission(Permission.TEACHERS_READ),
  async (req: AuthedRequest, res) => {
    try {
      const { page, pageSize, skip, take } = parsePagination(req.query);
      const q = String(req.query.q ?? "").trim();
      const status = String(req.query.status ?? "").trim().toUpperCase();
      const department = String(req.query.department ?? "").trim();
      const requestedDept = String(req.query.departmentId ?? "").trim();
      const facultyId = String(req.query.facultyId ?? "").trim();

      const scoped = resolveDepartmentFilter(req, res, requestedDept);
      if (!scoped.ok) return;
      const departmentId = scoped.departmentId ?? "";

      const and: Prisma.TeacherWhereInput[] = [];

      if (q) {
        and.push({
          OR: [
            { facultyCode: { contains: q } },
            { fullName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { designation: { contains: q } },
            { department: { name: { contains: q } } },
          ],
        });
      }

      if (
        status &&
        ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"].includes(status)
      ) {
        and.push({
          user: {
            status: status as
              | "ACTIVE"
              | "INACTIVE"
              | "SUSPENDED"
              | "GRADUATED",
          },
        });
      }

      if (facultyId) {
        and.push({ department: { facultyId } });
      }

      if (departmentId) {
        and.push({ departmentId });
      } else if (department && department !== "All Departments") {
        and.push({ department: { name: { contains: department } } });
      }

      const where: Prisma.TeacherWhereInput =
        and.length > 0 ? { AND: and } : {};

      const [total, rows] = await Promise.all([
        prisma.teacher.count({ where }),
        findTeachersSafe({ where, skip, take }),
      ]);

      return res.json({
        data: rows.map(serializeTeacher),
        pagination: paginationMeta(total, page, pageSize),
      });
    } catch (err) {
      console.error("[teachers] GET / failed:", err);
      const { page, pageSize } = parsePagination(req.query);
      return res.status(200).json({
        data: [],
        pagination: paginationMeta(0, page, pageSize),
        warning: "Teachers could not be loaded; returned empty list.",
      });
    }
  }
);

/** Teacher self: own assigned courses only (identity from JWT). */
teachersRouter.get(
  "/me/courses",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const rows = await prisma.courseTeacher.findMany({
      where: { teacherId: teacher.id },
      include: assignedCourseInclude,
      orderBy: { course: { code: "asc" } },
    });

    return res.json({
      data: rows.map(serializeAssignedCourse),
    });
  }
);

/** Teacher self: own class sections only (identity from JWT). */
teachersRouter.get(
  "/me/classes",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    // Auto-link ClassSections for assigned courses that have no section yet.
    await ensureTeacherClassSections(teacher.id);

    const assigned = await prisma.courseTeacher.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    });
    const assignedCourseIds = assigned.map((a) => a.courseId);

    const rows = await prisma.classSection.findMany({
      where: {
        teacherId: teacher.id,
        status: "ACTIVE",
        // Keep My Classes in sync with My Courses (CourseTeacher).
        ...(assignedCourseIds.length
          ? { courseId: { in: assignedCourseIds } }
          : { courseId: { in: [] } }),
      },
      include: classSectionInclude,
      orderBy: [
        { academicYear: "desc" },
        { course: { code: "asc" } },
        { section: "asc" },
      ],
    });

    return res.json({
      data: rows.map(serializeClassSection),
    });
  }
);

teachersRouter.get(
  "/:id/courses",
  requirePermission(Permission.TEACHER_COURSES_READ),
  async (req, res) => {
    const teacherId = paramId(req.params.id);
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher not found");
    }

    const rows = await prisma.courseTeacher.findMany({
      where: { teacherId },
      include: assignedCourseInclude,
      orderBy: { course: { code: "asc" } },
    });

    return res.json({
      data: rows.map(serializeAssignedCourse),
    });
  }
);

teachersRouter.post(
  "/:id/courses",
  requirePermission(Permission.TEACHER_COURSES_ASSIGN),
  async (req, res) => {
    const schema = z.object({ courseId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "courseId is required");
    }

    const teacherId = paramId(req.params.id);
    const { courseId } = parsed.data;

    const check = await validateTeacherCourseAssignment(teacherId, courseId);
    if (!check.ok) {
      return sendError(
        res,
        check.error.status,
        check.error.code,
        check.error.message
      );
    }

    try {
      const created = await prisma.courseTeacher.create({
        data: { teacherId, courseId },
        include: assignedCourseInclude,
      });
      // Keep My Classes / My Attendance in sync with course assignments.
      await ensureTeacherClassSections(teacherId);
      return res.status(201).json(serializeAssignedCourse(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Course is already assigned to this teacher"
        );
      }
      throw err;
    }
  }
);

teachersRouter.delete(
  "/:id/courses/:courseId",
  requirePermission(Permission.TEACHER_COURSES_REMOVE),
  async (req, res) => {
    const teacherId = paramId(req.params.id);
    const courseId = paramId(req.params.courseId);

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher not found");
    }

    const existing = await prisma.courseTeacher.findUnique({
      where: { courseId_teacherId: { courseId, teacherId } },
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    await prisma.courseTeacher.delete({
      where: { id: existing.id },
    });

    return res.json({
      ok: true,
      removed: true,
      teacherId,
      courseId,
    });
  }
);

teachersRouter.get(
  "/:id",
  requirePermission(Permission.TEACHERS_READ),
  async (req, res) => {
    try {
      const id = paramId(req.params.id);
      const teacher = await findTeacherSafe(id);
      if (!teacher) return sendError(res, 404, "NOT_FOUND", "Teacher not found");
      return res.json(serializeTeacher(teacher));
    } catch (err) {
      console.error("[teachers] GET /:id failed:", err);
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to load teacher");
    }
  }
);

teachersRouter.post(
  "/",
  requirePermission(Permission.TEACHERS_CREATE),
  async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6).optional(),
      fullName: z.string().min(2),
      phone: z.string().optional(),
      bio: z.string().optional(),
      designation: z.string().optional(),
      departmentId: z.string().optional(),
      facultyCode: z.string().min(3).optional(),
      courseIds: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid teacher payload");
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();
    const password = data.password ?? "DHAPTI@2026";
    const courseIds = [...new Set(data.courseIds ?? [])];

    if (courseIds.length > 0) {
      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds }, status: "ACTIVE" },
        select: { id: true },
      });
      if (courses.length !== courseIds.length) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "One or more courses are invalid or inactive"
        );
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendError(res, 409, "CONFLICT", "Email already exists");
    }

    let facultyCode = data.facultyCode?.trim();
    if (facultyCode) {
      const taken = await prisma.teacher.findUnique({
        where: { facultyCode },
      });
      if (taken) {
        return sendError(res, 409, "CONFLICT", "Staff ID already exists");
      }
    } else {
      const count = await prisma.teacher.count();
      // Unique even when parallel tests leave orphaned teachers in SQLite
      facultyCode = `DHAPTI-FAC-${String(count + 100).padStart(3, "0")}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    }

    try {
      const passwordHash = await hashPassword(password);
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: "TEACHER",
            status: "ACTIVE",
            teacher: {
              create: {
                facultyCode: facultyCode!,
                fullName: data.fullName,
                email,
                phone: data.phone,
                bio: data.bio,
                designation: data.designation,
                departmentId: data.departmentId,
                courseTeachers:
                  courseIds.length > 0
                    ? { create: courseIds.map((courseId) => ({ courseId })) }
                    : undefined,
              },
            },
          },
          include: { teacher: { include: teacherInclude } },
        });
        return user.teacher!;
      });

      return res.status(201).json(serializeTeacher(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A teacher with this email or staff ID already exists"
        );
      }
      throw err;
    }
  }
);

teachersRouter.patch(
  "/:id/status",
  requirePermission(Permission.TEACHERS_UPDATE),
  async (req, res) => {
    const statusParsed = z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED"])
      .safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status");
    }
    const id = paramId(req.params.id);
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) return sendError(res, 404, "NOT_FOUND", "Teacher not found");

    await prisma.user.update({
      where: { id: teacher.userId },
      data: { status: statusParsed.data },
    });

    const updated = await findTeacherSafe(id);
    return res.json(serializeTeacher(updated!));
  }
);

teachersRouter.patch(
  "/:id",
  requirePermission(Permission.TEACHERS_UPDATE),
  async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      designation: z.string().nullable().optional(),
      departmentId: z.string().nullable().optional(),
      facultyCode: z.string().min(3).optional(),
      courseIds: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Teacher not found");

    const data = parsed.data;
    if (data.facultyCode && data.facultyCode !== existing.facultyCode) {
      const taken = await prisma.teacher.findUnique({
        where: { facultyCode: data.facultyCode },
      });
      if (taken) {
        return sendError(res, 409, "CONFLICT", "Staff ID already exists");
      }
    }

    if (data.email) {
      const email = data.email.toLowerCase();
      const emailTaken = await prisma.user.findFirst({
        where: { email, NOT: { id: existing.userId } },
      });
      if (emailTaken) {
        return sendError(res, 409, "CONFLICT", "Email already exists");
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (data.email) {
          await tx.user.update({
            where: { id: existing.userId },
            data: { email: data.email.toLowerCase() },
          });
        }

        if (data.courseIds) {
          const courseIds = [...new Set(data.courseIds)];
          if (courseIds.length > 0) {
            const courses = await tx.course.findMany({
              where: { id: { in: courseIds }, status: "ACTIVE" },
              select: { id: true },
            });
            if (courses.length !== courseIds.length) {
              throw new Error("INVALID_COURSE_IDS");
            }
          }
          await tx.courseTeacher.deleteMany({ where: { teacherId: id } });
          if (courseIds.length > 0) {
            await tx.courseTeacher.createMany({
              data: courseIds.map((courseId) => ({
                teacherId: id,
                courseId,
              })),
            });
          }
        }

        return tx.teacher.update({
          where: { id },
          data: {
            fullName: data.fullName,
            email: data.email?.toLowerCase(),
            phone: data.phone,
            bio: data.bio,
            designation: data.designation,
            departmentId: data.departmentId,
            facultyCode: data.facultyCode,
          },
          include: teacherInclude,
        });
      });

      return res.json(serializeTeacher(updated));
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_COURSE_IDS") {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "One or more courses are invalid or inactive"
        );
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Duplicate email or staff ID");
      }
      throw err;
    }
  }
);

/** Soft-delete → INACTIVE. Does not remove academic links. */
teachersRouter.delete(
  "/:id",
  requirePermission(Permission.TEACHERS_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) return sendError(res, 404, "NOT_FOUND", "Teacher not found");

    await prisma.user.update({
      where: { id: teacher.userId },
      data: { status: "INACTIVE" },
    });

    const updated = await findTeacherSafe(id);
    return res.json({
      ok: true,
      deactivated: true,
      teacher: serializeTeacher(updated!),
    });
  }
);
