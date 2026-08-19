import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  assertStudentEnrolled,
  quizAvailableNow,
  recalculateQuizTotalMarks,
  resolveAdmin,
  resolveStudent,
  resolveTeacher,
  validateTeacherOwnsClass,
} from "../lib/quizAccess.js";
import {
  notifyQuizGradeApproved,
  notifyQuizPublished,
} from "../lib/notifications.js";
import {
  calcPercentage,
  gradeAnswers,
  type SubmittedAnswer,
} from "../lib/quizGrading.js";
import {
  quizIncludeTeacher,
  serializeAttempt,
  serializeQuiz,
} from "../lib/serializeQuiz.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const quizzesRouter = Router();

quizzesRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const quizStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);

const choiceInputSchema = z.object({
  label: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
  orderIndex: z.number().int().optional(),
});

const questionBodySchema = z
  .object({
    type: z.enum([
      "MULTIPLE_CHOICE_SINGLE",
      "TRUE_FALSE",
      "SHORT_ANSWER",
    ]),
    prompt: z.string().trim().min(1).max(5000),
    marks: z.number().int().positive().max(1000),
    orderIndex: z.number().int().optional(),
    correctBoolean: z.boolean().optional().nullable(),
    acceptedAnswers: z.array(z.string().max(500)).max(50).optional(),
    choices: z.array(choiceInputSchema).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "MULTIPLE_CHOICE_SINGLE") {
      if (!data.choices || data.choices.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice requires at least 2 choices",
          path: ["choices"],
        });
        return;
      }
      const correct = data.choices.filter((c) => c.isCorrect).length;
      if (correct !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice requires exactly one correct choice",
          path: ["choices"],
        });
      }
    }
    if (data.type === "TRUE_FALSE") {
      if (typeof data.correctBoolean !== "boolean") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "correctBoolean is required for TRUE_FALSE",
          path: ["correctBoolean"],
        });
      }
    }
  });

const createQuizSchema = z.object({
  classSectionId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
  durationMinutes: z.number().int().positive().max(600).optional(),
  availableFrom: z.string().optional().nullable(),
  availableUntil: z.string().optional().nullable(),
  maxAttempts: z.number().int().positive().max(20).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleChoices: z.boolean().optional(),
  showResultAfterSubmit: z.boolean().optional(),
  assessmentType: z.string().trim().min(1).max(40).optional(),
});

const patchQuizSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
  durationMinutes: z.number().int().positive().max(600).optional(),
  availableFrom: z.string().optional().nullable(),
  availableUntil: z.string().optional().nullable(),
  maxAttempts: z.number().int().positive().max(20).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleChoices: z.boolean().optional(),
  showResultAfterSubmit: z.boolean().optional(),
  assessmentType: z.string().trim().min(1).max(40).optional(),
});

const answersBodySchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        choiceId: z.string().min(1).optional().nullable(),
        answerText: z.string().max(5000).optional().nullable(),
      })
    )
    .min(1)
    .max(200),
});

const returnBodySchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
});

const classSectionSelect = {
  id: true,
  section: true,
  academicYear: true,
  semester: true,
  course: { select: { id: true, code: true, title: true } },
  teacher: { select: { id: true, fullName: true, facultyCode: true } },
} as const;

const attemptInclude = {
  student: {
    select: { id: true, studentCode: true, fullName: true },
  },
  answers: {
    select: {
      questionId: true,
      choiceId: true,
      answerText: true,
    },
  },
  quiz: {
    select: {
      id: true,
      title: true,
      totalMarks: true,
      showResultAfterSubmit: true,
      durationMinutes: true,
      teacherId: true,
      classSection: { select: classSectionSelect },
    },
  },
} as const;

const adminAttemptInclude = {
  student: {
    select: { id: true, studentCode: true, fullName: true },
  },
  answers: {
    select: {
      questionId: true,
      choiceId: true,
      answerText: true,
      isCorrect: true,
      marksAwarded: true,
      needsReview: true,
    },
  },
  quiz: {
    select: {
      id: true,
      title: true,
      totalMarks: true,
      showResultAfterSubmit: true,
      durationMinutes: true,
      teacherId: true,
      status: true,
      classSection: {
        select: {
          ...classSectionSelect,
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

function parseOptionalDate(
  value: string | null | undefined,
  field: string
): { ok: true; date: Date | null | undefined } | { ok: false; message: string } {
  if (value === undefined) return { ok: true, date: undefined };
  if (value === null || value === "") return { ok: true, date: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: `Invalid ${field}` };
  }
  return { ok: true, date };
}

function availabilityWindowValid(
  from: Date | null | undefined,
  until: Date | null | undefined
): boolean {
  if (from && until && from.getTime() >= until.getTime()) return false;
  return true;
}

function questionIsPublishable(q: {
  type: string;
  prompt: string;
  marks: number;
  correctBoolean: boolean | null;
  choices: { isCorrect: boolean; label: string }[];
}): string | null {
  if (!q.prompt.trim()) return "Question prompt is required";
  if (!Number.isInteger(q.marks) || q.marks <= 0) {
    return "Question marks must be a positive integer";
  }
  if (q.type === "MULTIPLE_CHOICE_SINGLE") {
    if (q.choices.length < 2) {
      return "Multiple choice questions need at least 2 choices";
    }
    if (q.choices.filter((c) => c.isCorrect).length !== 1) {
      return "Multiple choice questions need exactly one correct choice";
    }
  }
  if (q.type === "TRUE_FALSE") {
    if (typeof q.correctBoolean !== "boolean") {
      const correctChoices = q.choices.filter((c) => c.isCorrect);
      if (correctChoices.length !== 1) {
        return "TRUE_FALSE questions need a correct answer";
      }
    }
  }
  return null;
}

type QuestionBody = z.infer<typeof questionBodySchema>;

function buildQuestionCreateData(quizId: string, data: QuestionBody, orderIndex: number) {
  if (data.type === "MULTIPLE_CHOICE_SINGLE") {
    return {
      quizId,
      type: data.type,
      prompt: data.prompt,
      marks: data.marks,
      orderIndex,
      correctBoolean: null as boolean | null,
      acceptedAnswersJson: null as string | null,
      choices: {
        create: (data.choices ?? []).map((c, i) => ({
          label: c.label,
          isCorrect: c.isCorrect,
          orderIndex: c.orderIndex ?? i,
        })),
      },
    };
  }

  if (data.type === "TRUE_FALSE") {
    const correct = Boolean(data.correctBoolean);
    return {
      quizId,
      type: data.type,
      prompt: data.prompt,
      marks: data.marks,
      orderIndex,
      correctBoolean: correct,
      acceptedAnswersJson: null as string | null,
      choices: {
        create: [
          { label: "True", orderIndex: 0, isCorrect: correct === true },
          { label: "False", orderIndex: 1, isCorrect: correct === false },
        ],
      },
    };
  }

  const accepted = (data.acceptedAnswers ?? []).map((a) => a.trim()).filter(Boolean);
  return {
    quizId,
    type: data.type,
    prompt: data.prompt,
    marks: data.marks,
    orderIndex,
    correctBoolean: null as boolean | null,
    acceptedAnswersJson: JSON.stringify(accepted),
    choices: undefined,
  };
}

function buildQuizListWhere(
  query: Record<string, unknown>,
  teacherId?: string
): Prisma.QuizWhereInput {
  const q = String(query.q ?? "").trim();
  const status = String(query.status ?? "").trim().toUpperCase();
  const classSectionId = String(query.classSectionId ?? "").trim();
  const courseId = String(query.courseId ?? "").trim();
  const academicYear = String(query.academicYear ?? "").trim();
  const semester = String(query.semester ?? "").trim();
  const facultyId = String(query.facultyId ?? "").trim();
  const departmentId = String(query.departmentId ?? "").trim();
  const filterTeacherId = String(query.teacherId ?? "").trim();

  const and: Prisma.QuizWhereInput[] = [];
  if (teacherId) and.push({ teacherId });
  if (filterTeacherId) and.push({ teacherId: filterTeacherId });

  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { classSection: { section: { contains: q } } },
        { classSection: { course: { code: { contains: q } } } },
        { classSection: { course: { title: { contains: q } } } },
        { teacher: { fullName: { contains: q } } },
      ],
    });
  }
  if (
    status &&
    ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"].includes(status)
  ) {
    and.push({
      status: status as "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED",
    });
  }
  if (classSectionId) and.push({ classSectionId });
  if (courseId) and.push({ classSection: { courseId } });
  if (academicYear) and.push({ classSection: { academicYear } });
  if (semester) and.push({ classSection: { semester } });
  if (departmentId) {
    and.push({ classSection: { course: { departmentId } } });
  }
  if (facultyId) {
    and.push({
      classSection: { course: { department: { facultyId } } },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

async function loadOwnedQuiz(quizId: string, teacherId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: quizIncludeTeacher,
  });
  if (!quiz) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Quiz not found",
    };
  }
  if (quiz.teacherId !== teacherId) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "You can only manage your own quizzes",
    };
  }
  return { ok: true as const, quiz };
}

async function finalizeAttemptInTx(
  tx: Prisma.TransactionClient,
  attemptId: string,
  quizId: string,
  finalStatus: "SUBMITTED" | "EXPIRED",
  answerInputs?: SubmittedAnswer[]
) {
  let submitted = answerInputs;
  if (!submitted) {
    const existing = await tx.quizAnswer.findMany({ where: { attemptId } });
    submitted = existing.map((a) => ({
      questionId: a.questionId,
      choiceId: a.choiceId,
      answerText: a.answerText,
    }));
  }

  const questions = await tx.quizQuestion.findMany({
    where: { quizId },
    include: { choices: true },
    orderBy: { orderIndex: "asc" },
  });

  const graded = gradeAnswers(questions, submitted);

  for (const a of graded.answers) {
    await tx.quizAnswer.upsert({
      where: {
        attemptId_questionId: { attemptId, questionId: a.questionId },
      },
      create: {
        attemptId,
        questionId: a.questionId,
        choiceId: a.choiceId,
        answerText: a.answerText,
        isCorrect: a.isCorrect,
        marksAwarded: a.marksAwarded,
        needsReview: a.needsReview,
      },
      update: {
        choiceId: a.choiceId,
        answerText: a.answerText,
        isCorrect: a.isCorrect,
        marksAwarded: a.marksAwarded,
        needsReview: a.needsReview,
      },
    });
  }

  const now = new Date();
  return tx.quizAttempt.update({
    where: { id: attemptId },
    data: {
      status: finalStatus,
      submittedAt: now,
      score: graded.score,
      maxScore: graded.maxScore,
      percentage: calcPercentage(graded.score, graded.maxScore),
      gradeStatus: "PENDING_APPROVAL",
      needsManualReview: graded.needsManualReview,
      gradedAt: now,
      submittedForApprovalAt: now,
    },
    include: attemptInclude,
  });
}

function revealScoreForViewer(
  role: string,
  gradeStatus: string,
  attemptStatus: string
): boolean {
  if (role === "ADMIN" || role === "TEACHER") {
    return attemptStatus === "SUBMITTED" || attemptStatus === "EXPIRED";
  }
  return gradeStatus === "APPROVED";
}

/** Teacher: own quizzes */
quizzesRouter.get(
  "/quizzes/me",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildQuizListWhere(
      req.query as Record<string, unknown>,
      teacher.id
    );

    const [total, rows] = await Promise.all([
      prisma.quiz.count({ where }),
      prisma.quiz.findMany({
        where,
        include: {
          classSection: { select: classSectionSelect },
          _count: { select: { questions: true, attempts: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((row) => ({
        ...serializeQuiz(row),
        questionCount: row._count.questions,
        attemptCount: row._count.attempts,
      })),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Admin: global quiz list */
quizzesRouter.get(
  "/quizzes",
  requirePermission(Permission.GRADES_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = buildQuizListWhere(req.query as Record<string, unknown>);

    const [total, rows] = await Promise.all([
      prisma.quiz.count({ where }),
      prisma.quiz.findMany({
        where,
        include: {
          classSection: { select: classSectionSelect },
          _count: { select: { questions: true, attempts: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((row) => ({
        ...serializeQuiz(row, { includeAnswerKey: false }),
        questionCount: row._count.questions,
        attemptCount: row._count.attempts,
      })),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Teacher: create DRAFT quiz */
quizzesRouter.post(
  "/quizzes",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const parsed = createQuizSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid quiz payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    if (teacher.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE teachers can create quizzes"
      );
    }

    const check = await validateTeacherOwnsClass(
      teacher.id,
      parsed.data.classSectionId
    );
    if (!check.ok) {
      return sendError(res, check.status, check.code, check.message);
    }

    const from = parseOptionalDate(parsed.data.availableFrom, "availableFrom");
    if (!from.ok) return sendError(res, 400, "BAD_REQUEST", from.message);
    const until = parseOptionalDate(
      parsed.data.availableUntil,
      "availableUntil"
    );
    if (!until.ok) return sendError(res, 400, "BAD_REQUEST", until.message);
    if (!availabilityWindowValid(from.date, until.date)) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "availableFrom must be before availableUntil"
      );
    }

    const created = await prisma.quiz.create({
      data: {
        classSectionId: parsed.data.classSectionId,
        teacherId: teacher.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        instructions: parsed.data.instructions ?? null,
        status: "DRAFT",
        durationMinutes: parsed.data.durationMinutes ?? 30,
        availableFrom: from.date ?? null,
        availableUntil: until.date ?? null,
        maxAttempts: parsed.data.maxAttempts ?? 1,
        shuffleQuestions: parsed.data.shuffleQuestions ?? false,
        shuffleChoices: parsed.data.shuffleChoices ?? false,
        showResultAfterSubmit: parsed.data.showResultAfterSubmit ?? false,
        assessmentType: parsed.data.assessmentType ?? "QUIZ",
        totalMarks: 0,
      },
      include: quizIncludeTeacher,
    });

    return res
      .status(201)
      .json(serializeQuiz(created, { includeAnswerKey: true }));
  }
);

/** Student: enrolled PUBLISHED quizzes available now */
quizzesRouter.get(
  "/students/me/quizzes",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    if (student.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Inactive students cannot take quizzes");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const classSectionId = String(req.query.classSectionId ?? "").trim();
    const now = new Date();

    const and: Prisma.QuizWhereInput[] = [
      { status: "PUBLISHED" },
      {
        classSection: {
          enrollments: {
            some: { studentId: student.id, status: "ACTIVE" },
          },
        },
      },
      { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
    ];

    if (classSectionId) and.push({ classSectionId });
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

    const where: Prisma.QuizWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.quiz.count({ where }),
      prisma.quiz.findMany({
        where,
        include: {
          classSection: { select: classSectionSelect },
          attempts: {
            where: { studentId: student.id },
            orderBy: { attemptNumber: "desc" },
            select: {
              id: true,
              attemptNumber: true,
              status: true,
              gradeStatus: true,
              score: true,
              maxScore: true,
              percentage: true,
              submittedAt: true,
            },
          },
          _count: { select: { questions: true } },
        },
        orderBy: { availableFrom: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((row) => {
        const serialized = serializeQuiz(row, { studentView: true });
        const latest = row.attempts[0] ?? null;
        return {
          ...serialized,
          questionCount: row._count.questions,
          attemptCount: row.attempts.length,
          maxAttempts: row.maxAttempts,
          latestAttempt: latest
            ? {
                id: latest.id,
                attemptNumber: latest.attemptNumber,
                status: latest.status,
                gradeStatus: latest.gradeStatus,
                submittedAt: latest.submittedAt?.toISOString() ?? null,
                ...(latest.gradeStatus === "APPROVED"
                  ? {
                      score: latest.score,
                      maxScore: latest.maxScore,
                      percentage: latest.percentage,
                    }
                  : {
                      score: null,
                      maxScore: null,
                      percentage: null,
                    }),
              }
            : null,
        };
      }),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** Admin: list quiz attempts pending oversight */
quizzesRouter.get(
  "/quiz-attempts",
  requirePermission(Permission.GRADES_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const gradeStatus = String(req.query.gradeStatus ?? "").trim().toUpperCase();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const departmentId = String(req.query.departmentId ?? "").trim();
    const courseId = String(req.query.courseId ?? "").trim();
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();
    const teacherId = String(req.query.teacherId ?? "").trim();

    const and: Prisma.QuizAttemptWhereInput[] = [
      { status: { in: ["SUBMITTED", "EXPIRED"] } },
    ];

    if (
      status &&
      ["IN_PROGRESS", "SUBMITTED", "EXPIRED", "CANCELLED"].includes(status)
    ) {
      and.length = 0;
      and.push({
        status: status as
          | "IN_PROGRESS"
          | "SUBMITTED"
          | "EXPIRED"
          | "CANCELLED",
      });
    }

    if (
      gradeStatus &&
      [
        "NOT_GRADED",
        "GRADED",
        "PENDING_APPROVAL",
        "APPROVED",
        "RETURNED",
      ].includes(gradeStatus)
    ) {
      and.push({
        gradeStatus: gradeStatus as
          | "NOT_GRADED"
          | "GRADED"
          | "PENDING_APPROVAL"
          | "APPROVED"
          | "RETURNED",
      });
    }

    if (q) {
      and.push({
        OR: [
          { student: { studentCode: { contains: q } } },
          { student: { fullName: { contains: q } } },
          { quiz: { title: { contains: q } } },
          {
            quiz: {
              classSection: { course: { code: { contains: q } } },
            },
          },
          {
            quiz: {
              classSection: { course: { title: { contains: q } } },
            },
          },
          {
            quiz: {
              classSection: { teacher: { fullName: { contains: q } } },
            },
          },
        ],
      });
    }

    if (facultyId) {
      and.push({
        quiz: {
          classSection: {
            course: { department: { facultyId } },
          },
        },
      });
    }
    if (departmentId) {
      and.push({
        quiz: { classSection: { course: { departmentId } } },
      });
    }
    if (courseId) {
      and.push({ quiz: { classSection: { courseId } } });
    }
    if (academicYear) {
      and.push({ quiz: { classSection: { academicYear } } });
    }
    if (semester) {
      and.push({ quiz: { classSection: { semester } } });
    }
    if (teacherId) {
      and.push({ quiz: { teacherId } });
    }

    const where: Prisma.QuizAttemptWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.quizAttempt.count({ where }),
      prisma.quizAttempt.findMany({
        where,
        include: adminAttemptInclude,
        orderBy: [
          { submittedForApprovalAt: "desc" },
          { submittedAt: "desc" },
        ],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((row) =>
        serializeAttempt(row, { revealScore: true })
      ),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

quizzesRouter.get(
  "/quiz-attempts/:id",
  requirePermission(Permission.GRADES_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.quizAttempt.findUnique({
      where: { id },
      include: adminAttemptInclude,
    });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Quiz attempt not found");
    }
    return res.json(serializeAttempt(row, { revealScore: true }));
  }
);

quizzesRouter.post(
  "/quiz-attempts/:id/approve",
  requirePermission(Permission.GRADES_APPROVE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const admin = await resolveAdmin(req.user!.id);
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }

    const row = await prisma.quizAttempt.findUnique({ where: { id } });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Quiz attempt not found");
    }
    if (row.gradeStatus !== "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only pending quiz attempts can be approved"
      );
    }

    const updated = await prisma.quizAttempt.update({
      where: { id },
      data: {
        gradeStatus: "APPROVED",
        approvedAt: new Date(),
        approvedById: admin.id,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      },
      include: adminAttemptInclude,
    });

    const studentUser = await prisma.student.findUnique({
      where: { id: updated.studentId },
      select: { userId: true },
    });
    if (studentUser) {
      await notifyQuizGradeApproved({
        attemptId: updated.id,
        studentUserId: studentUser.userId,
        quizTitle: updated.quiz?.title ?? "Quiz",
      }).catch((err) => console.error("notifyQuizGradeApproved", err));
    }

    return res.json(serializeAttempt(updated, { revealScore: true }));
  }
);

quizzesRouter.post(
  "/quiz-attempts/:id/return",
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

    const row = await prisma.quizAttempt.findUnique({ where: { id } });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Quiz attempt not found");
    }
    if (row.gradeStatus !== "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only pending quiz attempts can be returned"
      );
    }

    const updated = await prisma.quizAttempt.update({
      where: { id },
      data: {
        gradeStatus: "RETURNED",
        returnedAt: new Date(),
        returnedById: admin.id,
        returnReason: parsed.data.reason?.trim() || null,
        approvedAt: null,
        approvedById: null,
      },
      include: adminAttemptInclude,
    });

    return res.json(serializeAttempt(updated, { revealScore: true }));
  }
);

/** Teacher: add question (DRAFT only) */
quizzesRouter.post(
  "/quizzes/:id/questions",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const quizId = paramId(req.params.id);
    const parsed = questionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid question payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const loaded = await loadOwnedQuiz(quizId, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }
    if (loaded.quiz.status !== "DRAFT") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Questions can only be modified while the quiz is DRAFT"
      );
    }

    const maxOrder = await prisma.quizQuestion.aggregate({
      where: { quizId },
      _max: { orderIndex: true },
    });
    const orderIndex =
      parsed.data.orderIndex ?? (maxOrder._max.orderIndex ?? -1) + 1;

    const createData = buildQuestionCreateData(quizId, parsed.data, orderIndex);
    await prisma.quizQuestion.create({ data: createData });
    await recalculateQuizTotalMarks(quizId);

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: quizIncludeTeacher,
    });
    return res
      .status(201)
      .json(serializeQuiz(quiz!, { includeAnswerKey: true }));
  }
);

/** Teacher: update question (DRAFT only) */
quizzesRouter.patch(
  "/quizzes/:id/questions/:questionId",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const quizId = paramId(req.params.id);
    const questionId = paramId(req.params.questionId);
    const parsed = questionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid question payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const loaded = await loadOwnedQuiz(quizId, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }
    if (loaded.quiz.status !== "DRAFT") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Questions can only be modified while the quiz is DRAFT"
      );
    }

    const existing = await prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId },
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Question not found");
    }

    const orderIndex = parsed.data.orderIndex ?? existing.orderIndex;
    const next = buildQuestionCreateData(quizId, parsed.data, orderIndex);

    await prisma.$transaction(async (tx) => {
      await tx.quizChoice.deleteMany({ where: { questionId } });
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: {
          type: next.type,
          prompt: next.prompt,
          marks: next.marks,
          orderIndex: next.orderIndex,
          correctBoolean: next.correctBoolean,
          acceptedAnswersJson: next.acceptedAnswersJson,
          ...(next.choices
            ? {
                choices: {
                  create: next.choices.create,
                },
              }
            : {}),
        },
      });
    });

    await recalculateQuizTotalMarks(quizId);

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: quizIncludeTeacher,
    });
    return res.json(serializeQuiz(quiz!, { includeAnswerKey: true }));
  }
);

/** Teacher: delete question (DRAFT only) */
quizzesRouter.delete(
  "/quizzes/:id/questions/:questionId",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const quizId = paramId(req.params.id);
    const questionId = paramId(req.params.questionId);

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const loaded = await loadOwnedQuiz(quizId, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }
    if (loaded.quiz.status !== "DRAFT") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Questions can only be modified while the quiz is DRAFT"
      );
    }

    const existing = await prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId },
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Question not found");
    }

    await prisma.quizQuestion.delete({ where: { id: questionId } });
    await recalculateQuizTotalMarks(quizId);

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: quizIncludeTeacher,
    });
    return res.json(serializeQuiz(quiz!, { includeAnswerKey: true }));
  }
);

/** Teacher: status transitions */
quizzesRouter.patch(
  "/quizzes/:id/status",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const statusParsed = quizStatusSchema.safeParse(req.body?.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid quiz status");
    }

    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const loaded = await loadOwnedQuiz(id, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }

    const current = loaded.quiz.status;
    const next = statusParsed.data;

    const allowed: Record<string, string[]> = {
      DRAFT: ["PUBLISHED"],
      PUBLISHED: ["CLOSED"],
      CLOSED: ["ARCHIVED", "DRAFT"],
      ARCHIVED: [],
    };

    if (current === next) {
      return res.json(
        serializeQuiz(loaded.quiz, { includeAnswerKey: true })
      );
    }

    if (!allowed[current]?.includes(next)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        `Cannot transition quiz from ${current} to ${next}`
      );
    }

    if (next === "PUBLISHED") {
      if (loaded.quiz.questions.length < 1) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "Publish requires at least one question"
        );
      }
      for (const q of loaded.quiz.questions) {
        const err = questionIsPublishable(q);
        if (err) {
          return sendError(res, 400, "BAD_REQUEST", err);
        }
      }
      if (loaded.quiz.totalMarks <= 0) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "Publish requires totalMarks > 0"
        );
      }
      if (loaded.quiz.durationMinutes <= 0) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "Publish requires durationMinutes > 0"
        );
      }
      if (
        !availabilityWindowValid(
          loaded.quiz.availableFrom,
          loaded.quiz.availableUntil
        )
      ) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "availableFrom must be before availableUntil"
        );
      }
    }

    const updated = await prisma.quiz.update({
      where: { id },
      data: { status: next },
      include: quizIncludeTeacher,
    });

    if (next === "PUBLISHED" && current !== "PUBLISHED") {
      await notifyQuizPublished({
        id: updated.id,
        title: updated.title,
        classSectionId: updated.classSectionId,
      }).catch((err) => console.error("notifyQuizPublished", err));
    }

    return res.json(serializeQuiz(updated, { includeAnswerKey: true }));
  }
);

/** Student: start attempt */
quizzesRouter.post(
  "/quizzes/:id/attempts",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const quizId = paramId(req.params.id);
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    if (student.user.status !== "ACTIVE") {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "Inactive students cannot take quizzes"
      );
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const quiz = await tx.quiz.findUnique({
          where: { id: quizId },
          include: {
            classSection: { select: { id: true, status: true } },
          },
        });
        if (!quiz || quiz.status !== "PUBLISHED") {
          throw Object.assign(new Error("Quiz not found"), {
            httpStatus: 404,
            code: "NOT_FOUND" as const,
          });
        }
        if (!quizAvailableNow(quiz)) {
          throw Object.assign(new Error("Quiz is not available now"), {
            httpStatus: 403,
            code: "FORBIDDEN" as const,
          });
        }

        const enrollment = await tx.enrollment.findFirst({
          where: {
            studentId: student.id,
            classSectionId: quiz.classSectionId,
            status: "ACTIVE",
          },
        });
        if (!enrollment) {
          throw Object.assign(new Error("You are not enrolled in this class"), {
            httpStatus: 403,
            code: "FORBIDDEN" as const,
          });
        }

        const inProgress = await tx.quizAttempt.findFirst({
          where: {
            quizId,
            studentId: student.id,
            status: "IN_PROGRESS",
          },
        });
        if (inProgress) {
          throw Object.assign(
            new Error("You already have an in-progress attempt"),
            { httpStatus: 409, code: "CONFLICT" as const }
          );
        }

        const attemptCount = await tx.quizAttempt.count({
          where: {
            quizId,
            studentId: student.id,
            status: { not: "CANCELLED" },
          },
        });
        if (attemptCount >= quiz.maxAttempts) {
          throw Object.assign(
            new Error("Maximum attempts reached for this quiz"),
            { httpStatus: 409, code: "CONFLICT" as const }
          );
        }

        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + quiz.durationMinutes * 60_000
        );

        return tx.quizAttempt.create({
          data: {
            quizId,
            studentId: student.id,
            attemptNumber: attemptCount + 1,
            status: "IN_PROGRESS",
            startedAt: now,
            expiresAt,
            gradeStatus: "NOT_GRADED",
          },
          include: attemptInclude,
        });
      });

      return res.status(201).json(
        serializeAttempt(created, {
          studentView: true,
          revealScore: false,
        })
      );
    } catch (err) {
      const e = err as {
        httpStatus?: number;
        code?: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";
        message?: string;
      };
      if (e.httpStatus && e.code) {
        return sendError(res, e.httpStatus, e.code, e.message ?? "Error");
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Could not start attempt due to a concurrent request"
        );
      }
      throw err;
    }
  }
);

/** Get quiz by id — teacher/admin with keys; enrolled student without */
quizzesRouter.get("/quizzes/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const row = await prisma.quiz.findUnique({
    where: { id },
    include: quizIncludeTeacher,
  });
  if (!row) {
    return sendError(res, 404, "NOT_FOUND", "Quiz not found");
  }

  const role = req.user!.role;

  if (role === "ADMIN") {
    return res.json(serializeQuiz(row, { includeAnswerKey: true }));
  }

  if (role === "TEACHER") {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.id !== row.teacherId) {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }
    return res.json(serializeQuiz(row, { includeAnswerKey: true }));
  }

  if (role === "STUDENT") {
    if (row.status !== "PUBLISHED") {
      return sendError(res, 404, "NOT_FOUND", "Quiz not found");
    }
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    const enrolled = await assertStudentEnrolled(
      student.id,
      row.classSectionId
    );
    if (!enrolled.ok) {
      return sendError(res, 404, "NOT_FOUND", "Quiz not found");
    }
    if (!quizAvailableNow(row)) {
      return sendError(res, 403, "FORBIDDEN", "Quiz is not available now");
    }
    return res.json(
      serializeQuiz(row, { studentView: true, includeAnswerKey: false })
    );
  }

  return sendError(res, 403, "FORBIDDEN", "Not allowed");
});

/** Teacher: patch quiz settings */
quizzesRouter.patch(
  "/quizzes/:id",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const parsed = patchQuizSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid quiz payload");
    }

    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const loaded = await loadOwnedQuiz(id, teacher.id);
    if (!loaded.ok) {
      return sendError(res, loaded.status, loaded.code, loaded.message);
    }

    if (loaded.quiz.status === "ARCHIVED") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Archived quizzes cannot be edited"
      );
    }

    const data = parsed.data;

    if (loaded.quiz.status === "PUBLISHED") {
      const forbiddenKeys = [
        "title",
        "durationMinutes",
        "availableFrom",
        "availableUntil",
        "maxAttempts",
        "shuffleQuestions",
        "shuffleChoices",
        "assessmentType",
      ] as const;
      for (const key of forbiddenKeys) {
        if (data[key] !== undefined) {
          return sendError(
            res,
            409,
            "CONFLICT",
            "Published quizzes only allow description, instructions, and showResultAfterSubmit updates"
          );
        }
      }
    }

    const from = parseOptionalDate(data.availableFrom, "availableFrom");
    if (!from.ok) return sendError(res, 400, "BAD_REQUEST", from.message);
    const until = parseOptionalDate(data.availableUntil, "availableUntil");
    if (!until.ok) return sendError(res, 400, "BAD_REQUEST", until.message);

    const nextFrom =
      from.date === undefined ? loaded.quiz.availableFrom : from.date;
    const nextUntil =
      until.date === undefined ? loaded.quiz.availableUntil : until.date;
    if (!availabilityWindowValid(nextFrom, nextUntil)) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "availableFrom must be before availableUntil"
      );
    }

    const updated = await prisma.quiz.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        durationMinutes: data.durationMinutes,
        availableFrom: from.date,
        availableUntil: until.date,
        maxAttempts: data.maxAttempts,
        shuffleQuestions: data.shuffleQuestions,
        shuffleChoices: data.shuffleChoices,
        showResultAfterSubmit: data.showResultAfterSubmit,
        assessmentType: data.assessmentType,
      },
      include: quizIncludeTeacher,
    });

    return res.json(serializeQuiz(updated, { includeAnswerKey: true }));
  }
);

/** Teacher: hard-delete DRAFT only */
quizzesRouter.delete(
  "/quizzes/:id",
  requireRoles("TEACHER"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const existing = await prisma.quiz.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Quiz not found");
    }
    if (existing.teacherId !== teacher.id) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You can only delete your own quizzes"
      );
    }
    if (existing.status !== "DRAFT") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only DRAFT quizzes can be deleted; use status to archive"
      );
    }

    await prisma.quiz.delete({ where: { id } });
    return res.json({ ok: true, deleted: true, id });
  }
);

/** Get attempt — owner student, quiz teacher, or admin */
quizzesRouter.get("/attempts/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const row = await prisma.quizAttempt.findUnique({
    where: { id },
    include: attemptInclude,
  });
  if (!row) {
    return sendError(res, 404, "NOT_FOUND", "Attempt not found");
  }

  const role = req.user!.role;

  if (role === "ADMIN") {
    return res.json(
      serializeAttempt(row, {
        revealScore: revealScoreForViewer(
          role,
          row.gradeStatus,
          row.status
        ),
      })
    );
  }

  if (role === "TEACHER") {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher || teacher.id !== row.quiz.teacherId) {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }
    return res.json(
      serializeAttempt(row, {
        revealScore: revealScoreForViewer(
          role,
          row.gradeStatus,
          row.status
        ),
      })
    );
  }

  if (role === "STUDENT") {
    const student = await resolveStudent(req.user!.id);
    if (!student || student.id !== row.studentId) {
      return sendError(res, 403, "FORBIDDEN", "Not allowed");
    }
    return res.json(
      serializeAttempt(row, {
        studentView: true,
        revealScore: revealScoreForViewer(
          role,
          row.gradeStatus,
          row.status
        ),
      })
    );
  }

  return sendError(res, 403, "FORBIDDEN", "Not allowed");
});

/** Student: upsert answers while IN_PROGRESS */
quizzesRouter.patch(
  "/attempts/:id/answers",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const parsed = answersBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid answers payload");
    }

    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const attempt = await tx.quizAttempt.findUnique({
          where: { id },
          include: {
            quiz: {
              include: {
                questions: {
                  include: { choices: { select: { id: true } } },
                },
              },
            },
          },
        });
        if (!attempt) {
          throw Object.assign(new Error("Attempt not found"), {
            httpStatus: 404,
            code: "NOT_FOUND" as const,
          });
        }
        if (attempt.studentId !== student.id) {
          throw Object.assign(new Error("Not allowed"), {
            httpStatus: 403,
            code: "FORBIDDEN" as const,
          });
        }
        if (attempt.status !== "IN_PROGRESS") {
          throw Object.assign(
            new Error("Answers can only be updated on in-progress attempts"),
            { httpStatus: 409, code: "CONFLICT" as const }
          );
        }

        const now = new Date();
        if (attempt.expiresAt && now > attempt.expiresAt) {
          const finalized = await finalizeAttemptInTx(
            tx,
            attempt.id,
            attempt.quizId,
            "EXPIRED"
          );
          return { kind: "expired" as const, row: finalized };
        }

        const questionById = new Map(
          attempt.quiz.questions.map((q) => [q.id, q])
        );

        for (const ans of parsed.data.answers) {
          const question = questionById.get(ans.questionId);
          if (!question) {
            throw Object.assign(
              new Error("Answer references a question not on this quiz"),
              { httpStatus: 400, code: "BAD_REQUEST" as const }
            );
          }
          if (ans.choiceId) {
            const ok = question.choices.some((c) => c.id === ans.choiceId);
            if (!ok) {
              throw Object.assign(
                new Error("choiceId does not belong to the question"),
                { httpStatus: 400, code: "BAD_REQUEST" as const }
              );
            }
          }

          await tx.quizAnswer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: attempt.id,
                questionId: ans.questionId,
              },
            },
            create: {
              attemptId: attempt.id,
              questionId: ans.questionId,
              choiceId: ans.choiceId ?? null,
              answerText: ans.answerText?.trim()
                ? ans.answerText.trim()
                : null,
            },
            update: {
              choiceId: ans.choiceId ?? null,
              answerText: ans.answerText?.trim()
                ? ans.answerText.trim()
                : null,
            },
          });
        }

        const updated = await tx.quizAttempt.findUnique({
          where: { id: attempt.id },
          include: attemptInclude,
        });
        return { kind: "ok" as const, row: updated! };
      });

      if (result.kind === "expired") {
        return res.status(409).json({
          error: "Attempt expired and was finalized",
          code: "CONFLICT",
          attempt: serializeAttempt(result.row, {
            studentView: true,
            revealScore: false,
          }),
        });
      }

      return res.json(
        serializeAttempt(result.row, {
          studentView: true,
          revealScore: false,
        })
      );
    } catch (err) {
      const e = err as {
        httpStatus?: number;
        code?: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";
        message?: string;
      };
      if (e.httpStatus && e.code) {
        return sendError(res, e.httpStatus, e.code, e.message ?? "Error");
      }
      throw err;
    }
  }
);

/** Student: submit attempt */
quizzesRouter.post(
  "/attempts/:id/submit",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const bodyAnswers = z
      .object({
        answers: answersBodySchema.shape.answers.optional(),
      })
      .safeParse(req.body ?? {});
    if (!bodyAnswers.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid submit payload");
    }

    try {
      const finalized = await prisma.$transaction(async (tx) => {
        const attempt = await tx.quizAttempt.findUnique({
          where: { id },
          include: {
            quiz: {
              include: {
                questions: {
                  include: { choices: { select: { id: true } } },
                },
              },
            },
          },
        });
        if (!attempt) {
          throw Object.assign(new Error("Attempt not found"), {
            httpStatus: 404,
            code: "NOT_FOUND" as const,
          });
        }
        if (attempt.studentId !== student.id) {
          throw Object.assign(new Error("Not allowed"), {
            httpStatus: 403,
            code: "FORBIDDEN" as const,
          });
        }
        if (attempt.status !== "IN_PROGRESS") {
          throw Object.assign(
            new Error("Attempt has already been submitted"),
            { httpStatus: 409, code: "CONFLICT" as const }
          );
        }

        if (bodyAnswers.data.answers?.length) {
          const questionById = new Map(
            attempt.quiz.questions.map((q) => [q.id, q])
          );
          for (const ans of bodyAnswers.data.answers) {
            const question = questionById.get(ans.questionId);
            if (!question) {
              throw Object.assign(
                new Error("Answer references a question not on this quiz"),
                { httpStatus: 400, code: "BAD_REQUEST" as const }
              );
            }
            if (ans.choiceId) {
              const ok = question.choices.some((c) => c.id === ans.choiceId);
              if (!ok) {
                throw Object.assign(
                  new Error("choiceId does not belong to the question"),
                  { httpStatus: 400, code: "BAD_REQUEST" as const }
                );
              }
            }
            await tx.quizAnswer.upsert({
              where: {
                attemptId_questionId: {
                  attemptId: attempt.id,
                  questionId: ans.questionId,
                },
              },
              create: {
                attemptId: attempt.id,
                questionId: ans.questionId,
                choiceId: ans.choiceId ?? null,
                answerText: ans.answerText?.trim()
                  ? ans.answerText.trim()
                  : null,
              },
              update: {
                choiceId: ans.choiceId ?? null,
                answerText: ans.answerText?.trim()
                  ? ans.answerText.trim()
                  : null,
              },
            });
          }
        }

        const now = new Date();
        const expired = Boolean(
          attempt.expiresAt && now > attempt.expiresAt
        );

        return finalizeAttemptInTx(
          tx,
          attempt.id,
          attempt.quizId,
          expired ? "EXPIRED" : "SUBMITTED"
        );
      });

      return res.json(
        serializeAttempt(finalized, {
          studentView: true,
          revealScore: revealScoreForViewer(
            "STUDENT",
            finalized.gradeStatus,
            finalized.status
          ),
        })
      );
    } catch (err) {
      const e = err as {
        httpStatus?: number;
        code?: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";
        message?: string;
      };
      if (e.httpStatus && e.code) {
        return sendError(res, e.httpStatus, e.code, e.message ?? "Error");
      }
      throw err;
    }
  }
);
