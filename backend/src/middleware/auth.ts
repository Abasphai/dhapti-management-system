import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

import { verifyToken } from "../lib/auth.js";
import { sendError } from "../lib/errors.js";
import {
  hasAnyPermission,
  type PermissionName,
} from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: Role;
    email: string;
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "GRADUATED";
    /** Set for DEPARTMENT_ADMIN from UserDepartmentScope */
    departmentId?: string | null;
  };
}

/**
 * Verifies Bearer JWT, then re-loads the user from DB so
 * INACTIVE/SUSPENDED accounts and role changes take effect immediately.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        status: true,
        departmentScope: { select: { departmentId: true } },
      },
    });

    if (!user) {
      return sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token");
    }

    if (user.status !== "ACTIVE") {
      return sendError(
        res,
        401,
        "UNAUTHORIZED",
        "Account is inactive or suspended"
      );
    }

    // Reject tokens issued before a role change
    if (user.role !== payload.role) {
      return sendError(res, 401, "UNAUTHORIZED", "Token is no longer valid");
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      status: user.status,
      departmentId: user.departmentScope?.departmentId ?? null,
    };
    return next();
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const message = err instanceof Error ? err.message : "";
    if (name === "TokenExpiredError" || /jwt expired/i.test(message)) {
      return sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token", {
        reason: "TOKEN_EXPIRED",
      });
    }
    return sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token", {
      reason: "TOKEN_INVALID",
    });
  }
}

/** Role gate — authenticated but wrong role → 403 */
export function requireRoles(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You do not have permission to perform this action"
      );
    }
    return next();
  };
}

/** Permission gate — extensible RBAC for future modules */
export function requirePermission(...permissions: PermissionName[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    }
    if (!hasAnyPermission(req.user.role, permissions)) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You do not have permission to perform this action"
      );
    }
    return next();
  };
}

/**
 * Ensures DEPARTMENT_ADMIN has an assigned department scope.
 * No-op for other roles.
 */
export function requireDepartmentScopeAssigned(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role === "DEPARTMENT_ADMIN" && !req.user.departmentId) {
    return sendError(
      res,
      403,
      "FORBIDDEN",
      "No department scope assigned to this account"
    );
  }
  return next();
}
