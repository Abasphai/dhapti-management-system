import type { Role, UserStatus } from "@prisma/client";
import { portalForRole } from "./auth.js";
import { permissionsForRole, type PermissionName } from "./permissions.js";

/** Public auth user DTO — never includes passwordHash */
export interface SafeAuthUser {
  id: string;
  email: string;
  role: Role;
  portal: "student" | "teacher" | "admin";
  status: UserStatus;
  permissions: PermissionName[];
  profile: unknown;
}

export function toSafeAuthUser(input: {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  profile: unknown;
}): SafeAuthUser {
  return {
    id: input.id,
    email: input.email,
    role: input.role,
    portal: portalForRole(input.role),
    status: input.status,
    permissions: [...permissionsForRole(input.role)],
    profile: input.profile ?? null,
  };
}
