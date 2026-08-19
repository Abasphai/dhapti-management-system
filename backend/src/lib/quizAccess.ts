import { prisma } from "./prisma.js";

export async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

export async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

export async function resolveAdmin(userId: string) {
  return prisma.admin.findUnique({
    where: { userId },
    select: { id: true },
  });
}

export async function validateTeacherOwnsClass(
  teacherId: string,
  classSectionId: string
) {
  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    include: {
      course: { select: { id: true, status: true } },
      teacher: { include: { user: { select: { status: true } } } },
    },
  });
  if (!classSection) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Class section not found",
    };
  }
  if (classSection.teacherId !== teacherId) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "Not allowed",
    };
  }
  if (classSection.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE class sections accept quizzes",
    };
  }
  if (classSection.course.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Course is not active",
    };
  }
  return { ok: true as const, classSection };
}

export async function assertStudentEnrolled(
  studentId: string,
  classSectionId: string
) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      classSectionId,
      status: "ACTIVE",
    },
  });
  if (!enrollment) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "You are not enrolled in this class",
    };
  }
  return { ok: true as const };
}

export function quizAvailableNow(
  quiz: {
    status: string;
    availableFrom: Date | null;
    availableUntil: Date | null;
  },
  now = new Date()
) {
  if (quiz.status !== "PUBLISHED") return false;
  if (quiz.availableFrom && now < quiz.availableFrom) return false;
  if (quiz.availableUntil && now > quiz.availableUntil) return false;
  return true;
}

export async function recalculateQuizTotalMarks(quizId: string) {
  const agg = await prisma.quizQuestion.aggregate({
    where: { quizId },
    _sum: { marks: true },
  });
  const total = agg._sum.marks ?? 0;
  await prisma.quiz.update({
    where: { id: quizId },
    data: { totalMarks: total },
  });
  return total;
}
