import { Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";
import { getSystemSettings } from "./settings.js";

const SECTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

/**
 * Ensure every ACTIVE CourseTeacher assignment has at least one ACTIVE ClassSection
 * for that teacher. Creates Section A (or next free letter) when missing.
 */
export async function ensureTeacherClassSections(teacherId: string): Promise<number> {
  const settings = await getSystemSettings();
  const assignments = await prisma.courseTeacher.findMany({
    where: {
      teacherId,
      course: { status: "ACTIVE" },
    },
    include: {
      course: { select: { id: true, semester: true } },
    },
  });

  if (assignments.length === 0) return 0;

  const existing = await prisma.classSection.findMany({
    where: { teacherId, status: "ACTIVE" },
    select: { courseId: true },
  });
  const covered = new Set(existing.map((row) => row.courseId));

  let created = 0;
  for (const assignment of assignments) {
    if (covered.has(assignment.courseId)) continue;

    const academicYear = settings.currentAcademicYear;
    const semester =
      assignment.course.semester?.trim() || settings.currentSemester;

    for (const section of SECTION_LETTERS) {
      try {
        await prisma.classSection.create({
          data: {
            courseId: assignment.courseId,
            teacherId,
            section,
            academicYear,
            semester,
            room: null,
            dayOfWeek: null,
            startTime: "08:00",
            endTime: "10:00",
            status: "ACTIVE",
          },
        });
        created += 1;
        covered.add(assignment.courseId);
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          // Unique (courseId, section, academicYear, semester) taken — try next letter.
          continue;
        }
        throw err;
      }
    }
  }

  return created;
}
