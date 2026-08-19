import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  getPublicSettings,
  getSystemSettings,
  patchSystemSettings,
} from "../lib/settings.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const settingsRouter = Router();

const settingsPatchSchema = z
  .object({
    isAdmissionsOpen: z.boolean().optional(),
    currentAcademicYear: z.string().trim().min(2).max(40).optional(),
    currentSemester: z.string().trim().min(1).max(40).optional(),
    maintenanceMode: z.boolean().optional(),
    universityName: z.string().trim().min(2).max(160).optional(),
    campusAddress: z.string().trim().min(2).max(300).optional(),
    contactEmail: z.string().trim().email().max(160).optional(),
    contactPhone: z.string().trim().min(3).max(40).optional(),
    registrationOpen: z.boolean().optional(),
    studentPortalEnabled: z.boolean().optional(),
    teacherPortalEnabled: z.boolean().optional(),
    requireAdminGradeApproval: z.boolean().optional(),
    minAttendanceThreshold: z.number().min(0).max(100).optional(),
    passingGradeCutoff: z.number().min(0).max(100).optional(),
    maxUploadFileMb: z.number().min(1).max(2000).optional(),
    defaultTuitionFee: z.number().min(0).max(1_000_000).optional(),
    admissionApplicationFee: z.number().min(0).max(1_000_000).optional(),
    paymentCurrency: z.enum(["USD", "SOS"]).optional(),
    paymentGracePeriodDays: z.number().int().min(0).max(365).optional(),
    sendStudentWelcomeEmail: z.boolean().optional(),
    sendLowAttendanceWarning: z.boolean().optional(),
    sendGradeApprovalAlert: z.boolean().optional(),
    facultyAttendanceGraceMinutes: z.number().int().min(0).max(120).optional(),
    facultyQrTokenTtlSeconds: z.number().int().min(60).max(3600).optional(),
    facultyRequiredClassMinutesFallback: z
      .number()
      .int()
      .min(30)
      .max(480)
      .optional(),
    allowManualFacultyAttendance: z.boolean().optional(),
    institutionTimezone: z.string().trim().min(3).max(64).optional(),
    facultyQrEarlyStartMinutes: z.number().int().min(0).max(180).optional(),
    facultyQrLateEndMinutes: z.number().int().min(0).max(360).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one setting is required",
  });

/**
 * GET /settings/public — admissions/year flags for public site (no auth).
 */
settingsRouter.get("/settings/public", async (_req, res) => {
  const settings = await getPublicSettings();
  return res.json(settings);
});

/**
 * GET /admin/settings — full admin settings document.
 */
settingsRouter.get(
  "/admin/settings",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.SETTINGS_READ),
  async (_req, res) => {
    const settings = await getSystemSettings();
    return res.json(settings);
  }
);

/**
 * PATCH /admin/settings — update one or more settings keys.
 */
settingsRouter.patch(
  "/admin/settings",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.SETTINGS_MANAGE),
  async (req: AuthedRequest, res) => {
    const parsed = settingsPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid settings payload");
    }

    const updated = await patchSystemSettings(parsed.data);

    await prisma.auditLog
      .create({
        data: {
          actorId: req.user!.id,
          action: "SETTINGS_UPDATE",
          entityType: "SystemSetting",
          metaJson: JSON.stringify({
            keys: Object.keys(parsed.data),
            role: req.user!.role,
          }),
        },
      })
      .catch(() => {});

    return res.json(updated);
  }
);

/**
 * GET /admin/settings/audit-logs — recent admin/system actions.
 */
settingsRouter.get(
  "/admin/settings/audit-logs",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.SETTINGS_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const [total, rows] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: {
          actor: { select: { email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((row) => {
        let meta: Record<string, unknown> | null = null;
        if (row.metaJson) {
          try {
            meta = JSON.parse(row.metaJson) as Record<string, unknown>;
          } catch {
            meta = null;
          }
        }
        return {
          id: row.id,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          createdAt: row.createdAt.toISOString(),
          user: row.actor?.email ?? "System",
          role: row.actor?.role ?? (meta?.role as string | undefined) ?? "—",
          ip:
            typeof meta?.ip === "string"
              ? meta.ip
              : typeof meta?.clientIp === "string"
                ? meta.clientIp
                : "—",
        };
      }),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/**
 * GET /admin/settings/backup — JSON snapshot of core university data.
 */
settingsRouter.get(
  "/admin/settings/backup",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.SETTINGS_MANAGE),
  async (req: AuthedRequest, res) => {
    const [
      settings,
      faculties,
      departments,
      courses,
      students,
      teachers,
      classSections,
      enrollments,
      payments,
      users,
    ] = await Promise.all([
      getSystemSettings(),
      prisma.faculty.findMany(),
      prisma.department.findMany(),
      prisma.course.findMany(),
      prisma.student.findMany({
        select: {
          id: true,
          studentCode: true,
          fullName: true,
          email: true,
          phone: true,
          facultyId: true,
          departmentId: true,
          semester: true,
          program: true,
          batch: true,
        },
      }),
      prisma.teacher.findMany({
        select: {
          id: true,
          facultyCode: true,
          fullName: true,
          email: true,
          designation: true,
          departmentId: true,
        },
      }),
      prisma.classSection.findMany(),
      prisma.enrollment.findMany({
        select: {
          id: true,
          studentId: true,
          classSectionId: true,
          status: true,
          enrolledAt: true,
        },
      }),
      prisma.payment.findMany({
        select: {
          id: true,
          studentId: true,
          amount: true,
          description: true,
          semester: true,
          status: true,
          dueDate: true,
          paidAt: true,
          receiptNumber: true,
        },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.email,
      version: 1,
      settings,
      faculties,
      departments,
      courses,
      students,
      teachers,
      classSections,
      enrollments,
      payments,
      users,
    };

    await prisma.auditLog
      .create({
        data: {
          actorId: req.user!.id,
          action: "SETTINGS_BACKUP_EXPORT",
          entityType: "SystemBackup",
          metaJson: JSON.stringify({ role: req.user!.role }),
        },
      })
      .catch(() => {});

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dhapti-system-backup-${stamp}.json"`
    );
    return res.status(200).send(JSON.stringify(payload, null, 2));
  }
);
