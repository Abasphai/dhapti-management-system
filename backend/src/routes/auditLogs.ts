import { Router } from "express";

import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
} from "../middleware/auth.js";

export const auditLogsRouter = Router();

const MODULE_PREFIXES: Record<string, string[]> = {
  Auth: ["AUTH_", "LOGIN", "LOGOUT"],
  Marks: ["GRADE_", "RESULT_", "MARK"],
  Admissions: ["ADMISSION"],
  Certificates: ["CERTIFICATE", "CmsCertificate"],
  CMS: ["CMS_"],
  "Q&A": ["QUESTION_"],
  Settings: ["SETTINGS_"],
};

auditLogsRouter.get(
  "/admin/audit-logs",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.SETTINGS_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const module = String(req.query.module || "").trim();
    const q = String(req.query.q || "").trim();

    const and: object[] = [];

    if (module && MODULE_PREFIXES[module]) {
      const prefixes = MODULE_PREFIXES[module];
      and.push({
        OR: prefixes.flatMap((p) => [
          { action: { contains: p } },
          { entityType: { contains: p.replace(/_$/, "") } },
        ]),
      });
    } else if (module === "Certificates") {
      and.push({
        OR: [
          { action: { contains: "CERTIFICATE" } },
          { entityType: { contains: "Certificate" } },
        ],
      });
    }

    if (q) {
      and.push({
        OR: [
          { actor: { email: { contains: q } } },
          { action: { contains: q } },
          { entityType: { contains: q } },
          { entityId: { contains: q } },
          { metaJson: { contains: q } },
        ],
      });
    }

    const where = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              email: true,
              role: true,
              admin: { select: { fullName: true } },
              teacher: { select: { fullName: true } },
              student: { select: { fullName: true } },
            },
          },
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
        const actorName =
          row.actor?.admin?.fullName ||
          row.actor?.teacher?.fullName ||
          row.actor?.student?.fullName ||
          row.actor?.email ||
          "System";
        const moduleGuess =
          typeof meta?.module === "string"
            ? meta.module
            : row.action.startsWith("CMS_")
              ? "CMS"
              : row.action.includes("QUESTION")
                ? "Q&A"
                : row.action.includes("CERTIFICATE") ||
                    row.entityType.includes("Certificate")
                  ? "Certificates"
                  : row.action.includes("ADMISSION")
                    ? "Admissions"
                    : row.action.includes("GRADE") ||
                        row.action.includes("RESULT")
                      ? "Marks"
                      : row.action.includes("SETTINGS")
                        ? "Settings"
                        : row.action.includes("AUTH") ||
                            row.action.includes("LOGIN")
                          ? "Auth"
                          : row.entityType;

        return {
          id: row.id,
          userName: actorName,
          userEmail: row.actor?.email ?? null,
          role: row.actor?.role ?? "—",
          action: row.action,
          module: moduleGuess,
          entityType: row.entityType,
          entityId: row.entityId,
          details: meta,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);
