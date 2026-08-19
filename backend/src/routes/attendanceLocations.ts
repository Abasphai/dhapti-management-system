import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { writeAudit } from "../lib/audit.js";
import {
  assertDepartmentScope,
  resolveDepartmentFilter,
} from "../lib/departmentScope.js";
import { ensureDefaultAttendanceLocations } from "../lib/ensureAttendanceLocations.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const attendanceLocationsRouter = Router();
export { ensureDefaultAttendanceLocations };

const locationInclude = {
  department: { select: { id: true, name: true, code: true } },
} as const;

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function serializeLocation(
  row: Prisma.AttendanceLocationGetPayload<{ include: typeof locationInclude }>
) {
  return {
    id: row.id,
    departmentId: row.departmentId,
    name: row.name,
    code: row.code,
    roomHint: row.roomHint,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    department: row.department,
    /** Phase B will serve the live QR display at this path. */
    displayPath: `/attendance/display/${row.id}`,
  };
}

/**
 * GET /admin/attendance-locations
 * ADMIN: all (optional departmentId filter)
 * DEPARTMENT_ADMIN: own department only
 */
attendanceLocationsRouter.get(
  "/admin/attendance-locations",
  requireAuth,
  requireRoles("ADMIN", "DEPARTMENT_ADMIN"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const requestedDept = String(req.query.departmentId ?? "").trim();

    const filter = resolveDepartmentFilter(req, res, requestedDept);
    if (!filter.ok) return;

    const and: Prisma.AttendanceLocationWhereInput[] = [];
    if (filter.departmentId) {
      and.push({ departmentId: filter.departmentId });
    }
    if (q) {
      and.push({
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { roomHint: { contains: q } },
          { department: { name: { contains: q } } },
          { department: { code: { contains: q } } },
        ],
      });
    }
    if (status === "ACTIVE" || status === "INACTIVE") {
      and.push({ status });
    }

    const where: Prisma.AttendanceLocationWhereInput = and.length
      ? { AND: and }
      : {};

    const [total, rows] = await Promise.all([
      prisma.attendanceLocation.count({ where }),
      prisma.attendanceLocation.findMany({
        where,
        include: locationInclude,
        orderBy: [{ department: { code: "asc" } }, { code: "asc" }],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeLocation),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/**
 * POST /admin/attendance-locations/ensure-defaults
 * Creates MAIN location per ACTIVE department if missing.
 */
attendanceLocationsRouter.post(
  "/admin/attendance-locations/ensure-defaults",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ATTENDANCE_LOCATIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const result = await ensureDefaultAttendanceLocations();
    writeAudit({
      actorId: req.user!.id,
      action: "ATTENDANCE_LOCATIONS_ENSURE",
      entityType: "AttendanceLocation",
      meta: result,
    });
    return res.json(result);
  }
);

/**
 * GET /admin/attendance-locations/:id
 */
attendanceLocationsRouter.get(
  "/admin/attendance-locations/:id",
  requireAuth,
  requireRoles("ADMIN", "DEPARTMENT_ADMIN"),
  requirePermission(Permission.ATTENDANCE_READ),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.attendanceLocation.findUnique({
      where: { id },
      include: locationInclude,
    });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Attendance location not found");
    }
    if (!assertDepartmentScope(req, res, row.departmentId)) return;
    return res.json(serializeLocation(row));
  }
);

/**
 * POST /admin/attendance-locations
 */
attendanceLocationsRouter.post(
  "/admin/attendance-locations",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ATTENDANCE_LOCATIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      departmentId: z.string().min(1),
      name: z.string().trim().min(2).max(160),
      code: z
        .string()
        .trim()
        .min(2)
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric"),
      roomHint: z.string().trim().max(120).optional().nullable(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid location payload");
    }

    const dept = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
    });
    if (!dept) {
      return sendError(res, 400, "BAD_REQUEST", "Department not found");
    }

    const code = parsed.data.code.toUpperCase();
    try {
      const created = await prisma.attendanceLocation.create({
        data: {
          departmentId: parsed.data.departmentId,
          name: parsed.data.name,
          code,
          roomHint: parsed.data.roomHint?.trim() || null,
          status: parsed.data.status ?? "ACTIVE",
        },
        include: locationInclude,
      });
      writeAudit({
        actorId: req.user!.id,
        action: "ATTENDANCE_LOCATION_CREATE",
        entityType: "AttendanceLocation",
        entityId: created.id,
        meta: {
          departmentId: created.departmentId,
          code: created.code,
        },
      });
      return res.status(201).json(serializeLocation(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Location code already exists for this department"
        );
      }
      throw err;
    }
  }
);

/**
 * PATCH /admin/attendance-locations/:id
 */
attendanceLocationsRouter.patch(
  "/admin/attendance-locations/:id",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ATTENDANCE_LOCATIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const schema = z
      .object({
        name: z.string().trim().min(2).max(160).optional(),
        roomHint: z.string().trim().max(120).optional().nullable(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .refine((o) => Object.keys(o).length > 0, {
        message: "At least one field is required",
      });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid location update");
    }

    const existing = await prisma.attendanceLocation.findUnique({
      where: { id },
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Attendance location not found");
    }

    const updated = await prisma.attendanceLocation.update({
      where: { id },
      data: {
        ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
        ...(parsed.data.roomHint !== undefined
          ? { roomHint: parsed.data.roomHint?.trim() || null }
          : {}),
        ...(parsed.data.status != null ? { status: parsed.data.status } : {}),
      },
      include: locationInclude,
    });

    writeAudit({
      actorId: req.user!.id,
      action: "ATTENDANCE_LOCATION_UPDATE",
      entityType: "AttendanceLocation",
      entityId: updated.id,
      meta: { keys: Object.keys(parsed.data) },
    });

    return res.json(serializeLocation(updated));
  }
);

/**
 * POST /admin/attendance-locations/:id/regenerate-tokens
 * Phase A: revoke all active QR tokens for the location (invalidates prior display codes).
 * Phase B will mint the next rotating token on the display endpoint.
 */
attendanceLocationsRouter.post(
  "/admin/attendance-locations/:id/regenerate-tokens",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ATTENDANCE_LOCATIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const location = await prisma.attendanceLocation.findUnique({
      where: { id },
    });
    if (!location) {
      return sendError(res, 404, "NOT_FOUND", "Attendance location not found");
    }

    const { revokeAttendanceTokensForLocation } = await import(
      "../lib/facultyQrAttendance.js"
    );
    const result = await revokeAttendanceTokensForLocation(id);

    writeAudit({
      actorId: req.user!.id,
      action: "ATTENDANCE_QR_REGENERATE",
      entityType: "AttendanceLocation",
      entityId: id,
      meta: { revoked: result.count },
    });

    return res.json({
      locationId: id,
      revokedActiveTokens: result.count,
      message:
        "Active QR tokens revoked. The next display refresh will issue a new token.",
    });
  }
);
