import type {
  GradeStatus,
  QuestionType,
  QuizAttemptStatus,
  QuizStatus,
} from "@prisma/client";

import { calcPercentage } from "./quizGrading.js";
import { uiGradeStatus } from "./serializeGrade.js";

export function uiQuizStatus(status: QuizStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Published";
    case "CLOSED":
      return "Closed";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

const classSectionSelect = {
  id: true,
  section: true,
  academicYear: true,
  semester: true,
  course: { select: { id: true, code: true, title: true } },
  teacher: { select: { id: true, fullName: true, facultyCode: true } },
} as const;

export const quizIncludeTeacher = {
  classSection: { select: classSectionSelect },
  questions: {
    orderBy: { orderIndex: "asc" as const },
    include: {
      choices: { orderBy: { orderIndex: "asc" as const } },
    },
  },
} as const;

export type ChoiceRow = {
  id: string;
  label: string;
  orderIndex: number;
  isCorrect: boolean;
};

export type QuestionRow = {
  id: string;
  type: QuestionType;
  prompt: string;
  marks: number;
  orderIndex: number;
  correctBoolean: boolean | null;
  acceptedAnswersJson: string | null;
  choices: ChoiceRow[];
};

/** Teacher/Admin: includes answer keys. */
export function serializeQuestionTeacher(q: QuestionRow) {
  let acceptedAnswers: string[] = [];
  if (q.acceptedAnswersJson) {
    try {
      const parsed = JSON.parse(q.acceptedAnswersJson) as unknown;
      if (Array.isArray(parsed)) {
        acceptedAnswers = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      acceptedAnswers = [];
    }
  }
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    marks: q.marks,
    orderIndex: q.orderIndex,
    correctBoolean: q.correctBoolean,
    acceptedAnswers,
    choices: q.choices.map((c) => ({
      id: c.id,
      label: c.label,
      orderIndex: c.orderIndex,
      isCorrect: c.isCorrect,
    })),
  };
}

/** Student taking quiz: NEVER expose isCorrect / acceptedAnswers / correctBoolean. */
export function serializeQuestionStudent(
  q: QuestionRow,
  options?: { shuffleChoices?: boolean }
) {
  let choices = q.choices.map((c) => ({
    id: c.id,
    label: c.label,
    orderIndex: c.orderIndex,
  }));
  if (options?.shuffleChoices) {
    choices = [...choices].sort(() => Math.random() - 0.5);
  }
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    marks: q.marks,
    orderIndex: q.orderIndex,
    choices,
  };
}

export function serializeQuiz(
  row: {
    id: string;
    classSectionId: string;
    teacherId: string;
    title: string;
    description: string | null;
    instructions: string | null;
    status: QuizStatus;
    totalMarks: number;
    durationMinutes: number;
    availableFrom: Date | null;
    availableUntil: Date | null;
    maxAttempts: number;
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
    showResultAfterSubmit: boolean;
    assessmentType: string;
    createdAt: Date;
    updatedAt: Date;
    classSection?: {
      id: string;
      section: string;
      academicYear: string;
      semester: string;
      course: { id: string; code: string; title: string };
      teacher: { id: string; fullName: string; facultyCode?: string };
    };
    questions?: QuestionRow[];
  },
  options?: { includeAnswerKey?: boolean; studentView?: boolean }
) {
  const cs = row.classSection;
  const includeKey = options?.includeAnswerKey === true;
  const studentView = options?.studentView === true;

  let questions = row.questions ?? [];
  if (row.shuffleQuestions && studentView) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }

  return {
    id: row.id,
    classSectionId: row.classSectionId,
    teacherId: row.teacherId,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    status: uiQuizStatus(row.status),
    accountStatus: row.status,
    totalMarks: row.totalMarks,
    durationMinutes: row.durationMinutes,
    availableFrom: row.availableFrom?.toISOString() ?? null,
    availableUntil: row.availableUntil?.toISOString() ?? null,
    maxAttempts: row.maxAttempts,
    shuffleQuestions: row.shuffleQuestions,
    shuffleChoices: row.shuffleChoices,
    showResultAfterSubmit: row.showResultAfterSubmit,
    assessmentType: row.assessmentType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    questionCount: questions.length,
    ...(cs
      ? {
          classSection: {
            id: cs.id,
            section: cs.section,
            academicYear: cs.academicYear,
            semester: cs.semester,
          },
          course: cs.course,
          courseCode: cs.course.code,
          courseTitle: cs.course.title,
          section: cs.section,
          academicYear: cs.academicYear,
          semester: cs.semester,
          teacherName: cs.teacher.fullName,
          teacher: {
            id: cs.teacher.id,
            name: cs.teacher.fullName,
            fullName: cs.teacher.fullName,
          },
        }
      : {}),
    ...(row.questions
      ? {
          questions: questions.map((q) =>
            includeKey && !studentView
              ? serializeQuestionTeacher(q)
              : serializeQuestionStudent(q, {
                  shuffleChoices: row.shuffleChoices && studentView,
                })
          ),
        }
      : {}),
  };
}

export function serializeAttempt(
  row: {
    id: string;
    quizId: string;
    studentId: string;
    attemptNumber: number;
    status: QuizAttemptStatus;
    startedAt: Date;
    expiresAt: Date | null;
    submittedAt: Date | null;
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
    gradeStatus: GradeStatus;
    needsManualReview: boolean;
    gradedAt: Date | null;
    submittedForApprovalAt: Date | null;
    approvedAt: Date | null;
    returnReason: string | null;
    quiz?: {
      id: string;
      title: string;
      totalMarks: number;
      showResultAfterSubmit: boolean;
      durationMinutes: number;
      classSection?: {
        section: string;
        academicYear: string;
        semester: string;
        course: { code: string; title: string };
        teacher: { fullName: string };
      };
    };
    student?: { id: string; studentCode: string; fullName: string };
    answers?: {
      questionId: string;
      choiceId: string | null;
      answerText: string | null;
    }[];
  },
  options?: {
    /** Reveal official score (APPROVED, or showResultAfterSubmit after submit — still no answer key). */
    revealScore?: boolean;
    studentView?: boolean;
  }
) {
  const revealScore = options?.revealScore === true;
  const studentView = options?.studentView === true;
  const now = Date.now();
  const remainingMs =
    row.status === "IN_PROGRESS" && row.expiresAt
      ? Math.max(0, row.expiresAt.getTime() - now)
      : null;

  return {
    id: row.id,
    quizId: row.quizId,
    studentId: row.studentId,
    attemptNumber: row.attemptNumber,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    remainingSeconds:
      remainingMs != null ? Math.ceil(remainingMs / 1000) : null,
    gradeStatus: row.gradeStatus,
    gradeUiStatus: uiGradeStatus(row.gradeStatus),
    needsManualReview: studentView ? undefined : row.needsManualReview,
    returnReason: studentView ? null : row.returnReason,
    ...(revealScore
      ? {
          score: row.score,
          maxScore: row.maxScore,
          percentage:
            row.percentage ??
            calcPercentage(row.score ?? 0, row.maxScore ?? 0),
        }
      : {
          score: null,
          maxScore: null,
          percentage: null,
        }),
    ...(row.quiz
      ? {
          quizTitle: row.quiz.title,
          quiz: {
            id: row.quiz.id,
            title: row.quiz.title,
            totalMarks: row.quiz.totalMarks,
            durationMinutes: row.quiz.durationMinutes,
            showResultAfterSubmit: row.quiz.showResultAfterSubmit,
          },
          ...(row.quiz.classSection
            ? {
                courseCode: row.quiz.classSection.course.code,
                courseTitle: row.quiz.classSection.course.title,
                section: row.quiz.classSection.section,
                teacherName: row.quiz.classSection.teacher.fullName,
                academicYear: row.quiz.classSection.academicYear,
                semester: row.quiz.classSection.semester,
              }
            : {}),
        }
      : {}),
    ...(row.student
      ? {
          studentCode: row.student.studentCode,
          studentName: row.student.fullName,
          student: {
            id: row.student.id,
            studentCode: row.student.studentCode,
            name: row.student.fullName,
            fullName: row.student.fullName,
          },
        }
      : {}),
    ...(row.answers
      ? {
          answers: row.answers.map((a) => ({
            questionId: a.questionId,
            choiceId: a.choiceId,
            answerText: a.answerText,
          })),
        }
      : {}),
  };
}

export function serializeQuizResult(row: {
  id: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  attemptNumber: number;
  submittedAt: Date | null;
  approvedAt: Date | null;
  gradeStatus: GradeStatus;
  quiz: {
    id: string;
    title: string;
    assessmentType: string;
    classSection: {
      section: string;
      academicYear: string;
      semester: string;
      teacher: { fullName: string };
      course: { code: string; title: string };
    };
  };
}) {
  const cs = row.quiz.classSection;
  return {
    id: row.id,
    assessmentType: row.quiz.assessmentType || "QUIZ",
    assessmentTitle: row.quiz.title,
    quizId: row.quiz.id,
    attemptNumber: row.attemptNumber,
    courseCode: cs.course.code,
    courseTitle: cs.course.title,
    section: cs.section,
    teacherName: cs.teacher.fullName,
    score: row.score,
    maxMarks: row.maxScore,
    percentage: row.percentage,
    feedback: null as string | null,
    status: "Approved",
    gradeStatus: "APPROVED" as const,
    academicYear: cs.academicYear,
    semester: cs.semester,
    gradedAt: null as string | null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}
