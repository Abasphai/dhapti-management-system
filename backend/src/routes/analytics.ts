import { Router } from "express";
import { z } from "zod";

import { getAnalyticsOverview } from "../lib/analyticsOverview.js";
import { sendError } from "../lib/errors.js";
import { Permission } from "../lib/permissions.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
} from "../middleware/auth.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

/**
 * GET /api/admin/analytics/overview
 * Query: facultyId?, departmentId?, academicYear?
 */
analyticsRouter.get(
  "/admin/analytics/overview",
  requireRoles("ADMIN"),
  requirePermission(Permission.DASHBOARD_READ),
  async (req, res) => {
    const schema = z.object({
      facultyId: z.string().trim().max(64).optional(),
      departmentId: z.string().trim().max(64).optional(),
      academicYear: z.string().trim().max(32).optional(),
    });
    const parsed = schema.safeParse({
      facultyId: req.query.facultyId,
      departmentId: req.query.departmentId,
      academicYear: req.query.academicYear,
    });
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid analytics filters");
    }

    try {
      const data = await getAnalyticsOverview({
        facultyId: parsed.data.facultyId || null,
        departmentId: parsed.data.departmentId || null,
        academicYear: parsed.data.academicYear || null,
      });
      return res.json(data);
    } catch (err) {
      console.error("[analytics/overview]", err);
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to build analytics overview");
    }
  }
);
