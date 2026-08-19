import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { effectiveAssignmentScoreCap } from "../lib/gradingPolicy.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  notifyGradeApproved,
  notifyTeacherGradeDecision,
} from "../lib/notifications.js";
import { getSystemSettings } from "../lib/settings.js";
import {
  serializeGrade,
  serializeStudentResult,
} from "../lib/serializeGrade.js";
import { serializeQuizResult } from "../lib/serializeQuiz.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const gradesRouter = Router();

gradesRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const gradeBodySchema = z
  .object({
    score: z.number().finite(),
    feedback: z.string().max(5000).optional().nullable(),
    teacherFeedback: z.string().max(5000).optional().nullable(),
  })
  .transform((data) => ({
    score: data.score,
    feedback: data.feedback ?? data.teacherFeedback ?? null,
  }));

const bulkGradeSchema = z.object({
  grades: z
    .array(
      z
        .object({
          submissionId: z.string().min(1),
          score: z.number().finite(),
          feedback: z.string().max(5000).optional().nullable(),
          teacherFeedback: z.string().max(5000).optional().nullable(),
        })
        .transform((item) => ({
          submissionId: item.submissionId,
          score: item.score,
          feedback: item.feedback ?? item.teacherFeedback ?? null,
        }))
    )
    .min(1)
    .max(100),
});

const returnBodySchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
});

const gradeInclude = {
  student: {
    select: { id: true, studentCode: true, fullName: true },
  },
  gradedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  returnedBy: { select: { id: true, fullName: true } },
  assignment: {
    select: {
      id: true,
      title: true,
      maxMarks: true,
      dueAt: true,
      teacherId: true,
      classSection: {
        select: {
          id: true,
          section: true,
          academicYear: true,
          semester: true,
          teacher: {
            select: {
              id: true,
              fullName: true,
              facultyCode: true,
              userId: true,
            },
          },
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
                  faculty: {
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

async function resolveAdmin(userId: string) {
  return prisma.admin.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function loadSubmissionForTeacher(submissionId: string, teacherId: string) {
  const row = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: {
        include: { user: { select: { status: true } } },
      },
      assignment: {
        include: {
          classSection: {
            select: {
              id: true,
              teacherId: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!row) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Submission not found",
    };
  }
  if (row.assignment.teacherId !== teacherId) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "Not allowed",
    };
  }
  return { ok: true as const, row };
}

function validateScore(score: number, maxMarks: number) {
  if (!Number.isFinite(score)) {
    return "Score must be numeric";
  }
  if (score < 0) {
    return "Score cannot be negative";
  }
  if (score > maxMarks) {
    return `Score cannot exceed max marks (${maxMarks})`;
  }
  return null;
}

async function biuAssignmentCapForSection(
  classSectionId: string,
  assignmentMaxMarks: number
) {
  const publishedCount = await prisma.assignment.count({
    where: { classSectionId, status: "PUBLISHED" },
  });
  return effectiveAssignmentScoreCap({
    assignmentMaxMarks,
    publishedAssignmentCountInSection: publishedCount,
  });
}

/** Teacher: list grades for an assignment (enrolled students + grade state). */
gradesRouter.get(
  "/assignments/:id/grades",
  requireRoles("TEACHER"),
  requirePermission(Permission.GRADES_READ),
  async (req: AuthedRequest, res) => {
    const assignmentId = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Inactive teachers cannot grade");
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        title: true,
        maxMarks: true,
        dueAt: true,
        teacherId: true,
        classSectionId: true,
      },
    });
    if (!assignment) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }
    if (assignment.teacherId !== teacher.id) {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classSectionId: assignment.classSectionId,
        status: "ACTIVE",
      },
      include: {
        student: {
          select: { id: true, studentCode: true, fullName: true },
        },
      },
      orderBy: { student: { fullName: "asc" } },
    });

    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: { id: true, studentCode: true, fullName: true },
        },
      },
    });
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

    type Row = {
      studentId: string;
      studentCode: string;
      studentName: string;
      submissionId: string | null;
      fileName: string | null;
      fileUrl: string | null;
      submittedAt: string | null;
      hasSubmission: boolean;
      studentNotes: string | null;
      score: number | null;
      feedback: string | null;
      teacherFeedback: string | null;
      maxMarks: number;
      percentage: number | null;
      gradeStatus: string;
      status: string;
      returnReason: string | null;
      canEdit: boolean;
      canSubmit: boolean;
    };

    let rows: Row[] = enrollments.map((en) => {
      const sub = byStudent.get(en.studentId);
      if (!sub) {
        return {
          studentId: en.student.id,
          studentCode: en.student.studentCode,
          studentName: en.student.fullName,
          submissionId: null,
          fileName: null,
          fileUrl: null,
          submittedAt: null,
          hasSubmission: false,
          studentNotes: null,
          score: null,
          feedback: null,
          teacherFeedback: null,
          maxMarks: assignment.maxMarks,
          percentage: null,
          gradeStatus: "NOT_GRADED",
          status: "Not Graded",
          returnReason: null,
          canEdit: false,
          canSubmit: false,
        };
      }
      const editable = ["NOT_GRADED", "GRADED", "RETURNED"].includes(
        sub.gradeStatus
      );
      // Submit when GRADED (has score). RETURNED must be re-saved to GRADED first.
      const canSubmit = sub.gradeStatus === "GRADED" && sub.score != null;
      const pct =
        sub.score != null && assignment.maxMarks > 0
          ? Math.round((sub.score / assignment.maxMarks) * 10000) / 100
          : null;
      const statusLabel =
        sub.gradeStatus === "NOT_GRADED"
          ? "Not Graded"
          : sub.gradeStatus === "GRADED"
            ? "Graded"
            : sub.gradeStatus === "PENDING_APPROVAL"
              ? "Pending Approval"
              : sub.gradeStatus === "APPROVED"
                ? "Approved"
                : "Returned";
      return {
        studentId: en.student.id,
        studentCode: en.student.studentCode,
        studentName: en.student.fullName,
        submissionId: sub.id,
        fileName: sub.fileName,
        fileUrl: `/api/submissions/${sub.id}/file`,
        submittedAt: sub.submittedAt.toISOString(),
        hasSubmission: true,
        studentNotes: sub.studentNotes ?? null,
        score: sub.score,
        feedback: sub.feedback,
        teacherFeedback: sub.feedback,
        maxMarks: assignment.maxMarks,
        percentage: pct,
        gradeStatus: sub.gradeStatus,
        status: statusLabel,
        returnReason: sub.returnReason,
        canEdit: editable,
        canSubmit,
      };
    });

    if (q) {
      const qq = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.studentCode.toLowerCase().includes(qq) ||
          r.studentName.toLowerCase().includes(qq)
      );
    }

    const total = rows.length;
    const effectiveMaxMarks = await biuAssignmentCapForSection(
      assignment.classSectionId,
      assignment.maxMarks
    );
    return res.json({
      data: rows.slice(skip, skip + take).map((r) => ({
        ...r,
        maxMarks: effectiveMaxMarks,
        assignmentMaxMarks: assignment.maxMarks,
      })),
      pagination: paginationMeta(total, page, pageSize),
      assignment: {
        id: assignment.id,
        title: assignment.title,
        maxMarks: effectiveMaxMarks,
        assignmentMaxMarks: assignment.maxMarks,
        dueAt: assignment.dueAt.toISOString(),
        biuAssignmentCap: effectiveMaxMarks,
      },
      biuPolicy: {
        assignmentsCombinedMax: 5,
        maxPerAssignmentWhenTwo: 2.5,
      },
    });
  }
);

/** Teacher: save grade on a submission. */
gradesRouter.patch(
  "/submissions/:id/grade",
  requireRoles("TEACHER"),
  requirePermission(Permission.GRADES_UPDATE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const parsed = gradeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid grade payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Inactive teachers cannot grade");
    }

    const loaded = await loadSubmissionForTeacher(id, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }
    const { row } = loaded;

    if (row.student.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Inactive students cannot receive new grading actions"
      );
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: row.studentId,
        classSectionId: row.assignment.classSectionId,
        status: "ACTIVE",
      },
    });
    if (!enrollment) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Student is not actively enrolled in this class"
      );
    }

    if (row.gradeStatus === "APPROVED") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Approved grades are immutable"
      );
    }
    if (row.gradeStatus === "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Grade is pending approval and cannot be edited"
      );
    }

    const biuCap = await biuAssignmentCapForSection(
      row.assignment.classSectionId,
      row.assignment.maxMarks
    );
    const scoreErr = validateScore(parsed.data.score, biuCap);
    if (scoreErr) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        `${scoreErr}. Dhapti policy: assignment marks combined max 5 (2.5 each if two assignments). Cap for this entry: ${biuCap}.`
      );
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        score: parsed.data.score,
        feedback: parsed.data.feedback ?? null,
        gradeStatus: "GRADED",
        gradedAt: new Date(),
        gradedById: teacher.id,
        status: "GRADED",
        // Preserve return audit history; clear only approval/submit markers
        approvedAt: null,
        approvedById: null,
        submittedForApprovalAt: null,
      },
      include: gradeInclude,
    });

    return res.json(serializeGrade(updated));
  }
);

/** Teacher: bulk save grades for own assignment submissions. */
gradesRouter.post(
  "/assignments/:id/grades/bulk",
  requireRoles("TEACHER"),
  requirePermission(Permission.GRADES_UPDATE),
  async (req: AuthedRequest, res) => {
    const assignmentId = paramId(req.params.id);
    const parsed = bulkGradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid bulk grade payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Inactive teachers cannot grade");
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        maxMarks: true,
        teacherId: true,
        classSectionId: true,
      },
    });
    if (!assignment) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }
    if (assignment.teacherId !== teacher.id) {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    const biuCap = await biuAssignmentCapForSection(
      assignment.classSectionId,
      assignment.maxMarks
    );
    const results: { submissionId: string; ok: boolean; error?: string }[] = [];

    for (const item of parsed.data.grades) {
      const scoreErr = validateScore(item.score, biuCap);
      if (scoreErr) {
        results.push({
          submissionId: item.submissionId,
          ok: false,
          error: `${scoreErr}. Dhapti assignment cap: ${biuCap}`,
        });
        continue;
      }

      const sub = await prisma.submission.findUnique({
        where: { id: item.submissionId },
        include: {
          student: { include: { user: { select: { status: true } } } },
        },
      });
      if (!sub || sub.assignmentId !== assignmentId) {
        results.push({
          submissionId: item.submissionId,
          ok: false,
          error: "Invalid submission for this assignment",
        });
        continue;
      }
      if (sub.gradeStatus === "APPROVED" || sub.gradeStatus === "PENDING_APPROVAL") {
        results.push({
          submissionId: item.submissionId,
          ok: false,
          error: "Grade cannot be edited in current status",
        });
        continue;
      }
      if (sub.student.user.status !== "ACTIVE") {
        results.push({
          submissionId: item.submissionId,
          ok: false,
          error: "Inactive student",
        });
        continue;
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: sub.studentId,
          classSectionId: assignment.classSectionId,
          status: "ACTIVE",
        },
      });
      if (!enrollment) {
        results.push({
          submissionId: item.submissionId,
          ok: false,
          error: "Student not actively enrolled",
        });
        continue;
      }

      await prisma.submission.update({
        where: { id: sub.id },
        data: {
          score: item.score,
          feedback: item.feedback ?? null,
          gradeStatus: "GRADED",
          gradedAt: new Date(),
          gradedById: teacher.id,
          status: "GRADED",
          approvedAt: null,
          approvedById: null,
          submittedForApprovalAt: null,
        },
      });
      results.push({ submissionId: item.submissionId, ok: true });
    }

    const failed = results.filter((r) => !r.ok).length;
    return res.json({
      ok: failed === 0,
      results,
      saved: results.filter((r) => r.ok).length,
      failed,
    });
  }
);

/** Teacher: submit grade for admin approval. */
gradesRouter.post(
  "/submissions/:id/grade/submit",
  requireRoles("TEACHER"),
  requirePermission(Permission.GRADES_SUBMIT),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Inactive teachers cannot grade");
    }

    const loaded = await loadSubmissionForTeacher(id, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }
    const { row } = loaded;

    if (row.student.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Inactive students cannot receive new grading actions"
      );
    }

    if (row.gradeStatus !== "GRADED") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only graded submissions can be submitted for approval"
      );
    }
    if (row.score == null) {
      return sendError(res, 400, "BAD_REQUEST", "Score is required");
    }

    const settings = await getSystemSettings();
    const now = new Date();
    const updated = await prisma.submission.update({
      where: { id },
      data: settings.requireAdminGradeApproval
        ? {
            gradeStatus: "PENDING_APPROVAL",
            submittedForApprovalAt: now,
          }
        : {
            gradeStatus: "APPROVED",
            submittedForApprovalAt: now,
            approvedAt: now,
          },
      include: gradeInclude,
    });

    if (!settings.requireAdminGradeApproval) {
      const studentUser = await prisma.student.findUnique({
        where: { id: updated.studentId },
        select: { userId: true },
      });
      if (studentUser) {
        await notifyGradeApproved({
          submissionId: updated.id,
          studentUserId: studentUser.userId,
          assignmentTitle: updated.assignment?.title ?? "Assignment",
        }).catch((err) => console.error("notifyGradeApproved", err));
      }
    }

    return res.json(serializeGrade(updated));
  }
);

/** Admin: list grades for review. */
gradesRouter.get(
  "/grades",
  requirePermission(Permission.GRADES_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const departmentId = String(req.query.departmentId ?? "").trim();
    const courseId = String(req.query.courseId ?? "").trim();
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();
    const teacherId = String(req.query.teacherId ?? "").trim();

    const and: Prisma.SubmissionWhereInput[] = [
      { gradeStatus: { not: "NOT_GRADED" } },
    ];

    if (
      status &&
      ["GRADED", "PENDING_APPROVAL", "APPROVED", "RETURNED"].includes(status)
    ) {
      and.push({ gradeStatus: status as "GRADED" | "PENDING_APPROVAL" | "APPROVED" | "RETURNED" });
    }

    if (q) {
      and.push({
        OR: [
          { student: { studentCode: { contains: q } } },
          { student: { fullName: { contains: q } } },
          { assignment: { title: { contains: q } } },
          {
            assignment: {
              classSection: { course: { code: { contains: q } } },
            },
          },
          {
            assignment: {
              classSection: { course: { title: { contains: q } } },
            },
          },
          {
            assignment: {
              classSection: { teacher: { fullName: { contains: q } } },
            },
          },
        ],
      });
    }

    if (facultyId) {
      and.push({
        assignment: {
          classSection: {
            course: { department: { facultyId } },
          },
        },
      });
    }
    if (departmentId) {
      and.push({
        assignment: {
          classSection: { course: { departmentId } },
        },
      });
    }
    if (courseId) {
      and.push({
        assignment: { classSection: { courseId } },
      });
    }
    if (academicYear) {
      and.push({
        assignment: { classSection: { academicYear } },
      });
    }
    if (semester) {
      and.push({
        assignment: { classSection: { semester } },
      });
    }
    if (teacherId) {
      and.push({
        assignment: { teacherId },
      });
    }

    const where: Prisma.SubmissionWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        include: gradeInclude,
        orderBy: [{ submittedForApprovalAt: "desc" }, { gradedAt: "desc" }],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeGrade),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Admin: grade detail. */
gradesRouter.get(
  "/grades/:id",
  requirePermission(Permission.GRADES_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.submission.findUnique({
      where: { id },
      include: gradeInclude,
    });
    if (!row || row.gradeStatus === "NOT_GRADED") {
      return sendError(res, 404, "NOT_FOUND", "Grade not found");
    }
    return res.json(serializeGrade(row));
  }
);

/** Admin: approve pending grade. */
gradesRouter.post(
  "/grades/:id/approve",
  requirePermission(Permission.GRADES_APPROVE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const admin = await resolveAdmin(req.user!.id);
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }

    const row = await prisma.submission.findUnique({ where: { id } });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Grade not found");
    }
    if (row.gradeStatus !== "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only pending grades can be approved"
      );
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        gradeStatus: "APPROVED",
        approvedAt: new Date(),
        approvedById: admin.id,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      },
      include: gradeInclude,
    });

    const studentUser = await prisma.student.findUnique({
      where: { id: updated.studentId },
      select: { userId: true },
    });
    if (studentUser) {
      await notifyGradeApproved({
        submissionId: updated.id,
        studentUserId: studentUser.userId,
        assignmentTitle: updated.assignment?.title ?? "Assignment",
      }).catch((err) => console.error("notifyGradeApproved", err));
    }

    const settings = await getSystemSettings();
    if (settings.sendGradeApprovalAlert) {
      const teacherUserId = updated.assignment?.classSection?.teacher?.userId;
      if (teacherUserId) {
        await notifyTeacherGradeDecision({
          teacherUserId,
          submissionId: updated.id,
          assignmentTitle: updated.assignment?.title ?? "Assignment",
          decision: "approved",
        }).catch((err) => console.error("notifyTeacherGradeDecision", err));
      }
    }

    return res.json(serializeGrade(updated));
  }
);

/** Admin: return/reject pending grade. */
gradesRouter.post(
  "/grades/:id/return",
  requirePermission(Permission.GRADES_RETURN),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const parsed = returnBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid return payload");
    }

    const admin = await resolveAdmin(req.user!.id);
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }

    const row = await prisma.submission.findUnique({ where: { id } });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Grade not found");
    }
    if (row.gradeStatus !== "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only pending grades can be returned"
      );
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        gradeStatus: "RETURNED",
        returnedAt: new Date(),
        returnedById: admin.id,
        returnReason: parsed.data.reason?.trim() || null,
        // keep score/feedback for teacher correction; clear approval markers
        approvedAt: null,
        approvedById: null,
      },
      include: gradeInclude,
    });

    const settings = await getSystemSettings();
    if (settings.sendGradeApprovalAlert) {
      const teacherUserId = updated.assignment?.classSection?.teacher?.userId;
      if (teacherUserId) {
        await notifyTeacherGradeDecision({
          teacherUserId,
          submissionId: updated.id,
          assignmentTitle: updated.assignment?.title ?? "Assignment",
          decision: "returned",
        }).catch((err) => console.error("notifyTeacherGradeDecision", err));
      }
    }

    return res.json(serializeGrade(updated));
  }
);

/** Student: own APPROVED results only. */
gradesRouter.get(
  "/students/me/results",
  requireRoles("STUDENT"),
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const { getStudentFinancialHold } = await import("../lib/financialHold.js");
    const hold = await getStudentFinancialHold(student.id);
    if (hold.active) {
      return sendError(
        res,
        403,
        "FINANCIAL_HOLD",
        hold.message ?? "Financial hold active"
      );
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();

    const and: Prisma.SubmissionWhereInput[] = [
      { studentId: student.id },
      { gradeStatus: "APPROVED" },
    ];
    if (academicYear) {
      and.push({ assignment: { classSection: { academicYear } } });
    }
    if (semester) {
      and.push({ assignment: { classSection: { semester } } });
    }

    const where: Prisma.SubmissionWhereInput = { AND: and };

    const quizAnd: Prisma.QuizAttemptWhereInput[] = [
      { studentId: student.id },
      { gradeStatus: "APPROVED" },
    ];
    if (academicYear) {
      quizAnd.push({ quiz: { classSection: { academicYear } } });
    }
    if (semester) {
      quizAnd.push({ quiz: { classSection: { semester } } });
    }
    const quizWhere: Prisma.QuizAttemptWhereInput = { AND: quizAnd };

    const [assignmentRows, quizRows] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              maxMarks: true,
              classSection: {
                select: {
                  section: true,
                  academicYear: true,
                  semester: true,
                  teacher: { select: { fullName: true } },
                  course: { select: { code: true, title: true } },
                },
              },
            },
          },
        },
        orderBy: [{ approvedAt: "desc" }, { gradedAt: "desc" }],
      }),
      prisma.quizAttempt.findMany({
        where: quizWhere,
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              assessmentType: true,
              classSection: {
                select: {
                  section: true,
                  academicYear: true,
                  semester: true,
                  teacher: { select: { fullName: true } },
                  course: { select: { code: true, title: true } },
                },
              },
            },
          },
        },
        orderBy: [{ approvedAt: "desc" }, { submittedAt: "desc" }],
      }),
    ]);

    type Merged = {
      sortAt: number;
      row: ReturnType<typeof serializeStudentResult> | ReturnType<typeof serializeQuizResult>;
    };

    const merged: Merged[] = [
      ...assignmentRows.map((r) => ({
        sortAt: (r.approvedAt ?? r.gradedAt ?? r.submittedAt).getTime(),
        row: serializeStudentResult(r),
      })),
      ...quizRows.map((r) => ({
        sortAt: (r.approvedAt ?? r.submittedAt ?? r.startedAt).getTime(),
        row: serializeQuizResult(r),
      })),
    ].sort((a, b) => b.sortAt - a.sortAt);

    const total = merged.length;
    const pageRows = merged.slice(skip, skip + take).map((m) => m.row);

    return res.json({
      data: pageRows,
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);
