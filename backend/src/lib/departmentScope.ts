import type { Response } from "express";

import { sendError } from "./errors.js";
import type { AuthedRequest } from "../middleware/auth.js";

/** Department id for DEPARTMENT_ADMIN; null means unscoped (global ADMIN / other roles). */
export function scopedDepartmentId(
  user: AuthedRequest["user"] | undefined
): string | null {
  if (!user) return null;
  if (user.role === "DEPARTMENT_ADMIN") {
    return user.departmentId ?? null;
  }
  return null;
}

export function isDepartmentAdmin(user: AuthedRequest["user"] | undefined): boolean {
  return user?.role === "DEPARTMENT_ADMIN";
}

/**
 * Backend-enforced data scope for DEPARTMENT_ADMIN.
 * Returns false and sends 403 when the resource is outside the caller's department.
 * Global ADMIN and other roles always pass.
 */
export function assertDepartmentScope(
  req: AuthedRequest,
  res: Response,
  resourceDepartmentId: string | null | undefined
): boolean {
  const scope = scopedDepartmentId(req.user);
  if (scope === null) {
    if (isDepartmentAdmin(req.user)) {
      sendError(
        res,
        403,
        "FORBIDDEN",
        "No department scope assigned to this account"
      );
      return false;
    }
    return true;
  }
  if (!resourceDepartmentId || resourceDepartmentId !== scope) {
    sendError(
      res,
      403,
      "FORBIDDEN",
      "Access denied: outside your department scope"
    );
    return false;
  }
  return true;
}

/**
 * Force list/query department filter for DEPARTMENT_ADMIN.
 * Rejects attempts to query another department via query params.
 * Returns the effective departmentId to apply (or undefined for global admin with no filter).
 */
export function resolveDepartmentFilter(
  req: AuthedRequest,
  res: Response,
  requestedDepartmentId: string
): { ok: true; departmentId?: string } | { ok: false } {
  const scope = scopedDepartmentId(req.user);
  if (scope === null) {
    if (isDepartmentAdmin(req.user)) {
      sendError(
        res,
        403,
        "FORBIDDEN",
        "No department scope assigned to this account"
      );
      return { ok: false };
    }
    return {
      ok: true,
      departmentId: requestedDepartmentId || undefined,
    };
  }
  if (requestedDepartmentId && requestedDepartmentId !== scope) {
    sendError(
      res,
      403,
      "FORBIDDEN",
      "Access denied: cannot query another department"
    );
    return { ok: false };
  }
  return { ok: true, departmentId: scope };
}

/** 12-character uppercase alphanumeric verification code */
export function generateVerificationCode(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}
