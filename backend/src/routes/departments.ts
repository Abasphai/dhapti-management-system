import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeDepartment } from "../lib/serializeAcademic.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

const departmentInclude = {
  faculty: { select: { id: true, name: true, code: true } },
  _count: { select: { courses: true, students: true, teachers: true } },
} as const;

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const academicStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

departmentsRouter.get(
  "/",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const facultyId = String(req.query.facultyId ?? "").trim();

    const and: Prisma.DepartmentWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
          { faculty: { name: { contains: q } } },
          { faculty: { code: { contains: q } } },
        ],
      });
    }
    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      and.push({ status: status as "ACTIVE" | "INACTIVE" | "SUSPENDED" });
    }
    if (facultyId) {
      and.push({ facultyId });
    }

    const where: Prisma.DepartmentWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        include: departmentInclude,
        orderBy: { code: "asc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeDepartment),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

departmentsRouter.get(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const department = await prisma.department.findUnique({
      where: { id },
      include: departmentInclude,
    });
    if (!department) {
      return sendError(res, 404, "NOT_FOUND", "Department not found");
    }
    return res.json(serializeDepartment(department));
  }
);

departmentsRouter.post(
  "/",
  requirePermission(Permission.DEPARTMENTS_CREATE),
  async (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      code: z.string().min(2).max(20),
      facultyId: z.string().min(1),
      status: academicStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid department payload");
    }

    const faculty = await prisma.faculty.findUnique({
      where: { id: parsed.data.facultyId },
    });
    if (!faculty) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid faculty");
    }

    const code = parsed.data.code.trim().toUpperCase();
    try {
      const created = await prisma.department.create({
        data: {
          name: parsed.data.name.trim(),
          code,
          facultyId: parsed.data.facultyId,
          status: parsed.data.status ?? "ACTIVE",
        },
        include: departmentInclude,
      });
      return res.status(201).json(serializeDepartment(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Department code already exists"
        );
      }
      throw err;
    }
  }
);

departmentsRouter.patch(
  "/:id/status",
  requirePermission(Permission.DEPARTMENTS_UPDATE),
  async (req, res) => {
    const statusParsed = academicStatusSchema.safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status");
    }
    const id = paramId(req.params.id);
    try {
      const updated = await prisma.department.update({
        where: { id },
        data: { status: statusParsed.data },
        include: departmentInclude,
      });
      return res.json(serializeDepartment(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return sendError(res, 404, "NOT_FOUND", "Department not found");
      }
      throw err;
    }
  }
);

departmentsRouter.patch(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_UPDATE),
  async (req, res) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      code: z.string().min(2).max(20).optional(),
      facultyId: z.string().min(1).optional(),
      status: academicStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid department payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Department not found");
    }

    if (parsed.data.facultyId) {
      const faculty = await prisma.faculty.findUnique({
        where: { id: parsed.data.facultyId },
      });
      if (!faculty) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid faculty");
      }
    }

    try {
      const updated = await prisma.department.update({
        where: { id },
        data: {
          name: parsed.data.name?.trim(),
          code: parsed.data.code?.trim().toUpperCase(),
          facultyId: parsed.data.facultyId,
          status: parsed.data.status,
        },
        include: departmentInclude,
      });
      return res.json(serializeDepartment(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Department code already exists"
        );
      }
      throw err;
    }
  }
);

/** Soft-delete → INACTIVE. Never hard-deletes when courses exist. */
departmentsRouter.delete(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const department = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { courses: true } } },
    });
    if (!department) {
      return sendError(res, 404, "NOT_FOUND", "Department not found");
    }

    const updated = await prisma.department.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: departmentInclude,
    });

    return res.json({
      ok: true,
      deactivated: true,
      hardDeleteBlocked: department._count.courses > 0,
      reason:
        department._count.courses > 0
          ? "Department has courses; deactivated instead of deleted"
          : undefined,
      department: serializeDepartment(updated),
    });
  }
);
