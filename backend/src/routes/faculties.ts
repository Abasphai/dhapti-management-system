import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { DHAPTI_FACULTY_DEPARTMENT_CATALOG } from "../lib/biuFacultyCatalog.js";
import { ensureBiuFacultyCatalog } from "../lib/ensureBiuFacultyCatalog.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeFaculty } from "../lib/serializeAcademic.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const BIU_FACULTY_CODES = DHAPTI_FACULTY_DEPARTMENT_CATALOG.map((f) => f.code);

export const facultiesRouter = Router();

facultiesRouter.use(requireAuth);

const facultyCount = {
  _count: { select: { departments: true, students: true, courses: true } },
} as const;

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const academicStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

facultiesRouter.get(
  "/",
  requirePermission(Permission.FACULTIES_READ),
  async (req, res) => {
    const catalogCount = await prisma.faculty.count({
      where: { code: { in: [...BIU_FACULTY_CODES] } },
    });
    if (catalogCount < BIU_FACULTY_CODES.length) {
      await ensureBiuFacultyCatalog();
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();

    const and: Prisma.FacultyWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      });
    }
    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      and.push({ status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED" });
    }

    const where: Prisma.FacultyWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.faculty.count({ where }),
      prisma.faculty.findMany({
        where,
        include: facultyCount,
        orderBy: { code: "asc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeFaculty),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

facultiesRouter.get(
  "/:id",
  requirePermission(Permission.FACULTIES_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const faculty = await prisma.faculty.findUnique({
      where: { id },
      include: {
        ...facultyCount,
        departments: {
          orderBy: { code: "asc" },
          include: {
            _count: {
              select: { students: true, teachers: true, courses: true },
            },
            teachers: {
              where: { user: { status: "ACTIVE" } },
              select: {
                id: true,
                fullName: true,
                facultyCode: true,
                designation: true,
                email: true,
              },
              orderBy: { fullName: "asc" },
              take: 50,
            },
          },
        },
      },
    });
    if (!faculty) return sendError(res, 404, "NOT_FOUND", "Faculty not found");

    const departments = faculty.departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      status: d.status,
      studentCount: d._count.students,
      teacherCount: d._count.teachers,
      courseCount: d._count.courses,
      teachers: d.teachers.map((t) => ({
        id: t.id,
        fullName: t.fullName,
        facultyCode: t.facultyCode,
        designation: t.designation,
        email: t.email,
      })),
    }));

    const activeTeacherIds = new Set(
      departments.flatMap((d) => d.teachers.map((t) => t.id))
    );

    return res.json({
      ...serializeFaculty(faculty),
      departments,
      activeTeacherCount: activeTeacherIds.size,
      activeTeachers: departments.flatMap((d) =>
        d.teachers.map((t) => ({
          ...t,
          department: d.name,
          departmentCode: d.code,
        }))
      ),
    });
  }
);

facultiesRouter.post(
  "/",
  requirePermission(Permission.FACULTIES_CREATE),
  async (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      code: z.string().min(2).max(20),
      description: z.string().optional(),
      status: academicStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid faculty payload");
    }

    const code = parsed.data.code.trim().toUpperCase();
    try {
      const created = await prisma.faculty.create({
        data: {
          name: parsed.data.name.trim(),
          code,
          description: parsed.data.description?.trim() || null,
          status: parsed.data.status ?? "ACTIVE",
        },
        include: facultyCount,
      });
      return res.status(201).json(serializeFaculty(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Faculty code already exists");
      }
      throw err;
    }
  }
);

facultiesRouter.patch(
  "/:id/status",
  requirePermission(Permission.FACULTIES_UPDATE),
  async (req, res) => {
    const statusParsed = academicStatusSchema.safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status");
    }
    const id = paramId(req.params.id);
    try {
      const updated = await prisma.faculty.update({
        where: { id },
        data: { status: statusParsed.data },
        include: facultyCount,
      });
      return res.json(serializeFaculty(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return sendError(res, 404, "NOT_FOUND", "Faculty not found");
      }
      throw err;
    }
  }
);

facultiesRouter.patch(
  "/:id",
  requirePermission(Permission.FACULTIES_UPDATE),
  async (req, res) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      code: z.string().min(2).max(20).optional(),
      description: z.string().nullable().optional(),
      status: academicStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid faculty payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.faculty.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Faculty not found");

    try {
      const updated = await prisma.faculty.update({
        where: { id },
        data: {
          name: parsed.data.name?.trim(),
          code: parsed.data.code?.trim().toUpperCase(),
          description:
            parsed.data.description === undefined
              ? undefined
              : parsed.data.description?.trim() || null,
          status: parsed.data.status,
        },
        include: facultyCount,
      });
      return res.json(serializeFaculty(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Faculty code already exists");
      }
      throw err;
    }
  }
);

/**
 * Soft-delete: set INACTIVE. Hard delete blocked when departments exist.
 */
facultiesRouter.delete(
  "/:id",
  requirePermission(Permission.FACULTIES_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const faculty = await prisma.faculty.findUnique({
      where: { id },
      include: { _count: { select: { departments: true } } },
    });
    if (!faculty) return sendError(res, 404, "NOT_FOUND", "Faculty not found");

    if (faculty._count.departments > 0) {
      const updated = await prisma.faculty.update({
        where: { id },
        data: { status: "INACTIVE" },
        include: facultyCount,
      });
      return res.json({
        ok: true,
        deactivated: true,
        hardDeleteBlocked: true,
        reason: "Faculty has departments; deactivated instead of deleted",
        faculty: serializeFaculty(updated),
      });
    }

    const updated = await prisma.faculty.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: facultyCount,
    });
    return res.json({
      ok: true,
      deactivated: true,
      faculty: serializeFaculty(updated),
    });
  }
);
