import type { EnrollmentStatus } from "@prisma/client";

import { formatSchedule } from "./serializeClass.js";

export function uiEnrollmentStatus(
  status: EnrollmentStatus
): "Active" | "Completed" | "Dropped" {
  if (status === "ACTIVE") return "Active";
  if (status === "COMPLETED") return "Completed";
  return "Dropped";
}

export const enrollmentInclude = {
  student: {
    select: {
      id: true,
      studentCode: true,
      fullName: true,
      email: true,
      program: true,
      semester: true,
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
      user: { select: { status: true } },
    },
  },
  classSection: {
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          credits: true,
          status: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              faculty: { select: { id: true, name: true, code: true } },
            },
          },
          faculty: { select: { id: true, name: true, code: true } },
        },
      },
      teacher: {
        select: {
          id: true,
          fullName: true,
          facultyCode: true,
          email: true,
          designation: true,
        },
      },
    },
  },
} as const;

export function serializeEnrollment(row: {
  id: string;
  studentId: string;
  classSectionId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    email: string;
    program: string | null;
    semester?: string | null;
    faculty: { id: string; name: string; code: string } | null;
    department: { id: string; name: string; code: string } | null;
    user: { status: string };
  };
  classSection: {
    id: string;
    section: string;
    academicYear: string;
    semester: string;
    room: string | null;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    status: string;
    course: {
      id: string;
      code: string;
      title: string;
      credits: number;
      status: string;
      department: {
        id: string;
        name: string;
        code: string;
        faculty: { id: string; name: string; code: string };
      } | null;
      faculty: { id: string; name: string; code: string } | null;
    };
    teacher: {
      id: string;
      fullName: string;
      facultyCode: string;
      email: string;
      designation: string | null;
    };
  };
}) {
  const cls = row.classSection;
  const course = cls.course;
  const faculty = course.faculty ?? course.department?.faculty ?? null;
  const department = course.department;

  return {
    id: row.id,
    studentId: row.studentId,
    classSectionId: row.classSectionId,
    status: uiEnrollmentStatus(row.status),
    accountStatus: row.status,
    enrolledAt: row.enrolledAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    student: {
      id: row.student.id,
      studentCode: row.student.studentCode,
      name: row.student.fullName,
      fullName: row.student.fullName,
      email: row.student.email,
      program: row.student.program,
      faculty: row.student.faculty?.name ?? null,
      department: row.student.department?.name ?? null,
    },
    classSection: {
      id: cls.id,
      section: cls.section,
      academicYear: cls.academicYear,
      semester: cls.semester,
      room: cls.room,
      dayOfWeek: cls.dayOfWeek,
      startTime: cls.startTime,
      endTime: cls.endTime,
      schedule: formatSchedule(cls.dayOfWeek, cls.startTime, cls.endTime),
      status: cls.status,
    },
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      credits: course.credits,
    },
    teacher: {
      id: cls.teacher.id,
      name: cls.teacher.fullName,
      fullName: cls.teacher.fullName,
      facultyCode: cls.teacher.facultyCode,
      email: cls.teacher.email,
      designation: cls.teacher.designation,
    },
    department: department
      ? { id: department.id, name: department.name, code: department.code }
      : null,
    faculty: faculty
      ? { id: faculty.id, name: faculty.name, code: faculty.code }
      : null,
    // Flat helpers for tables / student cards
    courseCode: course.code,
    courseTitle: course.title,
    section: cls.section,
    teacherName: cls.teacher.fullName,
    studentCode: row.student.studentCode,
    studentName: row.student.fullName,
    academicYear: cls.academicYear,
    semester: cls.semester,
    room: cls.room,
    schedule: formatSchedule(cls.dayOfWeek, cls.startTime, cls.endTime),
  };
}
