/**
 * One-shot repair: create missing ClassSections for every CourseTeacher link.
 * Usage: npx tsx scripts/sync-teacher-class-sections.ts
 */
import "dotenv/config";

import { ensureTeacherClassSections } from "../src/lib/ensureTeacherClassSections.js";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const teachers = await prisma.teacher.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      courseTeachers: { select: { courseId: true } },
    },
  });

  let totalCreated = 0;
  for (const t of teachers) {
    if (t.courseTeachers.length === 0) continue;
    const before = await prisma.classSection.count({
      where: { teacherId: t.id, status: "ACTIVE" },
    });
    const created = await ensureTeacherClassSections(t.id);
    const after = await prisma.classSection.count({
      where: { teacherId: t.id, status: "ACTIVE" },
    });
    if (created > 0) {
      console.log(
        `✓ ${t.fullName} <${t.email}>: created ${created} section(s) (${before} → ${after})`
      );
    }
    totalCreated += created;
  }

  console.log(
    totalCreated
      ? `Done. Created ${totalCreated} ClassSection(s).`
      : "Done. All assigned courses already have ClassSections."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
