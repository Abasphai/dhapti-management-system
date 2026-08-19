import type { GradeStatus, SubmissionStatus } from "@prisma/client";

import { calcPercentage, uiGradeStatus } from "./serializeGrade.js";

export function uiSubmissionStatus(
  status: SubmissionStatus
): "Submitted" | "Late" | "Graded" {
  if (status === "LATE") return "Late";
  if (status === "GRADED") return "Graded";
  return "Submitted";
}

export function serializeSubmission(
  row: {
    id: string;
    assignmentId: string;
    studentId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    studentNotes?: string | null;
    status: SubmissionStatus;
    score?: number | null;
    feedback?: string | null;
    gradeStatus?: GradeStatus | null;
    gradedAt?: Date | null;
    returnReason?: string | null;
    submittedAt: Date;
    updatedAt: Date;
    student?: {
      id: string;
      studentCode: string;
      fullName: string;
    };
  },
  options?: {
    /** When true, only expose score/feedback if APPROVED (student views). */
    studentView?: boolean;
    maxMarks?: number;
  }
) {
  const gradeStatus = row.gradeStatus ?? "NOT_GRADED";
  const showMarks =
    !options?.studentView || gradeStatus === "APPROVED";

  return {
    id: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    fileUrl: `/api/submissions/${row.id}/file`,
    studentNotes: row.studentNotes ?? null,
    status: uiSubmissionStatus(row.status),
    accountStatus: row.status,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    gradeStatus,
    gradeUiStatus: uiGradeStatus(gradeStatus),
    ...(showMarks
      ? {
          score: row.score ?? null,
          feedback: row.feedback ?? null,
          teacherFeedback: row.feedback ?? null,
          percentage: calcPercentage(row.score ?? null, options?.maxMarks ?? 0),
          gradedAt: row.gradedAt?.toISOString() ?? null,
          returnReason:
            options?.studentView ? null : (row.returnReason ?? null),
        }
      : {
          score: null,
          feedback: null,
          teacherFeedback: null,
          percentage: null,
          gradedAt: null,
          returnReason: null,
        }),
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
  };
}
