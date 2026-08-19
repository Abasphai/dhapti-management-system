import type { AcademicStatus } from "@prisma/client";

function uiStatus(status: AcademicStatus): "Active" | "Inactive" | "Suspended" {
  if (status === "ACTIVE") return "Active";
  if (status === "SUSPENDED") return "Suspended";
  return "Inactive";
}

export function formatSchedule(
  dayOfWeek: string | null,
  startTime: string | null,
  endTime: string | null
): string | null {
  if (!dayOfWeek && !startTime && !endTime) return null;
  if (dayOfWeek && startTime && endTime) {
    return `${dayOfWeek} ${startTime}–${endTime}`;
  }
  if (dayOfWeek && startTime) return `${dayOfWeek} ${startTime}`;
  return dayOfWeek ?? startTime ?? endTime;
}

export const classSectionInclude = {
  course: {
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      departmentId: true,
      facultyId: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          facultyId: true,
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
      department: { select: { id: true, name: true, code: true } },
      user: { select: { status: true } },
    },
  },
} as const;

export function serializeClassSection(row: {
  id: string;
  courseId: string;
  teacherId: string;
  section: string;
  academicYear: string;
  semester: string;
  room: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  status: AcademicStatus;
  createdAt: Date;
  updatedAt: Date;
  course: {
    id: string;
    code: string;
    title: string;
    status: AcademicStatus;
    departmentId: string;
    facultyId: string | null;
    department: {
      id: string;
      name: string;
      code: string;
      facultyId: string;
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
    department: { id: string; name: string; code: string } | null;
    user: { status: string };
  };
}) {
  const faculty =
    row.course.faculty ?? row.course.department?.faculty ?? null;
  const department = row.course.department;

  return {
    id: row.id,
    courseId: row.courseId,
    teacherId: row.teacherId,
    section: row.section,
    academicYear: row.academicYear,
    semester: row.semester,
    room: row.room,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    schedule: formatSchedule(row.dayOfWeek, row.startTime, row.endTime),
    status: uiStatus(row.status),
    accountStatus: row.status,
    courseCode: row.course.code,
    courseTitle: row.course.title,
    course: {
      id: row.course.id,
      code: row.course.code,
      title: row.course.title,
      status: uiStatus(row.course.status),
    },
    teacher: {
      id: row.teacher.id,
      name: row.teacher.fullName,
      fullName: row.teacher.fullName,
      facultyCode: row.teacher.facultyCode,
      email: row.teacher.email,
      designation: row.teacher.designation,
    },
    teacherName: row.teacher.fullName,
    department: department?.name ?? null,
    departmentId: department?.id ?? row.course.departmentId,
    faculty: faculty?.name ?? null,
    facultyId: faculty?.id ?? row.course.facultyId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
