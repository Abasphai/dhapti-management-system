import bcrypt from "bcryptjs";

import { prisma } from "./prisma.js";

export const MASTER_ADMIN_EMAIL = "admin@dhapti.edu.so";
export const MASTER_ADMIN_PASSWORD = "DHAPTI@2026";
export const LEGACY_MASTER_PASSWORD = "BIU@2026";

/**
 * Ensure the master admin account exists with a known-good password hash.
 * Safe to call in production — only touches admin@dhapti.edu.so.
 * Idempotent.
 */
export async function ensureMasterAdmin(): Promise<{
  created: boolean;
  repaired: boolean;
  email: string;
}> {
  const email = MASTER_ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(MASTER_ADMIN_PASSWORD, 12);

  let user = await prisma.user.findUnique({
    where: { email },
    include: { admin: true },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        admin: {
          create: {
            fullName: "Master Administrator",
            email,
          },
        },
      },
    });
    console.log(`[auth] Created master admin ${email}`);
    return { created: true, repaired: false, email };
  }

  let passwordOk = false;
  try {
    passwordOk = await bcrypt.compare(MASTER_ADMIN_PASSWORD, user.passwordHash);
  } catch {
    passwordOk = false;
  }

  const needsRepair =
    user.role !== "ADMIN" ||
    user.status !== "ACTIVE" ||
    !user.passwordHash?.trim() ||
    !passwordOk;

  if (needsRepair) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash,
      },
    });
    console.log(`[auth] Repaired master admin ${email} (role/status/password)`);
  }

  if (!user.admin) {
    await prisma.admin.create({
      data: {
        userId: user.id,
        fullName: "Master Administrator",
        email,
      },
    });
    console.log(`[auth] Attached Admin profile → ${email}`);
  }

  return { created: false, repaired: needsRepair, email };
}

/** True if the submitted password is the master/demo password (current or legacy). */
export function isMasterAdminPassword(password: string): boolean {
  return (
    password === MASTER_ADMIN_PASSWORD || password === LEGACY_MASTER_PASSWORD
  );
}
