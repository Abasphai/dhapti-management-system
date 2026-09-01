import { Router } from "express";
import { z } from "zod";

import {
  hashPassword,
  signToken,
  verifyPassword,
} from "../lib/auth.js";
import { ensureDemoAccounts } from "../lib/ensureDemoAccounts.js";
import {
  ensureMasterAdmin,
  isMasterAdminPassword,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_PASSWORD,
} from "../lib/ensureMasterAdmin.js";
import { sendError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { toSafeAuthUser } from "../lib/safeUser.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  expectedRole: z
    .enum([
      "STUDENT",
      "TEACHER",
      "ADMIN",
      "DEPARTMENT_ADMIN",
      "EXAM_ADMIN",
      "CERTIFICATE_ADMIN",
    ])
    .optional(),
});

const DEMO_PASSWORD = MASTER_ADMIN_PASSWORD;
const LEGACY_DEMO_PASSWORD = "BIU@2026";
const DEMO_EMAILS = new Set([
  MASTER_ADMIN_EMAIL,
  "cert.admin@dhapti.edu.so",
  "exam.control@dhapti.edu.so",
  "dept.cs@dhapti.edu.so",
  "faculty@dhapti.edu.so",
  "student@dhapti.edu.so",
  "mohamed.ali@dhapti.edu.so",
  "mohamudcade143@gmail.com",
]);

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn("[auth/login] Invalid payload:", parsed.error.flatten());
    return sendError(
      res,
      400,
      "BAD_REQUEST",
      "Invalid email or password format"
    );
  }

  const { email, password, expectedRole } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  console.log(
    `[auth/login] Attempt email=${normalizedEmail} expectedRole=${expectedRole ?? "any"}`
  );

  async function loadUser() {
    return prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        student: true,
        teacher: true,
        admin: true,
        departmentScope: {
          select: {
            departmentId: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  let user;
  try {
    // Always ensure / repair master admin when credentials match known passwords
    if (
      normalizedEmail === MASTER_ADMIN_EMAIL &&
      isMasterAdminPassword(password)
    ) {
      try {
        await ensureMasterAdmin();
      } catch (ensureErr) {
        console.error("[auth/login] ensureMasterAdmin failed:", ensureErr);
      }
    }

    user = await loadUser();

    // Dev safety: missing/corrupt any demo account → repair then reload once
    if (
      process.env.NODE_ENV !== "production" &&
      DEMO_EMAILS.has(normalizedEmail) &&
      isMasterAdminPassword(password) &&
      (!user || user.status !== "ACTIVE")
    ) {
      await ensureDemoAccounts();
      user = await loadUser();
    }
  } catch (err) {
    console.error("[auth/login] DB error:", err);
    if (
      normalizedEmail === MASTER_ADMIN_EMAIL &&
      isMasterAdminPassword(password)
    ) {
      try {
        await ensureMasterAdmin();
        user = await loadUser();
      } catch (repairErr) {
        console.error("[auth/login] Master admin repair failed:", repairErr);
        return sendError(
          res,
          503,
          "INTERNAL_ERROR",
          "Database unavailable. Please try again in a moment."
        );
      }
    } else if (
      process.env.NODE_ENV !== "production" &&
      DEMO_EMAILS.has(normalizedEmail) &&
      password === DEMO_PASSWORD
    ) {
      try {
        await ensureDemoAccounts();
        user = await loadUser();
      } catch (repairErr) {
        console.error("[auth/login] Demo account repair failed:", repairErr);
        return sendError(
          res,
          503,
          "INTERNAL_ERROR",
          "Database unavailable. Restart the API and run `npm run db:seed`."
        );
      }
    } else {
      return sendError(
        res,
        503,
        "INTERNAL_ERROR",
        "Database unavailable. Please try again in a moment."
      );
    }
  }

  if (!user) {
    console.warn(`[auth/login] User not found: ${normalizedEmail}`);
    return sendError(res, 401, "UNAUTHORIZED", "Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    console.warn(
      `[auth/login] Inactive user: ${normalizedEmail} status=${user.status}`
    );
    return sendError(res, 401, "UNAUTHORIZED", "Account is inactive or suspended");
  }

  let ok = false;
  try {
    ok = await verifyPassword(password, user.passwordHash);
    if (
      !ok &&
      password === LEGACY_DEMO_PASSWORD &&
      DEMO_EMAILS.has(normalizedEmail)
    ) {
      // Accept legacy BIU@2026 → verify against current DHAPTI hash after ensure
      ok = await verifyPassword(DEMO_PASSWORD, user.passwordHash);
      if (!ok && normalizedEmail === MASTER_ADMIN_EMAIL) {
        await ensureMasterAdmin();
        user = await loadUser();
        if (user) {
          ok = await verifyPassword(DEMO_PASSWORD, user.passwordHash);
        }
      }
    }
  } catch (verifyErr) {
    console.error("[auth/login] Password verify error:", verifyErr);
    ok = false;
  }

  // Repair corrupt hash for master admin (prod + dev) or demo accounts (dev)
  if (!ok && isMasterAdminPassword(password)) {
    if (normalizedEmail === MASTER_ADMIN_EMAIL) {
      await ensureMasterAdmin();
      user = await loadUser();
      if (user) {
        ok = await verifyPassword(DEMO_PASSWORD, user.passwordHash);
      }
    } else if (
      process.env.NODE_ENV !== "production" &&
      DEMO_EMAILS.has(normalizedEmail)
    ) {
      await ensureDemoAccounts();
      user = await loadUser();
      if (user) {
        ok = await verifyPassword(DEMO_PASSWORD, user.passwordHash);
      }
    }
  }

  if (!ok || !user) {
    console.warn(`[auth/login] Invalid password for ${normalizedEmail}`);
    return sendError(res, 401, "UNAUTHORIZED", "Invalid password");
  }

  /**
   * Admin portal (`expectedRole: ADMIN`) accepts all specialized admin roles.
   * Dedicated expectedRole values also allowed.
   */
  if (expectedRole) {
    const adminPortalRoles = new Set([
      "ADMIN",
      "DEPARTMENT_ADMIN",
      "EXAM_ADMIN",
      "CERTIFICATE_ADMIN",
    ]);
    const adminPortalLogin =
      expectedRole === "ADMIN" && adminPortalRoles.has(user.role);
    const exactRoleLogin = user.role === expectedRole;
    if (!adminPortalLogin && !exactRoleLogin) {
      console.warn(
        `[auth/login] Role mismatch: user=${user.role} expected=${expectedRole}`
      );
      return sendError(
        res,
        403,
        "FORBIDDEN",
        `This login portal is for ${expectedRole.toLowerCase()} accounts only`
      );
    }
  }

  console.log(
    `[auth/login] Success email=${normalizedEmail} role=${user.role}`
  );

  let token: string;
  try {
    token = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
  } catch (tokenErr) {
    console.error("[auth/login] JWT sign error:", tokenErr);
    if (tokenErr instanceof Error && tokenErr.stack) {
      console.error(tokenErr.stack);
    }
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Server authentication is misconfigured (JWT_SECRET)."
    );
  }

  const profile =
    user.role === "STUDENT"
      ? user.student
      : user.role === "TEACHER"
        ? user.teacher
        : user.admin;

  return res.json({
    token,
    user: {
      ...toSafeAuthUser({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        profile,
      }),
      departmentId: user.departmentScope?.departmentId ?? null,
      department: user.departmentScope?.department ?? null,
    },
  });
});

/**
 * Stateless JWT logout — client must discard the token.
 * Endpoint exists for contract consistency and future denylist hooks.
 */
authRouter.post("/logout", requireAuth, async (_req, res) => {
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      // passwordHash intentionally omitted
      student: { include: { faculty: true, department: true } },
      teacher: { include: { department: true } },
      admin: true,
      departmentScope: {
        select: {
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!user) {
    return sendError(res, 404, "NOT_FOUND", "User not found");
  }

  if (user.status !== "ACTIVE") {
    return sendError(
      res,
      401,
      "UNAUTHORIZED",
      "Account is inactive or suspended"
    );
  }

  const profile =
    user.role === "STUDENT"
      ? user.student
      : user.role === "TEACHER"
        ? user.teacher
        : user.admin;

  return res.json({
    ...toSafeAuthUser({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      profile,
    }),
    departmentId: user.departmentScope?.departmentId ?? null,
    department: user.departmentScope?.department ?? null,
  });
});

/** Dev helper — disabled unless ALLOW_DEV_ADMIN_REGISTER=true and not production */
authRouter.post("/register-admin", async (req, res) => {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEV_ADMIN_REGISTER !== "true"
  ) {
    return sendError(res, 404, "NOT_FOUND", "Not found");
  }

  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "BAD_REQUEST", "Invalid registration payload");
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return sendError(res, 409, "CONFLICT", "Email already registered");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      admin: {
        create: {
          fullName: parsed.data.fullName,
          email,
        },
      },
    },
  });

  return res.status(201).json({
    id: user.id,
    email: user.email,
    role: user.role,
  });
});
