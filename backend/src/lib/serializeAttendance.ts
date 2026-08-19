import type {
  AttendanceStatus,
  ClassSessionStatus,
} from "@prisma/client";

import { calcAttendancePercentage } from "./attendanceCalc.js";

export function uiSessionStatus(status: ClassSessionStatus): string {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "OPEN":
      return "Open";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function deriveTeacherSessionStatus(session: {
  status: ClassSessionStatus;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  teacherAttendance: {
    startedAt: Date;
    endedAt: Date | null;
    status?: string | null;
  } | null;
}): string {
  if (session.status === "CANCELLED") return "CANCELLED";
  const taStatus = session.teacherAttendance?.status;
  if (taStatus === "EARLY_EXIT") return "EARLY_EXIT";
  if (taStatus === "COMPLETED") return "COMPLETED";
  if (taStatus === "ACTIVE") return "ACTIVE";
  if (session.actualEndTime || session.teacherAttendance?.endedAt) {
    return "COMPLETED";
  }
  if (session.actualStartTime || session.teacherAttendance?.startedAt) {
    return "ACTIVE";
  }
  if (session.status === "SCHEDULED" || session.status === "OPEN") {
    return "NOT_STARTED";
  }
  return session.status;
}

const sectionSelect = {
  id: true,
  section: true,
  academicYear: true,
  semester: true,
  room: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  teacherId: true,
  course: {
    select: {
      id: true,
      code: true,
      title: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          faculty: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
  teacher: {
    select: { id: true, fullName: true, facultyCode: true },
  },
} as const;

export const sessionInclude = {
  classSection: { select: sectionSelect },
  teacherAttendance: true,
  _count: { select: { studentAttendance: true } },
} as const;

export function serializeSession(
  row: {
    id: string;
    classSectionId: string;
    date: Date;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    actualStartTime: Date | null;
    actualEndTime: Date | null;
    status: ClassSessionStatus;
    topic: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    classSection?: {
      id: string;
      section: string;
      academicYear: string;
      semester: string;
      room: string | null;
      dayOfWeek: string | null;
      startTime: string | null;
      endTime: string | null;
      teacherId: string;
      course: {
        id: string;
        code: string;
        title: string;
        department?: {
          id: string;
          name: string;
          code: string;
          faculty?: { id: string; name: string; code: string } | null;
        } | null;
      };
      teacher: { id: string; fullName: string; facultyCode: string };
    };
    teacherAttendance?: {
      id: string;
      teacherId: string;
      startedAt: Date;
      endedAt: Date | null;
      requiredMinutes?: number;
      expectedCheckOutAt?: Date | null;
      completedMinutes?: number | null;
      status?: string;
      locationVerified?: boolean;
      classSectionId?: string | null;
    } | null;
    _count?: { studentAttendance: number };
  }
) {
  const cs = row.classSection;
  const ta = row.teacherAttendance ?? null;
  return {
    id: row.id,
    classSectionId: row.classSectionId,
    date: row.date.toISOString().slice(0, 10),
    scheduledStartTime: row.scheduledStartTime,
    scheduledEndTime: row.scheduledEndTime,
    actualStartTime: row.actualStartTime?.toISOString() ?? null,
    actualEndTime: row.actualEndTime?.toISOString() ?? null,
    status: uiSessionStatus(row.status),
    accountStatus: row.status,
    teacherAttendanceStatus: deriveTeacherSessionStatus({
      status: row.status,
      actualStartTime: row.actualStartTime,
      actualEndTime: row.actualEndTime,
      teacherAttendance: ta,
    }),
    topic: row.topic,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    markedCount: row._count?.studentAttendance ?? 0,
    teacherAttendance: ta
      ? {
          id: ta.id,
          teacherId: ta.teacherId,
          classSectionId: ta.classSectionId ?? row.classSectionId,
          checkInTime: ta.startedAt.toISOString(),
          checkOutTime: ta.endedAt?.toISOString() ?? null,
          startedAt: ta.startedAt.toISOString(),
          endedAt: ta.endedAt?.toISOString() ?? null,
          requiredMinutes: ta.requiredMinutes ?? 120,
          expectedCheckOutAt: ta.expectedCheckOutAt?.toISOString() ?? null,
          completedMinutes: ta.completedMinutes ?? null,
          status: ta.status ?? "ACTIVE",
          locationVerified: ta.locationVerified ?? false,
        }
      : null,
    ...(cs
      ? {
          classSection: {
            id: cs.id,
            section: cs.section,
            academicYear: cs.academicYear,
            semester: cs.semester,
            room: cs.room,
            dayOfWeek: cs.dayOfWeek,
            startTime: cs.startTime,
            endTime: cs.endTime,
          },
          course: cs.course,
          courseCode: cs.course.code,
          courseTitle: cs.course.title,
          section: cs.section,
          room: cs.room,
          teacher: {
            id: cs.teacher.id,
            name: cs.teacher.fullName,
            fullName: cs.teacher.fullName,
            facultyCode: cs.teacher.facultyCode,
          },
          teacherName: cs.teacher.fullName,
          academicYear: cs.academicYear,
          semester: cs.semester,
          faculty: cs.course.department?.faculty ?? null,
          department: cs.course.department
            ? {
                id: cs.course.department.id,
                name: cs.course.department.name,
                code: cs.course.department.code,
              }
            : null,
        }
      : {}),
  };
}

export function serializeStudentAttendanceRow(row: {
  studentId: string;
  studentCode: string;
  studentName: string;
  status: AttendanceStatus | "UNMARKED";
  markedAt: string | null;
  attendanceId: string | null;
}) {
  return row;
}

export function serializeStudentClassSummary(input: {
  classSectionId: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  academicYear: string;
  semester: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  totalMarked: number;
  totalSessions: number;
  /** Admin System Setting — minimum acceptable attendance %. */
  minAttendanceThreshold?: number;
}) {
  const { minAttendanceThreshold, ...rest } = input;
  const percentage = calcAttendancePercentage({
    present: input.present,
    late: input.late,
    absent: input.absent,
    excused: input.excused,
  });
  const threshold =
    typeof minAttendanceThreshold === "number"
      ? minAttendanceThreshold
      : 75;
  const meetsThreshold =
    percentage == null ? null : percentage >= threshold;
  return {
    ...rest,
    percentage,
    status: percentage == null ? "—" : `${percentage}%`,
    minAttendanceThreshold: threshold,
    meetsThreshold,
    belowThreshold: meetsThreshold === false,
  };
}
