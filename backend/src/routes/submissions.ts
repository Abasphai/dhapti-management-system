import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";

import { sendError } from "../lib/errors.js";
import {
  effectiveMaxFileBytes,
  resolveSystemMaxFileMb,
  SYSTEM_MAX_FILE_MB,
  validateSubmissionFile,
} from "../lib/filePolicy.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { serializeSubmission } from "../lib/serializeSubmission.js";
import { getFileStorage } from "../lib/storage/index.js";
import {
  requireAuth,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const submissionsRouter = Router();

submissionsRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
const tempDir = path.resolve(
  backendRoot,
  process.env.FILE_STORAGE_TMP || "storage/tmp"
);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      void fs
        .mkdir(tempDir, { recursive: true })
        .then(() => cb(null, tempDir))
        .catch((err) => cb(err as Error, tempDir));
    },
    filename: (_req, _file, cb) => {
      cb(null, randomUUID());
    },
  }),
  limits: {
    fileSize: SYSTEM_MAX_FILE_MB * 1024 * 1024,
    files: 1,
  },
});

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function cleanupTemp(filePath?: string) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function assertStudentCanSubmit(studentId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      classSection: { select: { id: true, teacherId: true, status: true } },
    },
  });
  if (!assignment) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Assignment not found",
    };
  }
  if (assignment.status !== "PUBLISHED") {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "Only published assignments accept submissions",
    };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      classSectionId: assignment.classSectionId,
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

  const now = new Date();
  if (now.getTime() > assignment.dueAt.getTime()) {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Submission closed — deadline has passed",
      assignment,
    };
  }

  return { ok: true as const, assignment };
}

/** Student: create or replace own submission (multipart field: file) */
submissionsRouter.post(
  "/assignments/:id/submission",
  requireRoles("STUDENT"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return sendError(
          res,
          413,
          "PAYLOAD_TOO_LARGE",
          `File exceeds ${SYSTEM_MAX_FILE_MB}MB limit`
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Invalid file upload");
    });
  },
  async (req: AuthedRequest, res) => {
    const tempPath = req.file?.path;
    try {
      const assignmentId = paramId(req.params.id);
      const student = await resolveStudent(req.user!.id);
      if (!student) {
        return sendError(res, 404, "NOT_FOUND", "Student profile not found");
      }

      if (!req.file) {
        return sendError(res, 400, "BAD_REQUEST", "File is required");
      }

      const gate = await assertStudentCanSubmit(student.id, assignmentId);
      if (!gate.ok) {
        return sendError(res, gate.status, gate.code, gate.message);
      }

      const systemMaxMb = await resolveSystemMaxFileMb();
      const maxBytes = effectiveMaxFileBytes(
        gate.assignment.maxFileMb,
        systemMaxMb
      );
      const validated = validateSubmissionFile({
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        maxBytes,
      });
      if (!validated.ok) {
        const tooLarge = validated.message.includes("exceeds");
        return sendError(
          res,
          tooLarge ? 413 : 400,
          tooLarge ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
          validated.message
        );
      }

      const storage = getFileStorage();
      const existing = await prisma.submission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: student.id,
          },
        },
      });

      // Replace only allowed before deadline (already checked).
      const storageKey = `assignments/${assignmentId}/submissions/${student.id}/${randomUUID()}.${validated.extension}`;

      let stored;
      try {
        stored = await storage.saveFromPath(tempPath!, storageKey);
      } catch {
        return sendError(res, 500, "INTERNAL_ERROR", "Failed to store file");
      }

      const mimeType = req.file.mimetype || "application/octet-stream";
      const now = new Date();
      const notesRaw = req.body?.studentNotes;
      const studentNotes =
        typeof notesRaw === "string"
          ? notesRaw.trim().slice(0, 5000) || null
          : null;

      try {
        const row = existing
          ? await prisma.submission.update({
              where: { id: existing.id },
              data: {
                fileName: validated.safeName,
                storageKey,
                mimeType,
                fileSize: stored.sizeBytes,
                studentNotes,
                status: "SUBMITTED",
                submittedAt: now,
              },
              include: {
                student: {
                  select: { id: true, studentCode: true, fullName: true },
                },
              },
            })
          : await prisma.submission.create({
              data: {
                assignmentId,
                studentId: student.id,
                fileName: validated.safeName,
                storageKey,
                mimeType,
                fileSize: stored.sizeBytes,
                studentNotes,
                status: "SUBMITTED",
                submittedAt: now,
              },
              include: {
                student: {
                  select: { id: true, studentCode: true, fullName: true },
                },
              },
            });

        if (existing?.storageKey && existing.storageKey !== storageKey) {
          await storage.delete(existing.storageKey);
        }

        return res.status(existing ? 200 : 201).json(serializeSubmission(row));
      } catch {
        await storage.delete(storageKey);
        return sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to save submission"
        );
      }
    } finally {
      await cleanupTemp(tempPath);
    }
  }
);

/** Student: own submission for assignment */
submissionsRouter.get(
  "/assignments/:id/submission",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const assignmentId = paramId(req.params.id);
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classSectionId: true,
        status: true,
        dueAt: true,
        maxMarks: true,
      },
    });
    if (!assignment || assignment.status !== "PUBLISHED") {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        classSectionId: assignment.classSectionId,
        status: "ACTIVE",
      },
    });
    if (!enrollment) {
      return sendError(res, 403, "FORBIDDEN", "You are not enrolled in this class");
    }

    const row = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: student.id,
        },
      },
      include: {
        student: {
          select: { id: true, studentCode: true, fullName: true },
        },
      },
    });

    const now = new Date();
    const open = now.getTime() <= assignment.dueAt.getTime();

    return res.json({
      submission: row
        ? serializeSubmission(row, {
            studentView: true,
            maxMarks: assignment.maxMarks,
          })
        : null,
      submissionOpen: open,
      dueAt: assignment.dueAt.toISOString(),
    });
  }
);

/** Teacher: submissions + missing for own assignment */
submissionsRouter.get(
  "/assignments/:id/submissions",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const assignmentId = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        teacherId: true,
        classSectionId: true,
        dueAt: true,
        title: true,
        maxMarks: true,
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
    const statusFilter = String(req.query.status ?? "").trim().toUpperCase();

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
      status: "SUBMITTED" | "LATE" | "MISSING";
      uiStatus: string;
      submittedAt: string | null;
      fileName: string | null;
      fileSize: number | null;
      mimeType: string | null;
      submissionId: string | null;
      fileUrl: string | null;
      studentNotes: string | null;
      score: number | null;
      feedback: string | null;
      teacherFeedback: string | null;
      maxMarks: number;
      gradeStatus: string;
      gradeUiStatus: string;
      returnReason: string | null;
      canEditGrade: boolean;
      canSubmitGrade: boolean;
    };

    let rows: Row[] = enrollments.map((en) => {
      const sub = byStudent.get(en.studentId);
      if (!sub) {
        return {
          studentId: en.student.id,
          studentCode: en.student.studentCode,
          studentName: en.student.fullName,
          status: "MISSING" as const,
          uiStatus: "Missing",
          submittedAt: null,
          fileName: null,
          fileSize: null,
          mimeType: null,
          submissionId: null,
          fileUrl: null,
          studentNotes: null,
          score: null,
          feedback: null,
          teacherFeedback: null,
          maxMarks: assignment.maxMarks,
          gradeStatus: "NOT_GRADED",
          gradeUiStatus: "Not Graded",
          returnReason: null,
          canEditGrade: false,
          canSubmitGrade: false,
        };
      }
      const late = sub.submittedAt.getTime() > assignment.dueAt.getTime();
      const status = late ? ("LATE" as const) : ("SUBMITTED" as const);
      const gradeStatus = sub.gradeStatus;
      const gradeUiStatus =
        gradeStatus === "NOT_GRADED"
          ? "Not Graded"
          : gradeStatus === "GRADED"
            ? "Graded"
            : gradeStatus === "PENDING_APPROVAL"
              ? "Pending Approval"
              : gradeStatus === "APPROVED"
                ? "Approved"
                : "Returned";
      return {
        studentId: en.student.id,
        studentCode: en.student.studentCode,
        studentName: en.student.fullName,
        status,
        uiStatus: late ? "Late" : "Submitted",
        submittedAt: sub.submittedAt.toISOString(),
        fileName: sub.fileName,
        fileSize: sub.fileSize,
        mimeType: sub.mimeType,
        submissionId: sub.id,
        fileUrl: `/api/submissions/${sub.id}/file`,
        studentNotes: sub.studentNotes ?? null,
        score: sub.score,
        feedback: sub.feedback,
        teacherFeedback: sub.feedback,
        maxMarks: assignment.maxMarks,
        gradeStatus,
        gradeUiStatus,
        returnReason: sub.returnReason,
        canEditGrade: ["NOT_GRADED", "GRADED", "RETURNED"].includes(gradeStatus),
        canSubmitGrade: gradeStatus === "GRADED" && sub.score != null,
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
    if (statusFilter === "SUBMITTED" || statusFilter === "MISSING" || statusFilter === "LATE") {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    const total = rows.length;
    const pageRows = rows.slice(skip, skip + take);

    return res.json({
      data: pageRows,
      pagination: paginationMeta(total, page, pageSize),
      assignment: {
        id: assignment.id,
        title: assignment.title,
        dueAt: assignment.dueAt.toISOString(),
        maxMarks: assignment.maxMarks,
      },
    });
  }
);

/** Authenticated download — student own OR teacher owner OR admin */
submissionsRouter.get(
  "/submissions/:id/file",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.submission.findUnique({
      where: { id },
      include: {
        assignment: {
          select: { id: true, teacherId: true, classSectionId: true },
        },
      },
    });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Submission not found");
    }

    const role = req.user!.role;
    if (role === "STUDENT") {
      const student = await resolveStudent(req.user!.id);
      if (!student || student.id !== row.studentId) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
    } else if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.id !== row.assignment.teacherId) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
    } else if (role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    const storage = getFileStorage();
    const exists = await storage.exists(row.storageKey);
    if (!exists) {
      return sendError(res, 404, "NOT_FOUND", "File not found in storage");
    }

    try {
      const stream = await storage.openReadStream(row.storageKey);
      res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${row.fileName.replace(/"/g, "")}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      stream.on("error", () => {
        if (!res.headersSent) {
          sendError(res, 500, "INTERNAL_ERROR", "Failed to read file");
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch {
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to read file");
    }
  }
);
