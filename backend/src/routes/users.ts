import { Prisma, type Role, type UserStatus } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";

import { hashPassword } from "../lib/auth.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

const userInclude = {
  student: {
    select: {
      id: true,
      fullName: true,
      studentCode: true,
      facultyId: true,
      departmentId: true,
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      facultyCode: true,
      departmentId: true,
    },
  },
  admin: {
    select: {
      id: true,
      fullName: true,
    },
  },
} as const;

type UserWithProfiles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  GRADUATED: "Graduated",
};

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function serializeSystemUser(user: UserWithProfiles) {
  const fullName =
    user.admin?.fullName ||
    user.teacher?.fullName ||
    user.student?.fullName ||
    user.email;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: STATUS_LABEL[user.status] ?? user.status,
    statusCode: user.status,
    fullName,
    createdAt: user.createdAt.toISOString(),
    profile: user.student
      ? {
          type: "STUDENT" as const,
          id: user.student.id,
          code: user.student.studentCode,
          facultyId: user.student.facultyId,
          departmentId: user.student.departmentId,
        }
      : user.teacher
        ? {
            type: "TEACHER" as const,
            id: user.teacher.id,
            code: user.teacher.facultyCode,
            departmentId: user.teacher.departmentId,
          }
        : user.admin
          ? {
              type: "ADMIN" as const,
              id: user.admin.id,
            }
          : null,
  };
}

async function assertFacultyDepartment(opts: {
  role: Role;
  facultyId?: string;
  departmentId?: string;
}) {
  const { role, facultyId, departmentId } = opts;

  if (role === "ADMIN") {
    return { ok: true as const };
  }

  if (facultyId) {
    const faculty = await prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { id: true, status: true },
    });
    if (!faculty || faculty.status !== "ACTIVE") {
      return {
        ok: false as const,
        status: 400 as const,
        message: "Invalid or inactive faculty",
      };
    }
  }

  if (departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, status: true, facultyId: true },
    });
    if (!department || department.status !== "ACTIVE") {
      return {
        ok: false as const,
        status: 400 as const,
        message: "Invalid or inactive department",
      };
    }
    if (facultyId && department.facultyId !== facultyId) {
      return {
        ok: false as const,
        status: 400 as const,
        message: "Department does not belong to the selected faculty",
      };
    }
  }

  return { ok: true as const };
}

/** GET /admin/users — paginated system user directory */
usersRouter.get(
  "/",
  requirePermission(Permission.USERS_READ),
  async (req: AuthedRequest, res: Response) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const role = String(req.query.role ?? "").trim().toUpperCase();
    const status = String(req.query.status ?? "").trim().toUpperCase();

    const and: Prisma.UserWhereInput[] = [];

    if (q) {
      and.push({
        OR: [
          { email: { contains: q } },
          { student: { fullName: { contains: q } } },
          { teacher: { fullName: { contains: q } } },
          { admin: { fullName: { contains: q } } },
          { student: { studentCode: { contains: q } } },
          { teacher: { facultyCode: { contains: q } } },
        ],
      });
    }

    if (role && ["ADMIN", "TEACHER", "STUDENT"].includes(role)) {
      and.push({ role: role as Role });
    }

    if (
      status &&
      ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"].includes(status)
    ) {
      and.push({ status: status as UserStatus });
    }

    const where: Prisma.UserWhereInput = and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeSystemUser),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** POST /admin/users — create user + role profile */
usersRouter.post(
  "/",
  requirePermission(Permission.USERS_MANAGE),
  async (req: AuthedRequest, res: Response) => {
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
      password: z.string().min(6).optional(),
      facultyId: z.string().optional(),
      departmentId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid user payload");
    }

    const data = parsed.data;
    const email = data.email.toLowerCase().trim();
    const password = data.password?.trim() || "DHAPTI@2026";
    const fullName = data.fullName.trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, 409, "CONFLICT", "Email already exists");
    }

    const facultyCheck = await assertFacultyDepartment({
      role: data.role,
      facultyId: data.facultyId,
      departmentId: data.departmentId,
    });
    if (!facultyCheck.ok) {
      return sendError(res, facultyCheck.status, "BAD_REQUEST", facultyCheck.message);
    }

    try {
      const passwordHash = await hashPassword(password);

      const created = await prisma.$transaction(async (tx) => {
        if (data.role === "STUDENT") {
          const count = await tx.student.count();
          const studentCode = `DHAPTI-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
          return tx.user.create({
            data: {
              email,
              passwordHash,
              role: "STUDENT",
              status: "ACTIVE",
              student: {
                create: {
                  studentCode,
                  fullName,
                  email,
                  facultyId: data.facultyId,
                  departmentId: data.departmentId,
                },
              },
            },
            include: userInclude,
          });
        }

        if (data.role === "TEACHER") {
          const count = await tx.teacher.count();
          const facultyCode = `DHAPTI-FAC-${String(count + 100).padStart(3, "0")}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
          return tx.user.create({
            data: {
              email,
              passwordHash,
              role: "TEACHER",
              status: "ACTIVE",
              teacher: {
                create: {
                  facultyCode,
                  fullName,
                  email,
                  departmentId: data.departmentId,
                },
              },
            },
            include: userInclude,
          });
        }

        return tx.user.create({
          data: {
            email,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            admin: {
              create: {
                fullName,
                email,
              },
            },
          },
          include: userInclude,
        });
      });

      return res.status(201).json(serializeSystemUser(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A user with this email or identity code already exists"
        );
      }
      throw err;
    }
  }
);

/** PATCH /admin/users/:id — update profile fields (not role) */
usersRouter.patch(
  "/:id",
  requirePermission(Permission.USERS_MANAGE),
  async (req: AuthedRequest, res: Response) => {
    const schema = z.object({
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      facultyId: z.string().nullable().optional(),
      departmentId: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid user update payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "User not found");
    }

    const data = parsed.data;
    const nextEmail = data.email?.toLowerCase().trim();
    if (nextEmail && nextEmail !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (taken) {
        return sendError(res, 409, "CONFLICT", "Email already exists");
      }
    }

    const facultyId =
      data.facultyId === undefined
        ? undefined
        : data.facultyId || null;
    const departmentId =
      data.departmentId === undefined
        ? undefined
        : data.departmentId || null;

    if (existing.role !== "ADMIN" && (facultyId !== undefined || departmentId !== undefined)) {
      const check = await assertFacultyDepartment({
        role: existing.role,
        facultyId: facultyId ?? existing.student?.facultyId ?? undefined,
        departmentId:
          departmentId ??
          existing.student?.departmentId ??
          existing.teacher?.departmentId ??
          undefined,
      });
      if (!check.ok) {
        return sendError(res, check.status, "BAD_REQUEST", check.message);
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            ...(nextEmail ? { email: nextEmail } : {}),
          },
        });

        const fullName = data.fullName?.trim();
        const emailForProfile = nextEmail ?? existing.email;

        if (existing.student) {
          await tx.student.update({
            where: { userId: id },
            data: {
              ...(fullName ? { fullName } : {}),
              email: emailForProfile,
              ...(facultyId !== undefined ? { facultyId } : {}),
              ...(departmentId !== undefined ? { departmentId } : {}),
            },
          });
        } else if (existing.teacher) {
          await tx.teacher.update({
            where: { userId: id },
            data: {
              ...(fullName ? { fullName } : {}),
              email: emailForProfile,
              ...(departmentId !== undefined ? { departmentId } : {}),
            },
          });
        } else if (existing.admin) {
          await tx.admin.update({
            where: { userId: id },
            data: {
              ...(fullName ? { fullName } : {}),
              email: emailForProfile,
            },
          });
        }

        return tx.user.findUniqueOrThrow({
          where: { id },
          include: userInclude,
        });
      });

      return res.json(serializeSystemUser(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Email already exists");
      }
      throw err;
    }
  }
);

/** PATCH /admin/users/:id/reset-password */
usersRouter.patch(
  "/:id/reset-password",
  requirePermission(Permission.USERS_MANAGE),
  async (req: AuthedRequest, res: Response) => {
    const schema = z.object({
      password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Password must be at least 6 characters"
      );
    }

    const id = paramId(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!user) {
      return sendError(res, 404, "NOT_FOUND", "User not found");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return res.json({
      ok: true,
      id: user.id,
      email: user.email,
      message: "Password reset successfully",
    });
  }
);

/** PATCH /admin/users/:id/status — Active ↔ Suspended (or explicit status) */
usersRouter.patch(
  "/:id/status",
  requirePermission(Permission.USERS_MANAGE),
  async (req: AuthedRequest, res: Response) => {
    const schema = z.object({
      status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE", "GRADUATED"]).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status payload");
    }

    const id = paramId(req.params.id);
    if (req.user?.id === id) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "You cannot change the status of your own account"
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "User not found");
    }

    let nextStatus: UserStatus = parsed.data.status as UserStatus;
    if (!parsed.data.status) {
      nextStatus = existing.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: nextStatus },
      include: userInclude,
    });

    return res.json(serializeSystemUser(updated));
  }
);
