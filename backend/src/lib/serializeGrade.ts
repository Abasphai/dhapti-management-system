import type { GradeStatus } from "@prisma/client";

export function uiGradeStatus(status: GradeStatus): string {
  switch (status) {
    case "NOT_GRADED":
      return "Not Graded";
    case "GRADED":
      return "Graded";
    case "PENDING_APPROVAL":
      return "Pending Approval";
    case "APPROVED":
      return "Approved";
    case "RETURNED":
      return "Returned";
    default:
      return status;
  }
}

export function calcPercentage(
  score: number | null | undefined,
  maxMarks: number
): number | null {
  if (score == null || !Number.isFinite(score) || maxMarks <= 0) return null;
  return Math.round((score / maxMarks) * 10000) / 100;
}

type GradeFields = {
  id: string;
  assignmentId: string;
  studentId: string;
  score: number | null;
  feedback: string | null;
  gradeStatus: GradeStatus;
  gradedAt: Date | null;
  gradedById: string | null;
  submittedForApprovalAt: Date | null;
  approvedAt: Date | null;
  approvedById: string | null;
  returnedAt: Date | null;
  returnedById: string | null;
  returnReason: string | null;
  submittedAt: Date;
  updatedAt: Date;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  status?: string;
};

/** Teacher/Admin: full grade fields. */
export function serializeGrade(
  row: GradeFields & {
    student?: {
      id: string;
      studentCode: string;
      fullName: string;
    };
    assignment?: {
      id: string;
      title: string;
      maxMarks: number;
      dueAt?: Date;
      classSection?: {
        id: string;
        section: string;
        academicYear: string;
        semester: string;
        teacher?: { id: string; fullName: string; facultyCode?: string };
        course?: {
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
      };
    };
    gradedBy?: { id: string; fullName: string } | null;
    approvedBy?: { id: string; fullName: string } | null;
    returnedBy?: { id: string; fullName: string } | null;
  }
) {
  const maxMarks = row.assignment?.maxMarks ?? 0;
  const percentage = calcPercentage(row.score, maxMarks);
  const cs = row.assignment?.classSection;
  const course = cs?.course;
  const teacher = cs?.teacher;
  const dept = course?.department;
  const faculty = dept?.faculty;

  return {
    id: row.id,
    submissionId: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    score: row.score,
    feedback: row.feedback,
    maxMarks,
    percentage,
    gradeStatus: row.gradeStatus,
    status: uiGradeStatus(row.gradeStatus),
    accountStatus: row.gradeStatus,
    gradedAt: row.gradedAt?.toISOString() ?? null,
    submittedForApprovalAt: row.submittedForApprovalAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    returnedAt: row.returnedAt?.toISOString() ?? null,
    returnReason: row.returnReason,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    fileName: row.fileName ?? null,
    ...(row.student
      ? {
          student: {
            id: row.student.id,
            studentCode: row.student.studentCode,
            name: row.student.fullName,
            fullName: row.student.fullName,
          },
          studentCode: row.student.studentCode,
          studentName: row.student.fullName,
        }
      : {}),
    ...(row.assignment
      ? {
          assignment: {
            id: row.assignment.id,
            title: row.assignment.title,
            maxMarks: row.assignment.maxMarks,
          },
          assignmentTitle: row.assignment.title,
        }
      : {}),
    ...(course
      ? {
          course: {
            id: course.id,
            code: course.code,
            title: course.title,
          },
          courseCode: course.code,
          courseTitle: course.title,
        }
      : {}),
    ...(cs
      ? {
          classSection: {
            id: cs.id,
            section: cs.section,
            academicYear: cs.academicYear,
            semester: cs.semester,
          },
          section: cs.section,
          academicYear: cs.academicYear,
          semester: cs.semester,
        }
      : {}),
    ...(teacher
      ? {
          teacher: {
            id: teacher.id,
            name: teacher.fullName,
            fullName: teacher.fullName,
            facultyCode: teacher.facultyCode ?? null,
          },
          teacherName: teacher.fullName,
        }
      : {}),
    ...(faculty
      ? {
          faculty: {
            id: faculty.id,
            name: faculty.name,
            code: faculty.code,
          },
        }
      : {}),
    ...(dept
      ? {
          department: {
            id: dept.id,
            name: dept.name,
            code: dept.code,
          },
        }
      : {}),
    gradedBy: row.gradedBy
      ? { id: row.gradedBy.id, name: row.gradedBy.fullName, fullName: row.gradedBy.fullName }
      : null,
    approvedBy: row.approvedBy
      ? {
          id: row.approvedBy.id,
          name: row.approvedBy.fullName,
          fullName: row.approvedBy.fullName,
        }
      : null,
    returnedBy: row.returnedBy
      ? {
          id: row.returnedBy.id,
          name: row.returnedBy.fullName,
          fullName: row.returnedBy.fullName,
        }
      : null,
  };
}

/** Student-visible result — APPROVED grades only; no admin internals. */
export function serializeStudentResult(
  row: GradeFields & {
    assignment: {
      id: string;
      title: string;
      maxMarks: number;
      classSection: {
        section: string;
        academicYear: string;
        semester: string;
        teacher: { fullName: string };
        course: { code: string; title: string };
      };
    };
  }
) {
  const maxMarks = row.assignment.maxMarks;
  const percentage = calcPercentage(row.score, maxMarks);
  const cs = row.assignment.classSection;
  return {
    id: row.id,
    assessmentType: "ASSIGNMENT",
    assessmentTitle: row.assignment.title,
    assignmentId: row.assignmentId,
    courseCode: cs.course.code,
    courseTitle: cs.course.title,
    section: cs.section,
    teacherName: cs.teacher.fullName,
    score: row.score,
    maxMarks,
    percentage,
    feedback: row.feedback,
    status: "Approved",
    gradeStatus: "APPROVED" as const,
    academicYear: cs.academicYear,
    semester: cs.semester,
    gradedAt: row.gradedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}
