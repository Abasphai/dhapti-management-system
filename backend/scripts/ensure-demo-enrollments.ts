/**
 * Non-destructive: ensure demo ClassSections + enrollments for seeded student.
 * Does not wipe existing academic data.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { email: "mohamudcade143@gmail.com" },
  });
  if (!student) {
    console.log("Demo student not found; skip.");
    return;
  }

  const teacher = await prisma.teacher.findFirst({
    where: { email: "mohamed.ali@dhapti.edu.so" },
  });
  if (!teacher) {
    console.log("Demo teacher not found; skip.");
    return;
  }

  const courses = await prisma.course.findMany({
    where: { code: { in: ["CS101", "CS301", "CS305", "CS401", "CS312"] } },
  });
  if (courses.length === 0) {
    console.log("No demo courses found; skip.");
    return;
  }

  // Prefer the three courses shown on My Courses for Prof. Mohamed.
  const preferred = ["CS101", "CS301", "CS305"];
  const ordered = [
    ...preferred
      .map((code) => courses.find((c) => c.code === code))
      .filter((c): c is (typeof courses)[number] => !!c),
    ...courses.filter((c) => !preferred.includes(c.code)),
  ].slice(0, 3);

  let createdClasses = 0;
  let createdEnrollments = 0;

  for (const course of ordered) {
    const link = await prisma.courseTeacher.findUnique({
      where: {
        courseId_teacherId: { courseId: course.id, teacherId: teacher.id },
      },
    });
    if (!link) {
      await prisma.courseTeacher.create({
        data: { courseId: course.id, teacherId: teacher.id },
      });
    }

    let cls = await prisma.classSection.findFirst({
      where: {
        courseId: course.id,
        teacherId: teacher.id,
        status: "ACTIVE",
      },
    });
    if (!cls) {
      cls = await prisma.classSection.create({
        data: {
          courseId: course.id,
          teacherId: teacher.id,
          section: "A",
          academicYear: "2025/2026",
          semester: course.semester || "Semester 1",
          room: "Lab 1",
          dayOfWeek: "Mon / Wed",
          startTime: "08:00",
          endTime: "10:00",
          status: "ACTIVE",
        },
      });
      createdClasses += 1;
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_classSectionId: {
          studentId: student.id,
          classSectionId: cls.id,
        },
      },
    });
    if (!existing) {
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId: cls.id,
          status: "ACTIVE",
        },
      });
      createdEnrollments += 1;
    }
  }

  console.log({ createdClasses, createdEnrollments });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
