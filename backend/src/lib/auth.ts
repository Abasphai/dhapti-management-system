import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface AuthTokenPayload {
  sub: string;
  role: Role;
  email: string;
}

/**
 * JWT signing secret — must come from environment.
 * Never falls back to a hardcoded production secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Configure it in backend/.env (see .env.example)."
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    (secret === "change-me-in-production" || secret.length < 32)
  ) {
    throw new Error(
      "JWT_SECRET is insecure for production. Use a random secret of at least 32 characters."
    );
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token payload");
  }
  const { sub, role, email } = decoded as AuthTokenPayload;
  if (!sub || !role || !email) {
    throw new Error("Invalid token payload");
  }
  return { sub, role, email };
}

/** Portal path segment for a role */
export function portalForRole(role: Role): "student" | "teacher" | "admin" {
  if (role === "STUDENT") return "student";
  if (role === "TEACHER") return "teacher";
  return "admin";
}
