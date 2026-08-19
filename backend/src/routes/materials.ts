import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import {
  resolveSystemMaxFileMb,
  SYSTEM_MAX_FILE_MB,
  validateCourseMaterialFile,
  type MaterialTypeName,
} from "../lib/filePolicy.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { getFileStorage } from "../lib/storage/index.js";
import {
  requireAuth,
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

export const materialsRouter = Router();

materialsRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const materialTypeSchema = z.enum([
  "PDF",
  "POWERPOINT",
  "WORD",
  "ARCHIVE",
  "AUDIO",
  "VIDEO",
  "LINK",
]);

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    include: { user: { select: { status: true } } },
  });
}

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
}

function serializeMaterial(row: {
  id: string;
  title: string;
  description: string | null;
  materialType: MaterialTypeName;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  linkUrl: string | null;
  courseId: string;
  classSectionId: string | null;
  teacherId: string;
  createdAt: Date;
  course?: { id: string; code: string; title: string };
  teacher?: { id: string; fullName: string };
  classSection?: {
    id: string;
    section: string;
    academicYear: string;
    semester: string;
  } | null;
}) {
  const isLink = row.materialType === "LINK";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    materialType: row.materialType,
    type: row.materialType,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    linkUrl: row.linkUrl,
    fileUrl: isLink || !row.filePath ? null : `/api/materials/${row.id}/file`,
    courseId: row.courseId,
    classSectionId: row.classSectionId,
    teacherId: row.teacherId,
    createdAt: row.createdAt.toISOString(),
    course: row.course
      ? {
          id: row.course.id,
          code: row.course.code,
          title: row.course.title,
        }
      : undefined,
    teacher: row.teacher
      ? {
          id: row.teacher.id,
          name: row.teacher.fullName,
          fullName: row.teacher.fullName,
        }
      : undefined,
    classSection: row.classSection
      ? {
          id: row.classSection.id,
          section: row.classSection.section,
          academicYear: row.classSection.academicYear,
          semester: row.classSection.semester,
        }
      : null,
    previewable: ["PDF", "AUDIO", "VIDEO"].includes(row.materialType),
  };
}

const materialInclude = {
  course: { select: { id: true, code: true, title: true } },
  teacher: { select: { id: true, fullName: true } },
  classSection: {
    select: {
      id: true,
      section: true,
      academicYear: true,
      semester: true,
    },
  },
} as const;

async function teacherOwnsCourse(teacherId: string, courseId: string) {
  const link = await prisma.courseTeacher.findFirst({
    where: { teacherId, courseId },
  });
  if (link) return true;
  const section = await prisma.classSection.findFirst({
    where: { teacherId, courseId, status: "ACTIVE" },
  });
  return Boolean(section);
}

async function canAccessMaterial(
  req: AuthedRequest,
  material: {
    teacherId: string;
    courseId: string;
    classSectionId: string | null;
  }
): Promise<boolean> {
  const role = req.user!.role;
  if (role === "ADMIN") return true;
  if (role === "TEACHER") {
    const teacher = await resolveTeacher(req.user!.id);
    return Boolean(teacher && teacher.id === material.teacherId);
  }
  if (role === "STUDENT") {
    const student = await resolveStudent(req.user!.id);
    if (!student) return false;
    if (material.classSectionId) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          classSectionId: material.classSectionId,
          status: "ACTIVE",
        },
      });
      return Boolean(enrollment);
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        status: "ACTIVE",
        classSection: { courseId: material.courseId },
      },
    });
    return Boolean(enrollment);
  }
  return false;
}

/** Teacher: list own uploaded materials */
materialsRouter.get(
  "/materials/me",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const { page, pageSize, skip } = parsePagination(req.query);
    const courseId =
      typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const materialTypeRaw =
      typeof req.query.materialType === "string"
        ? req.query.materialType
        : undefined;
    const q =
      typeof req.query.q === "string" ? req.query.q.trim() : undefined;

    const where: {
      teacherId: string;
      courseId?: string;
      materialType?: MaterialTypeName;
      OR?: Array<{ title?: { contains: string }; description?: { contains: string } }>;
    } = { teacherId: teacher.id };

    if (courseId) where.courseId = courseId;
    if (materialTypeRaw) {
      const parsed = materialTypeSchema.safeParse(materialTypeRaw);
      if (parsed.success) where.materialType = parsed.data;
    }
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.courseMaterial.count({ where }),
      prisma.courseMaterial.findMany({
        where,
        include: materialInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return res.json({
      data: rows.map((r) => serializeMaterial(r)),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Student: all materials for active enrollments */
materialsRouter.get(
  "/student/materials",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: {
        classSectionId: true,
        classSection: { select: { courseId: true } },
      },
    });
    const classSectionIds = enrollments.map((e) => e.classSectionId);
    const courseIds = [
      ...new Set(enrollments.map((e) => e.classSection.courseId)),
    ];

    if (courseIds.length === 0) {
      return res.json({
        data: [],
        pagination: paginationMeta(0, 1, 20),
      });
    }

    const { page, pageSize, skip } = parsePagination(req.query);
    const courseId =
      typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const materialTypeRaw =
      typeof req.query.materialType === "string"
        ? req.query.materialType
        : undefined;
    const q =
      typeof req.query.q === "string" ? req.query.q.trim() : undefined;

    const and: object[] = [
      {
        OR: [
          { classSectionId: { in: classSectionIds } },
          { classSectionId: null, courseId: { in: courseIds } },
        ],
      },
    ];

    if (courseId) and.push({ courseId });
    if (materialTypeRaw) {
      const parsed = materialTypeSchema.safeParse(materialTypeRaw);
      if (parsed.success) and.push({ materialType: parsed.data });
    }
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { course: { title: { contains: q } } },
          { course: { code: { contains: q } } },
        ],
      });
    }

    const where = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.courseMaterial.count({ where }),
      prisma.courseMaterial.findMany({
        where,
        include: materialInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return res.json({
      data: rows.map((r) => serializeMaterial(r)),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Materials for a course (teacher owner / enrolled student / admin) */
materialsRouter.get(
  "/materials/course/:courseId",
  async (req: AuthedRequest, res) => {
    const courseId = paramId(req.params.courseId);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return sendError(res, 404, "NOT_FOUND", "Course not found");
    }

    const role = req.user!.role;
    if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || !(await teacherOwnsCourse(teacher.id, courseId))) {
        return sendError(res, 403, "FORBIDDEN", "Not assigned to this course");
      }
    } else if (role === "STUDENT") {
      const student = await resolveStudent(req.user!.id);
      if (!student) {
        return sendError(res, 404, "NOT_FOUND", "Student profile not found");
      }
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          status: "ACTIVE",
          classSection: { courseId },
        },
      });
      if (!enrollment) {
        return sendError(res, 403, "FORBIDDEN", "Not enrolled in this course");
      }
    } else if (role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    const { page, pageSize, skip } = parsePagination(req.query);
    const materialTypeRaw =
      typeof req.query.materialType === "string"
        ? req.query.materialType
        : undefined;

    const where: {
      courseId: string;
      materialType?: MaterialTypeName;
      teacherId?: string;
    } = { courseId };

    if (role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (teacher) where.teacherId = teacher.id;
    }
    if (materialTypeRaw) {
      const parsed = materialTypeSchema.safeParse(materialTypeRaw);
      if (parsed.success) where.materialType = parsed.data;
    }

    const [total, rows] = await Promise.all([
      prisma.courseMaterial.count({ where }),
      prisma.courseMaterial.findMany({
        where,
        include: materialInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return res.json({
      data: rows.map((r) => serializeMaterial(r)),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Download / stream material file */
materialsRouter.get(
  "/materials/:id/file",
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const material = await prisma.courseMaterial.findUnique({ where: { id } });
    if (!material || !material.filePath) {
      return sendError(res, 404, "NOT_FOUND", "Material file not found");
    }

    const allowed = await canAccessMaterial(req, material);
    if (!allowed) {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }

    const storage = getFileStorage();
    const exists = await storage.exists(material.filePath);
    if (!exists) {
      return sendError(res, 404, "NOT_FOUND", "File not found in storage");
    }

    const disposition =
      typeof req.query.inline === "string" && req.query.inline === "1"
        ? "inline"
        : "attachment";

    try {
      const stream = await storage.openReadStream(material.filePath);
      res.setHeader(
        "Content-Type",
        material.mimeType || "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${(material.fileName || "material").replace(/"/g, "")}"`
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

/** Teacher upload material (file or external link) */
materialsRouter.post(
  "/materials/upload",
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
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.user.status !== "ACTIVE") {
        return sendError(res, 403, "FORBIDDEN", "Teacher account not active");
      }

      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const description =
        typeof req.body?.description === "string"
          ? req.body.description.trim() || null
          : null;
      const courseId =
        typeof req.body?.courseId === "string" ? req.body.courseId : "";
      const classSectionIdRaw =
        typeof req.body?.classSectionId === "string"
          ? req.body.classSectionId.trim()
          : "";
      const classSectionId = classSectionIdRaw || null;
      const linkUrlRaw =
        typeof req.body?.linkUrl === "string" ? req.body.linkUrl.trim() : "";
      const materialTypeParsed = materialTypeSchema.safeParse(
        req.body?.materialType
      );

      if (!title || title.length < 2) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "Title is required (min 2 characters)"
        );
      }
      if (!courseId) {
        return sendError(res, 400, "BAD_REQUEST", "Course is required");
      }
      if (!materialTypeParsed.success) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid material type");
      }
      const materialType = materialTypeParsed.data;

      if (!(await teacherOwnsCourse(teacher.id, courseId))) {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "You can only upload materials for your assigned courses"
        );
      }

      if (classSectionId) {
        const section = await prisma.classSection.findFirst({
          where: {
            id: classSectionId,
            courseId,
            teacherId: teacher.id,
          },
        });
        if (!section) {
          return sendError(
            res,
            400,
            "BAD_REQUEST",
            "Class section not found for this course"
          );
        }
      }

      if (materialType === "LINK") {
        if (!linkUrlRaw) {
          return sendError(
            res,
            400,
            "BAD_REQUEST",
            "External link URL is required for LINK materials"
          );
        }
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(linkUrlRaw);
        } catch {
          return sendError(res, 400, "BAD_REQUEST", "Invalid external link URL");
        }
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return sendError(
            res,
            400,
            "BAD_REQUEST",
            "Link must use http or https"
          );
        }

        const created = await prisma.courseMaterial.create({
          data: {
            title,
            description,
            materialType: "LINK",
            linkUrl: parsedUrl.toString(),
            courseId,
            classSectionId,
            teacherId: teacher.id,
          },
          include: materialInclude,
        });
        return res.status(201).json(serializeMaterial(created));
      }

      if (!req.file) {
        return sendError(res, 400, "BAD_REQUEST", "File is required");
      }

      const systemMaxMb = await resolveSystemMaxFileMb();
      const maxBytes = systemMaxMb * 1024 * 1024;
      const validated = validateCourseMaterialFile({
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        maxBytes,
        materialType,
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

      const storageKey = `courses/${courseId}/materials/${randomUUID()}.${validated.extension}`;
      const storage = getFileStorage();
      await storage.saveFromPath(req.file.path, storageKey);

      const created = await prisma.courseMaterial.create({
        data: {
          title,
          description,
          materialType,
          fileName: validated.safeName,
          filePath: storageKey,
          fileSize: req.file.size,
          mimeType: req.file.mimetype || null,
          courseId,
          classSectionId,
          teacherId: teacher.id,
        },
        include: materialInclude,
      });

      return res.status(201).json(serializeMaterial(created));
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

/** Teacher owner or admin delete */
materialsRouter.delete(
  "/materials/:id",
  requireRoles("TEACHER", "ADMIN"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const material = await prisma.courseMaterial.findUnique({ where: { id } });
    if (!material) {
      return sendError(res, 404, "NOT_FOUND", "Material not found");
    }

    if (req.user!.role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || teacher.id !== material.teacherId) {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "You can only delete your own materials"
        );
      }
    }

    if (material.filePath) {
      try {
        const storage = getFileStorage();
        if (await storage.exists(material.filePath)) {
          await storage.delete(material.filePath);
        }
      } catch {
        /* continue with DB delete */
      }
    }

    await prisma.courseMaterial.delete({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  }
);
