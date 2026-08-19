import { prisma } from "./prisma.js";

/**
 * Ensure every ACTIVE department has a default MAIN attendance location.
 * Idempotent — safe for seed, boot, and admin bootstrap.
 */
export async function ensureDefaultAttendanceLocations() {
  const departments = await prisma.department.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
  });

  let created = 0;
  for (const dept of departments) {
    const existing = await prisma.attendanceLocation.findUnique({
      where: {
        departmentId_code: { departmentId: dept.id, code: "MAIN" },
      },
    });
    if (existing) continue;
    await prisma.attendanceLocation.create({
      data: {
        departmentId: dept.id,
        name: `${dept.name} Faculty Attendance`,
        code: "MAIN",
        status: "ACTIVE",
      },
    });
    created += 1;
  }
  return { departments: departments.length, created };
}
