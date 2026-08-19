import { Router } from "express";

import {
  getAdminDashboardStats,
  getDepartmentDashboardStats,
  getStudentDashboardStats,
  getTeacherDashboardStats,
} from "../lib/dashboardStats.js";
import { sendError } from "../lib/errors.js";
import { Permission } from "../lib/permissions.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

/**
 * GET /admin/dashboard/stats
 */
dashboardRouter.get(
  "/admin/dashboard/stats",
  requireRoles("ADMIN"),
  requirePermission(Permission.DASHBOARD_READ),
  async (_req, res) => {
    const stats = await getAdminDashboardStats();
    return res.json(stats);
  }
);

/**
 * GET /admin/department-dashboard/stats — DEPARTMENT_ADMIN scoped
 */
dashboardRouter.get(
  "/admin/department-dashboard/stats",
  requireRoles("DEPARTMENT_ADMIN"),
  requirePermission(Permission.DASHBOARD_READ),
  async (req: AuthedRequest, res) => {
    const departmentId = req.user?.departmentId;
    if (!departmentId) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "No department scope assigned to this account"
      );
    }
    const stats = await getDepartmentDashboardStats(departmentId);
    if (!stats) {
      return sendError(res, 404, "NOT_FOUND", "Department not found");
    }
    return res.json(stats);
  }
);

/**
 * GET /teacher/dashboard/stats
 */
dashboardRouter.get(
  "/teacher/dashboard/stats",
  requireRoles("TEACHER"),
  requirePermission(Permission.DASHBOARD_READ),
  async (req: AuthedRequest, res) => {
    const stats = await getTeacherDashboardStats(req.user!.id);
    if (!stats) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    return res.json(stats);
  }
);

/**
 * GET /student/dashboard/stats
 */
dashboardRouter.get(
  "/student/dashboard/stats",
  requireRoles("STUDENT"),
  requirePermission(Permission.DASHBOARD_READ),
  async (req: AuthedRequest, res) => {
    const stats = await getStudentDashboardStats(req.user!.id);
    if (!stats) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    return res.json(stats);
  }
);
