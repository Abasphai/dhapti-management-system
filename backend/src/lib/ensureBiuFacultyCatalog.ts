import { prisma } from "./prisma.js";
import { DHAPTI_FACULTY_DEPARTMENT_CATALOG } from "./biuFacultyCatalog.js";

/**
 * Idempotently ensure all 6 official Dhapti faculties + departments exist.
 * Safe to run against an already-seeded DB (upsert by code).
 */
export async function ensureBiuFacultyCatalog() {
  for (const faculty of DHAPTI_FACULTY_DEPARTMENT_CATALOG) {
    const existing = await prisma.faculty.findUnique({
      where: { code: faculty.code },
    });

    const facultyRow = existing
      ? await prisma.faculty.update({
          where: { code: faculty.code },
          data: {
            name: faculty.name,
            description: faculty.description,
            status: "ACTIVE",
          },
        })
      : await prisma.faculty.create({
          data: {
            name: faculty.name,
            code: faculty.code,
            description: faculty.description,
            status: "ACTIVE",
          },
        });

    for (const dept of faculty.departments) {
      const existingDept = await prisma.department.findFirst({
        where: { code: dept.code, facultyId: facultyRow.id },
      });
      if (existingDept) {
        await prisma.department.update({
          where: { id: existingDept.id },
          data: { name: dept.name, status: "ACTIVE" },
        });
      } else {
        await prisma.department.create({
          data: {
            name: dept.name,
            code: dept.code,
            facultyId: facultyRow.id,
            status: "ACTIVE",
          },
        });
      }
    }
  }

  return prisma.faculty.findMany({
    where: {
      code: { in: DHAPTI_FACULTY_DEPARTMENT_CATALOG.map((f) => f.code) },
    },
    include: { departments: true },
    orderBy: { code: "asc" },
  });
}
