import type { AssignmentStatus } from "@prisma/client";

import { formatSchedule } from "./serializeClass.js";

export function uiAssignmentStatus(
  status: AssignmentStatus
): "Draft" | "Published" | "Archived" {
  if (status === "DRAFT") return "Draft";
  if (status === "PUBLISHED") return "Published";
  return "Archived";
}

export const assignmentInclude = {
  materials: {
    select: {
      id: true,
      fileName: true,
      fileSize: true,
    },
    orderBy: { id: "asc" as const },
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
        },
      },
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      facultyCode: true,
      email: true,
    },
  },
} as const;

export type AssignmentWithRelations = {
  id: string;
  classSectionId: string;
  teacherId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueAt: Date;
  maxMarks: number;
  maxFileMb: number;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
  materials?: Array<{
    id: string;
    fileName: string;
    fileSize: number;
  }>;
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
    };
  };
  teacher: {
    id: string;
    fullName: string;
    facultyCode: string;
    email: string;
  };
};

export function serializeAssignment(row: AssignmentWithRelations) {
  const cls = row.classSection;
  const course = cls.course;

  const materials = (row.materials ?? []).map((m) => ({
    id: m.id,
    fileName: m.fileName,
    fileSize: m.fileSize,
    attachmentUrl: `/api/assignments/materials/${m.id}/file`,
  }));
  const primaryMaterial = materials[0] ?? null;

  return {
    id: row.id,
    classSectionId: row.classSectionId,
    teacherId: row.teacherId,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    dueAt: row.dueAt.toISOString(),
    maxMarks: row.maxMarks,
    maxFileMb: row.maxFileMb,
    status: uiAssignmentStatus(row.status),
    accountStatus: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    materials,
    attachmentUrl: primaryMaterial?.attachmentUrl ?? null,
    instructionMaterial: primaryMaterial,
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
      id: row.teacher.id,
      name: row.teacher.fullName,
      fullName: row.teacher.fullName,
      facultyCode: row.teacher.facultyCode,
      email: row.teacher.email,
    },
    courseCode: course.code,
    courseTitle: course.title,
    section: cls.section,
    teacherName: row.teacher.fullName,
    academicYear: cls.academicYear,
    semester: cls.semester,
  };
}
