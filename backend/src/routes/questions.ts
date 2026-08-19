import { Router } from "express";
import { z } from "zod";

import { writeAudit } from "../lib/audit.js";
import { sendError } from "../lib/errors.js";
import {
  notifyQuestionAsked,
  notifyQuestionReplied,
} from "../lib/notifications.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const questionsRouter = Router();

questionsRouter.use(requireAuth);

const questionInclude = {
  course: { select: { id: true, code: true, title: true } },
  author: {
    select: {
      id: true,
      email: true,
      role: true,
      student: { select: { fullName: true, studentCode: true } },
      teacher: { select: { fullName: true } },
      admin: { select: { fullName: true } },
    },
  },
  replies: {
    include: {
      author: {
        select: {
          id: true,
          email: true,
          role: true,
          teacher: { select: { fullName: true } },
          admin: { select: { fullName: true } },
          student: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function authorDisplayName(author: {
  email: string;
  student?: { fullName: string } | null;
  teacher?: { fullName: string } | null;
  admin?: { fullName: string } | null;
}) {
  return (
    author.student?.fullName ||
    author.teacher?.fullName ||
    author.admin?.fullName ||
    author.email
  );
}

function serializeQuestion(
  row: {
    id: string;
    courseId: string;
    authorId: string;
    subject: string;
    body: string;
    createdAt: Date;
    course: { id: string; code: string; title: string };
    author: {
      id: string;
      email: string;
      role: string;
      student?: { fullName: string; studentCode?: string } | null;
      teacher?: { fullName: string } | null;
      admin?: { fullName: string } | null;
    };
    replies: Array<{
      id: string;
      questionId: string;
      authorId: string;
      body: string;
      createdAt: Date;
      author: {
        id: string;
        email: string;
        role: string;
        student?: { fullName: string } | null;
        teacher?: { fullName: string } | null;
        admin?: { fullName: string } | null;
      };
    }>;
  }
) {
  return {
    id: row.id,
    courseId: row.courseId,
    course: row.course,
    authorId: row.authorId,
    authorName: authorDisplayName(row.author),
    authorRole: row.author.role,
    studentCode: row.author.student?.studentCode ?? null,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    answered: row.replies.length > 0,
    replyCount: row.replies.length,
    replies: row.replies.map((r) => ({
      id: r.id,
      body: r.body,
      authorId: r.authorId,
      authorName: authorDisplayName(r.author),
      authorRole: r.author.role,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function studentEnrolledInCourse(userId: string, courseId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) return false;
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      status: "ACTIVE",
      classSection: { courseId },
    },
    select: { id: true },
  });
  return Boolean(enrollment);
}

async function teacherAssignedToCourse(userId: string, courseId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!teacher) return false;
  const link = await prisma.courseTeacher.findFirst({
    where: { teacherId: teacher.id, courseId },
    select: { id: true },
  });
  if (link) return true;
  const section = await prisma.classSection.findFirst({
    where: { teacherId: teacher.id, courseId },
    select: { id: true },
  });
  return Boolean(section);
}

/** POST /api/questions — student asks a question on an enrolled course */
questionsRouter.post(
  "/",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      courseId: z.string().min(1),
      subject: z.string().trim().min(3).max(200),
      body: z.string().trim().min(5).max(5000),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid question payload");
    }

    const enrolled = await studentEnrolledInCourse(
      req.user!.id,
      parsed.data.courseId
    );
    if (!enrolled) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You can only ask questions for courses you are enrolled in"
      );
    }

    const created = await prisma.courseQuestion.create({
      data: {
        courseId: parsed.data.courseId,
        authorId: req.user!.id,
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
      include: questionInclude,
    });

    await writeAudit({
      actorId: req.user!.id,
      action: "QUESTION_CREATE",
      entityType: "CourseQuestion",
      entityId: created.id,
      meta: { courseId: created.courseId, module: "Q&A" },
    });

    const studentName = authorDisplayName(created.author);
    await notifyQuestionAsked({
      questionId: created.id,
      courseId: created.courseId,
      courseCode: created.course.code,
      subject: created.subject,
      studentName,
    }).catch(() => {});

    return res.status(201).json(serializeQuestion(created));
  }
);

/** GET /api/questions/me — student's own questions */
questionsRouter.get(
  "/me",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const courseId = String(req.query.courseId || "").trim();
    const rows = await prisma.courseQuestion.findMany({
      where: {
        authorId: req.user!.id,
        ...(courseId ? { courseId } : {}),
      },
      include: questionInclude,
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: rows.map(serializeQuestion) });
  }
);

/**
 * GET /api/questions/teacher — questions for courses the teacher teaches
 * Query: status=answered|unanswered|all, courseId?
 */
questionsRouter.get(
  "/teacher",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const status = String(req.query.status || "all").toLowerCase();
    const courseId = String(req.query.courseId || "").trim();

    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const assigned = await prisma.courseTeacher.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    });
    const sections = await prisma.classSection.findMany({
      where: { teacherId: teacher.id },
      select: { courseId: true },
    });
    const courseIds = [
      ...new Set([
        ...assigned.map((a) => a.courseId),
        ...sections.map((s) => s.courseId),
      ]),
    ];
    if (courseId) {
      if (!courseIds.includes(courseId)) {
        return res.json({
          data: [],
          pagination: paginationMeta(0, page, pageSize),
        });
      }
    }
    const filterIds = courseId ? [courseId] : courseIds;
    if (!filterIds.length) {
      return res.json({
        data: [],
        pagination: paginationMeta(0, page, pageSize),
      });
    }

    const where = {
      courseId: { in: filterIds },
      ...(status === "answered"
        ? { replies: { some: {} } }
        : status === "unanswered"
          ? { replies: { none: {} } }
          : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.courseQuestion.count({ where }),
      prisma.courseQuestion.findMany({
        where,
        include: questionInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeQuestion),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** GET /api/questions/course/:courseId — enrolled student or assigned teacher */
questionsRouter.get(
  "/course/:courseId",
  async (req: AuthedRequest, res) => {
    const courseId = String(req.params.courseId || "").trim();
    if (!courseId) {
      return sendError(res, 400, "BAD_REQUEST", "courseId required");
    }

    const role = req.user!.role;
    if (role === "STUDENT") {
      const ok = await studentEnrolledInCourse(req.user!.id, courseId);
      if (!ok) {
        return sendError(res, 403, "FORBIDDEN", "Not enrolled in this course");
      }
    } else if (role === "TEACHER") {
      const ok = await teacherAssignedToCourse(req.user!.id, courseId);
      if (!ok) {
        return sendError(res, 403, "FORBIDDEN", "Not assigned to this course");
      }
    } else if (role !== "ADMIN" && role !== "DEPARTMENT_ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Access denied");
    }

    const rows = await prisma.courseQuestion.findMany({
      where: { courseId },
      include: questionInclude,
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: rows.map(serializeQuestion) });
  }
);

/** POST /api/questions/:id/reply — teacher replies; notifies student */
questionsRouter.post(
  "/:id/reply",
  requireRoles("TEACHER", "ADMIN"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      body: z.string().trim().min(2).max(5000),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid reply payload");
    }

    const id = String(req.params.id || "").trim();
    const question = await prisma.courseQuestion.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, code: true, title: true } },
      },
    });
    if (!question) {
      return sendError(res, 404, "NOT_FOUND", "Question not found");
    }

    if (req.user!.role === "TEACHER") {
      const ok = await teacherAssignedToCourse(
        req.user!.id,
        question.courseId
      );
      if (!ok) {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "You can only reply to questions on your courses"
        );
      }
    }

    const reply = await prisma.courseQuestionReply.create({
      data: {
        questionId: question.id,
        authorId: req.user!.id,
        body: parsed.data.body,
      },
    });

    await notifyQuestionReplied({
      questionId: question.id,
      replyId: reply.id,
      studentUserId: question.authorId,
      courseCode: question.course.code,
      subject: question.subject,
    }).catch(() => {});

    await writeAudit({
      actorId: req.user!.id,
      action: "QUESTION_REPLY",
      entityType: "CourseQuestionReply",
      entityId: reply.id,
      meta: {
        questionId: question.id,
        courseId: question.courseId,
        module: "Q&A",
      },
    });

    const full = await prisma.courseQuestion.findUnique({
      where: { id: question.id },
      include: questionInclude,
    });
    return res.status(201).json(serializeQuestion(full!));
  }
);
