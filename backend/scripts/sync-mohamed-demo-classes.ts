/**
 * Align Prof. Mohamed Hassan Ali to CS101 / CS301 / CS305 with ACTIVE ClassSections.
 * Usage: npx tsx scripts/sync-mohamed-demo-classes.ts
 */
import "dotenv/config";

import { ensureTeacherClassSections } from "../src/lib/ensureTeacherClassSections.js";
import { prisma } from "../src/lib/prisma.js";

const TARGET_CODES = ["CS101", "CS301", "CS305"] as const;

async function main() {
  const teacher = await prisma.teacher.findFirst({
    where: { email: "mohamed.ali@dhapti.edu.so" },
  });
  if (!teacher) {
    console.log("Prof. Mohamed not found; skip.");
    return;
  }

  const courses = await prisma.course.findMany({
    where: { code: { in: [...TARGET_CODES] }, status: "ACTIVE" },
  });
  if (courses.length < TARGET_CODES.length) {
    console.log(
      "Missing courses:",
      TARGET_CODES.filter((c) => !courses.some((x) => x.code === c))
    );
  }

  const targetIds = new Set(courses.map((c) => c.id));

  // Exact demo set: CS101 / CS301 / CS305 only.
  await prisma.courseTeacher.deleteMany({
    where: {
      teacherId: teacher.id,
      courseId: { notIn: [...targetIds] },
    },
  });

  for (const course of courses) {
    await prisma.courseTeacher.upsert({
      where: {
        courseId_teacherId: {
          courseId: course.id,
          teacherId: teacher.id,
        },
      },
      create: { courseId: course.id, teacherId: teacher.id },
      update: {},
    });
  }

  const created = await ensureTeacherClassSections(teacher.id);

  // Ensure Section A rows with readable schedules for the three demo courses.
  for (const course of courses) {
    const existing = await prisma.classSection.findFirst({
      where: { courseId: course.id, teacherId: teacher.id, status: "ACTIVE" },
    });
    if (!existing) continue;
    const scheduleByCode: Record<
      string,
      { semester: string; room: string; dayOfWeek: string; start: string; end: string }
    > = {
      CS101: {
        semester: "Semester 1",
        room: "Lab 1",
        dayOfWeek: "Mon / Wed",
        start: "08:00",
        end: "10:00",
      },
      CS301: {
        semester: "Semester 3",
        room: "Lab 2",
        dayOfWeek: "Tue / Thu",
        start: "11:00",
        end: "13:00",
      },
      CS305: {
        semester: "Semester 3",
        room: "Room 4",
        dayOfWeek: "Wed / Fri",
        start: "14:00",
        end: "16:00",
      },
    };
    const s = scheduleByCode[course.code];
    if (!s) continue;
    await prisma.classSection.update({
      where: { id: existing.id },
      data: {
        academicYear: "2025/2026",
        semester: s.semester,
        room: s.room,
        dayOfWeek: s.dayOfWeek,
        startTime: s.start,
        endTime: s.end,
        status: "ACTIVE",
      },
    });
  }

  const classes = await prisma.classSection.findMany({
    where: { teacherId: teacher.id, status: "ACTIVE" },
    include: { course: { select: { code: true, title: true } } },
    orderBy: { course: { code: "asc" } },
  });

  console.log(
    `Mohamed sync complete (new sections created: ${created}). Active classes:`
  );
  for (const c of classes) {
    console.log(`  - ${c.course.code}-${c.section} ${c.course.title}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
