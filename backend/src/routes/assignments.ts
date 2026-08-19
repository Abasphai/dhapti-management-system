import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import {
  resolveSystemMaxFileMb,
  SYSTEM_MAX_FILE_MB,
  validateSubmissionFile,
} from "../lib/filePolicy.js";
import { notifyAssignmentPublished } from "../lib/notifications.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  assignmentInclude,
  serializeAssignment,
} from "../lib/serializeAssignment.js";
import { getFileStorage } from "../lib/storage/index.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
const materialsTempDir = path.resolve(
  backendRoot,
  process.env.FILE_STORAGE_TMP || "storage/tmp"
);

const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      void fs
        .mkdir(materialsTempDir, { recursive: true })
        .then(() => cb(null, materialsTempDir))
        .catch((err) => cb(err as Error, materialsTempDir));
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

export const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const statusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

async function validateTeacherOwnsClass(
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
      message: "You can only manage assignments for your own classes",
    };
  }
  if (classSection.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE class sections accept new assignments",
    };
  }
  if (classSection.course.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE courses accept new assignments",
    };
  }

  const courseTeacher = await prisma.courseTeacher.findUnique({
    where: {
      courseId_teacherId: {
        courseId: classSection.courseId,
        teacherId,
      },
    },
  });
  if (!courseTeacher) {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Teacher must be assigned to the course for this class",
    };
  }

  return { ok: true as const, classSection };
}

function buildListWhere(query: Record<string, unknown>, teacherId?: string) {
  const q = String(query.q ?? "").trim();
  const status = String(query.status ?? "").trim().toUpperCase();
  const classSectionId = String(query.classSectionId ?? "").trim();
  const courseId = String(query.courseId ?? "").trim();
  const academicYear = String(query.academicYear ?? "").trim();
  const semester = String(query.semester ?? "").trim();

  const and: Prisma.AssignmentWhereInput[] = [];
  if (teacherId) and.push({ teacherId });

  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { classSection: { section: { contains: q } } },
        { classSection: { course: { code: { contains: q } } } },
        { classSection: { course: { title: { contains: q } } } },
      ],
    });
  }
  if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    and.push({ status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" });
  }
  if (classSectionId) and.push({ classSectionId });
  if (courseId) and.push({ classSection: { courseId } });
  if (academicYear) and.push({ classSection: { academicYear } });
  if (semester) and.push({ classSection: { semester } });

  return and.length > 0 ? { AND: and } : {};
}

/** Teacher: own assignments only */
assignmentsRouter.get(
  "/me",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildListWhere(
      req.query as Record<string, unknown>,
      teacher.id
    );

    const [total, rows] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeAssignment),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Admin global list */
assignmentsRouter.get(
  "/",
  requirePermission(Permission.ASSIGNMENTS_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildListWhere(req.query as Record<string, unknown>);

    const [total, rows] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeAssignment),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

assignmentsRouter.get(
  "/:id",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.assignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    const role = req.user!.role;

    if (role === "ADMIN") {
      return res.json(serializeAssignment(row));
    }

    if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.id !== row.teacherId) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
      return res.json(serializeAssignment(row));
    }

    if (role === "STUDENT") {
      if (row.status !== "PUBLISHED") {
        return sendError(res, 404, "NOT_FOUND", "Assignment not found");
      }
      const student = await prisma.student.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!student) {
        return sendError(res, 404, "NOT_FOUND", "Student profile not found");
      }
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          classSectionId: row.classSectionId,
          status: "ACTIVE",
        },
      });
      if (!enrollment) {
        return sendError(res, 404, "NOT_FOUND", "Assignment not found");
      }
      return res.json(serializeAssignment(row));
    }

    return sendError(res, 403, "FORBIDDEN", "Not allowed");
  }
);

assignmentsRouter.post(
  "/",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      classSectionId: z.string().min(1),
      title: z.string().trim().min(2).max(200),
      description: z.string().max(5000).optional().nullable(),
      instructions: z.string().max(10000).optional().nullable(),
      dueAt: z.string().min(1),
      maxMarks: z.number().int().positive().max(1000).optional(),
      status: statusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid assignment payload");
    }

    const dueAt = new Date(parsed.data.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid due date");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(res, 400, "BAD_REQUEST", "Only ACTIVE teachers can create assignments");
    }

    const check = await validateTeacherOwnsClass(
      teacher.id,
      parsed.data.classSectionId
    );
    if (!check.ok) {
      return sendError(res, check.status, check.code, check.message);
    }

    const created = await prisma.assignment.create({
      data: {
        classSectionId: parsed.data.classSectionId,
        teacherId: teacher.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        instructions: parsed.data.instructions ?? null,
        dueAt,
        maxMarks: parsed.data.maxMarks ?? 100,
        status: parsed.data.status ?? "DRAFT",
      },
      include: assignmentInclude,
    });

    if (created.status === "PUBLISHED") {
      await notifyAssignmentPublished({
        id: created.id,
        title: created.title,
        classSectionId: created.classSectionId,
      }).catch((err) => console.error("notifyAssignmentPublished", err));
    }

    return res.status(201).json(serializeAssignment(created));
  }
);

assignmentsRouter.patch(
  "/:id",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(2).max(200).optional(),
      description: z.string().max(5000).optional().nullable(),
      instructions: z.string().max(10000).optional().nullable(),
      dueAt: z.string().min(1).optional(),
      maxMarks: z.number().int().positive().max(1000).optional(),
      status: statusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid assignment payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.id !== existing.teacherId) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You can only edit your own assignments"
      );
    }

    let dueAt: Date | undefined;
    if (parsed.data.dueAt !== undefined) {
      dueAt = new Date(parsed.data.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid due date");
      }
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        instructions: parsed.data.instructions,
        dueAt,
        maxMarks: parsed.data.maxMarks,
        status: parsed.data.status,
      },
      include: assignmentInclude,
    });

    return res.json(serializeAssignment(updated));
  }
);

assignmentsRouter.patch(
  "/:id/status",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const statusParsed = statusSchema.safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid assignment status");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.id !== existing.teacherId) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You can only update your own assignments"
      );
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: { status: statusParsed.data },
      include: assignmentInclude,
    });

    if (
      statusParsed.data === "PUBLISHED" &&
      existing.status !== "PUBLISHED"
    ) {
      await notifyAssignmentPublished({
        id: updated.id,
        title: updated.title,
        classSectionId: updated.classSectionId,
      }).catch((err) => console.error("notifyAssignmentPublished", err));
    }

    return res.json(serializeAssignment(updated));
  }
);

/** List instruction materials for an assignment (teacher owner, enrolled student, admin) */
assignmentsRouter.get(
  "/:id/materials",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        classSectionId: true,
        status: true,
        materials: {
          select: { id: true, fileName: true, fileSize: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!assignment) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    const role = req.user!.role;
    if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.id !== assignment.teacherId) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
    } else if (role === "STUDENT") {
      if (assignment.status !== "PUBLISHED") {
        return sendError(res, 404, "NOT_FOUND", "Assignment not found");
      }
      const student = await prisma.student.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!student) {
        return sendError(res, 404, "NOT_FOUND", "Student profile not found");
      }
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          classSectionId: assignment.classSectionId,
          status: "ACTIVE",
        },
      });
      if (!enrollment) {
        return sendError(res, 403, "FORBIDDEN", "Not enrolled in this class");
      }
    } else if (role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    return res.json({
      data: assignment.materials.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        fileSize: m.fileSize,
        attachmentUrl: `/api/assignments/materials/${m.id}/file`,
      })),
    });
  }
);

/** Download instruction material file */
assignmentsRouter.get(
  "/materials/:materialId/file",
  async (req: AuthedRequest, res) => {
    const materialId = paramId(req.params.materialId);
    const material = await prisma.assignmentMaterial.findUnique({
      where: { id: materialId },
      include: {
        assignment: {
          select: {
            id: true,
            teacherId: true,
            classSectionId: true,
            status: true,
            dueAt: true,
          },
        },
      },
    });
    if (!material) {
      return sendError(res, 404, "NOT_FOUND", "Material not found");
    }

    const role = req.user!.role;
    if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.id !== material.assignment.teacherId) {
        return sendError(res, 403, "FORBIDDEN", "Not allowed");
      }
    } else if (role === "STUDENT") {
      if (material.assignment.status !== "PUBLISHED") {
        return sendError(res, 404, "NOT_FOUND", "Material not found");
      }
      const student = await prisma.student.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!student) {
        return sendError(res, 404, "NOT_FOUND", "Student profile not found");
      }
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          classSectionId: material.assignment.classSectionId,
          status: "ACTIVE",
        },
      });
      if (!enrollment) {
        return sendError(res, 403, "FORBIDDEN", "Not enrolled in this class");
      }

      if (Date.now() > material.assignment.dueAt.getTime()) {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "Assignment deadline has passed. Document download is closed."
        );
      }
    } else if (role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    const storage = getFileStorage();
    const exists = await storage.exists(material.filePath);
    if (!exists) {
      return sendError(res, 404, "NOT_FOUND", "File not found in storage");
    }

    try {
      const stream = await storage.openReadStream(material.filePath);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${material.fileName.replace(/"/g, "")}"`
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

/** Soft archive */
assignmentsRouter.delete(
  "/:id",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Assignment not found");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.id !== existing.teacherId) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You can only archive your own assignments"
      );
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: { status: "ARCHIVED" },
      include: assignmentInclude,
    });

    return res.json({
      ok: true,
      archived: true,
      assignment: serializeAssignment(updated),
    });
  }
);

/** Teacher: attach instruction material (multipart field: file) */
assignmentsRouter.post(
  "/:id/materials",
  requireRoles("TEACHER"),
  (req, res, next) => {
    materialUpload.single("file")(req, res, (err) => {
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
      const id = paramId(req.params.id);
      const existing = await prisma.assignment.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, 404, "NOT_FOUND", "Assignment not found");
      }

      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.id !== existing.teacherId) {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "You can only attach materials to your own assignments"
        );
      }

      if (!req.file) {
        return sendError(res, 400, "BAD_REQUEST", "File is required");
      }

      const systemMaxMb = await resolveSystemMaxFileMb();
      const maxBytes = systemMaxMb * 1024 * 1024;
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

      const storageKey = `assignments/${id}/materials/${randomUUID()}.${validated.extension}`;
      const storage = getFileStorage();
      await storage.saveFromPath(req.file.path, storageKey);

      const material = await prisma.assignmentMaterial.create({
        data: {
          assignmentId: id,
          fileName: validated.safeName,
          filePath: storageKey,
          fileSize: req.file.size,
        },
      });

      return res.status(201).json({
        id: material.id,
        fileName: material.fileName,
        fileSize: material.fileSize,
        assignmentId: material.assignmentId,
      });
    } finally {
      if (tempPath) {
        try {
          await fs.unlink(tempPath);
        } catch {
          /* ignore */
        }
      }
    }
  }
);
