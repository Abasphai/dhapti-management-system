import type { AcademicStatus, UserStatus } from "@prisma/client";

import { prisma } from "./prisma.js";

export const assignedCourseInclude = {
  course: {
    select: {
      id: true,
      code: true,
      title: true,
      credits: true,
      semester: true,
      status: true,
      departmentId: true,
      facultyId: true,
      department: { select: { id: true, name: true, code: true } },
      faculty: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

export function serializeAssignedCourse(row: {
  id: string;
  createdAt: Date;
  course: {
    id: string;
    code: string;
    title: string;
    credits: number;
    semester: string | null;
    status: AcademicStatus;
    departmentId: string;
    facultyId: string | null;
    department: { id: string; name: string; code: string } | null;
    faculty: { id: string; name: string; code: string } | null;
  };
}) {
  const status =
    row.course.status === "ACTIVE"
      ? "Active"
      : row.course.status === "SUSPENDED"
        ? "Suspended"
        : "Inactive";

  return {
    assignmentId: row.id,
    id: row.course.id,
    courseId: row.course.id,
    code: row.course.code,
    title: row.course.title,
    name: row.course.title,
    credits: row.course.credits,
    semester: row.course.semester,
    status,
    accountStatus: row.course.status,
    department: row.course.department?.name ?? null,
    departmentId: row.course.departmentId,
    faculty: row.course.faculty?.name ?? null,
    facultyId: row.course.facultyId,
    assignedAt: row.createdAt.toISOString(),
  };
}

export type AssignmentValidationError = {
  status: number;
  code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT";
  message: string;
};

/**
 * Cross-department teaching is allowed (Teacher.departmentId is optional;
 * schema does not require Teacher.departmentId === Course.departmentId).
 * See ADR-005.
 */
export async function validateTeacherCourseAssignment(
  teacherId: string,
  courseId: string
): Promise<
  | { ok: true; teacherUserStatus: UserStatus }
  | { ok: false; error: AssignmentValidationError }
> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { status: true } } },
  });
  if (!teacher) {
    return {
      ok: false,
      error: { status: 404, code: "NOT_FOUND", message: "Teacher not found" },
    };
  }
  if (teacher.user.status !== "ACTIVE") {
    return {
      ok: false,
      error: {
        status: 400,
        code: "BAD_REQUEST",
        message: "Only ACTIVE teachers can receive course assignments",
      },
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { department: { select: { id: true } } },
  });
  if (!course) {
    return {
      ok: false,
      error: { status: 404, code: "NOT_FOUND", message: "Course not found" },
    };
  }
  if (course.status !== "ACTIVE") {
    return {
      ok: false,
      error: {
        status: 400,
        code: "BAD_REQUEST",
        message: "Only ACTIVE courses can be assigned",
      },
    };
  }
  if (!course.department) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "BAD_REQUEST",
        message: "Course must belong to a valid department",
      },
    };
  }

  const existing = await prisma.courseTeacher.findUnique({
    where: {
      courseId_teacherId: { courseId, teacherId },
    },
  });
  if (existing) {
    return {
      ok: false,
      error: {
        status: 409,
        code: "CONFLICT",
        message: "Course is already assigned to this teacher",
      },
    };
  }

  return { ok: true, teacherUserStatus: teacher.user.status };
}
