/**
 * Ensures demo DEPARTMENT_ADMIN account exists (idempotent).
 * Run: npx tsx scripts/ensure-dept-admin.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "dept.cs@dhapti.edu.so";
  const csDept =
    (await prisma.department.findFirst({ where: { code: "CS" } })) ??
    (await prisma.department.findFirst());
  if (!csDept) {
    throw new Error("No department found — run full seed first");
  }

  const passwordHash = await bcrypt.hash("DHAPTI@2026", 12);
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { departmentScope: true, admin: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "DEPARTMENT_ADMIN",
        status: "ACTIVE",
        admin: {
          create: {
            fullName: "CS Department Admin",
            email,
          },
        },
        departmentScope: {
          create: { departmentId: csDept.id },
        },
      },
    });
    console.log("Created DEPARTMENT_ADMIN:", email, "→", csDept.code);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      role: "DEPARTMENT_ADMIN",
      status: "ACTIVE",
      passwordHash,
    },
  });

  if (!existing.admin) {
    await prisma.admin.create({
      data: {
        userId: existing.id,
        fullName: "CS Department Admin",
        email,
      },
    });
  }

  if (!existing.departmentScope) {
    await prisma.userDepartmentScope.create({
      data: { userId: existing.id, departmentId: csDept.id },
    });
  } else if (existing.departmentScope.departmentId !== csDept.id) {
    await prisma.userDepartmentScope.update({
      where: { userId: existing.id },
      data: { departmentId: csDept.id },
    });
  }

  console.log("Updated DEPARTMENT_ADMIN:", email, "→", csDept.code);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
