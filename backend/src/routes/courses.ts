import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { resolveDepartmentFilter } from "../lib/departmentScope.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeCourse } from "../lib/serializeAcademic.js";
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "../middleware/auth.js";

export const coursesRouter = Router();

coursesRouter.use(requireAuth);

const courseInclude = {
  faculty: { select: { id: true, name: true, code: true } },
  department: {
    select: { id: true, name: true, code: true, facultyId: true },
  },
} as const;

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const academicStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

coursesRouter.get(
  "/",
  requirePermission(Permission.COURSES_READ),
  async (req: AuthedRequest, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const requestedDept = String(req.query.departmentId ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();

    const scoped = resolveDepartmentFilter(req, res, requestedDept);
    if (!scoped.ok) return;
    const departmentId = scoped.departmentId ?? "";

    const and: Prisma.CourseWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { code: { contains: q } },
          { title: { contains: q } },
          { department: { name: { contains: q } } },
          { department: { code: { contains: q } } },
          { faculty: { name: { contains: q } } },
          { faculty: { code: { contains: q } } },
        ],
      });
    }
    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      and.push({ status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED" });
    }
    if (departmentId) {
      and.push({ departmentId });
    }
    if (facultyId) {
      and.push({
        OR: [{ facultyId }, { department: { facultyId } }],
      });
    }

    const where: Prisma.CourseWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        include: courseInclude,
        orderBy: { code: "asc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeCourse),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Admin: teachers assigned to a course */
coursesRouter.get(
  "/:id/teachers",
  requirePermission(Permission.TEACHER_COURSES_READ),
  async (req, res) => {
    const courseId = paramId(req.params.id);
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

    const rows = await prisma.courseTeacher.findMany({
      where: { courseId },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            facultyCode: true,
            email: true,
            designation: true,
            department: { select: { id: true, name: true, code: true } },
            user: { select: { status: true } },
          },
        },
      },
      orderBy: { teacher: { fullName: "asc" } },
    });

    return res.json({
      data: rows.map((row) => ({
        assignmentId: row.id,
        id: row.teacher.id,
        teacherId: row.teacher.id,
        name: row.teacher.fullName,
        fullName: row.teacher.fullName,
        facultyCode: row.teacher.facultyCode,
        email: row.teacher.email,
        designation: row.teacher.designation,
        department: row.teacher.department?.name ?? null,
        departmentId: row.teacher.department?.id ?? null,
        status:
          row.teacher.user.status === "ACTIVE"
            ? "Active"
            : row.teacher.user.status === "SUSPENDED"
              ? "Suspended"
              : "Inactive",
        accountStatus: row.teacher.user.status,
        assignedAt: row.createdAt.toISOString(),
      })),
    });
  }
);

coursesRouter.get(
  "/:id",
  requirePermission(Permission.COURSES_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const course = await prisma.course.findUnique({
      where: { id },
      include: courseInclude,
    });
    if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");
    return res.json(serializeCourse(course));
  }
);

coursesRouter.post(
  "/",
  requirePermission(Permission.COURSES_CREATE),
  async (req, res) => {
    const schema = z.object({
      code: z.string().min(2).max(20),
      title: z.string().min(2),
      credits: z.number().int().min(1).max(12).optional(),
      departmentId: z.string().min(1),
      semester: z.string().optional(),
      status: academicStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid course payload");
    }

    const department = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
    });
    if (!department) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid department");
    }

    const code = parsed.data.code.trim().toUpperCase();
    try {
      const created = await prisma.course.create({
        data: {
          code,
          title: parsed.data.title.trim(),
          credits: parsed.data.credits ?? 3,
          departmentId: department.id,
          facultyId: department.facultyId,
          semester: parsed.data.semester?.trim() || null,
          status: parsed.data.status ?? "ACTIVE",
        },
        include: courseInclude,
      });
      return res.status(201).json(serializeCourse(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Course code already exists");
      }
      throw err;
    }
  }
);

coursesRouter.patch(
  "/:id/status",
  requirePermission(Permission.COURSES_UPDATE),
  async (req, res) => {
    const statusParsed = academicStatusSchema.safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status");
    }
    const id = paramId(req.params.id);
    try {
      const updated = await prisma.course.update({
        where: { id },
        data: { status: statusParsed.data },
        include: courseInclude,
      });
      return res.json(serializeCourse(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return sendError(res, 404, "NOT_FOUND", "Course not found");
      }
      throw err;
    }
  }
);

coursesRouter.patch(
  "/:id",
  requirePermission(Permission.COURSES_UPDATE),
  async (req, res) => {
    const schema = z.object({
      code: z.string().min(2).max(20).optional(),
      title: z.string().min(2).optional(),
      credits: z.number().int().min(1).max(12).optional(),
      departmentId: z.string().min(1).optional(),
      semester: z.string().nullable().optional(),
      status: academicStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid course payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Course not found");

    let facultyId: string | undefined;
    const departmentId = parsed.data.departmentId;
    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!department) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid department");
      }
      facultyId = department.facultyId;
    }

    try {
      const updated = await prisma.course.update({
        where: { id },
        data: {
          code: parsed.data.code?.trim().toUpperCase(),
          title: parsed.data.title?.trim(),
          credits: parsed.data.credits,
          departmentId,
          facultyId,
          semester:
            parsed.data.semester === undefined
              ? undefined
              : parsed.data.semester?.trim() || null,
          status: parsed.data.status,
        },
        include: courseInclude,
      });
      return res.json(serializeCourse(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Course code already exists");
      }
      throw err;
    }
  }
);

/** Soft-delete → INACTIVE. Does not remove enrollments/history. */
coursesRouter.delete(
  "/:id",
  requirePermission(Permission.COURSES_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

    const updated = await prisma.course.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: courseInclude,
    });
    return res.json({
      ok: true,
      deactivated: true,
      course: serializeCourse(updated),
    });
  }
);
