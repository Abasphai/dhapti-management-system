import type { AssessmentComponentType, Prisma } from "@prisma/client";

import { validateWeightsForCalculation } from "./assessmentWeights.js";
import {
  evaluateBiuMarks,
  type BiuComponentMarks,
} from "./gradingPolicy.js";
import { lookupGradeFromScore } from "./gradingScale.js";
import { prisma } from "./prisma.js";

export const RESULT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["CALCULATED"],
  CALCULATED: ["PENDING_APPROVAL", "DRAFT"],
  PENDING_APPROVAL: ["APPROVED", "RETURNED"],
  RETURNED: ["CALCULATED", "PENDING_APPROVAL"],
  APPROVED: [],
  REJECTED: ["CALCULATED"],
  CORRECTION_REQUESTED: ["CALCULATED"],
};

export function isResultImmutable(status: string) {
  return status === "APPROVED";
}

export function canTeacherEditResult(status: string) {
  return (
    status === "DRAFT" ||
    status === "CALCULATED" ||
    status === "RETURNED" ||
    status === "REJECTED" ||
    status === "CORRECTION_REQUESTED"
  );
}

type ComponentBreakdown = {
  componentType: AssessmentComponentType;
  weightPercent: number;
  componentAverage: number | null;
  weightedScore: number | null;
  sampleCount: number;
  error?: string;
};

/**
 * Compute numeric final % for one enrollment from APPROVED assessments
 * and ClassSection weights. Does not invent weights or letter grades.
 */
export async function calculateFinalNumericForEnrollment(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { id: true } },
      classSection: {
        include: {
          course: { select: { id: true, credits: true, code: true, title: true } },
          teacher: { select: { id: true } },
        },
      },
    },
  });
  if (!enrollment) {
    return { ok: false as const, code: "NOT_FOUND", message: "Enrollment not found" };
  }
  if (enrollment.status === "DROPPED") {
    return {
      ok: false as const,
      code: "BAD_REQUEST",
      message: "Cannot calculate results for DROPPED enrollments",
    };
  }

  const classSectionId = enrollment.classSectionId;
  const studentId = enrollment.studentId;
  const weights = await validateWeightsForCalculation(classSectionId);
  if (weights.ok === false) {
    return {
      ok: false as const,
      code: weights.code,
      message: weights.message,
    };
  }

  const breakdown: ComponentBreakdown[] = [];
  let finalPercentage = 0;

  for (const w of weights.weights) {
    const component = await averageApprovedComponent(
      w.componentType,
      classSectionId,
      studentId
    );
    if (component.error) {
      return {
        ok: false as const,
        code: "CALCULATION_INCOMPLETE",
        message: component.error,
      };
    }
    const weighted =
      component.average == null
        ? null
        : (component.average * w.weightPercent) / 100;
    if (weighted == null) {
      return {
        ok: false as const,
        code: "CALCULATION_INCOMPLETE",
        message: `No approved ${w.componentType} scores for this student; cannot apply weight ${w.weightPercent}%.`,
      };
    }
    finalPercentage += weighted;
    breakdown.push({
      componentType: w.componentType,
      weightPercent: w.weightPercent,
      componentAverage: component.average,
      weightedScore: round1(weighted),
      sampleCount: component.count,
    });
  }

  finalPercentage = round1(finalPercentage);
  const gradeLookup = await lookupGradeFromScore(finalPercentage);
  const creditHours = enrollment.classSection.course.credits;

  return {
    ok: true as const,
    enrollment,
    marks: finalPercentage,
    maxMarks: 100,
    creditHours,
    letterGrade: gradeLookup.letterGrade,
    gradePoint: gradeLookup.gradePoint,
    gradeScaleConfigured: gradeLookup.configured,
    breakdown,
  };
}

async function averageApprovedComponent(
  type: AssessmentComponentType,
  classSectionId: string,
  studentId: string
): Promise<{ average: number | null; count: number; error?: string }> {
  if (type === "ASSIGNMENT") {
    const rows = await prisma.submission.findMany({
      where: {
        studentId,
        gradeStatus: "APPROVED",
        assignment: { classSectionId, status: "PUBLISHED" },
      },
      include: { assignment: { select: { maxMarks: true } } },
    });
    if (!rows.length) return { average: null, count: 0 };
    const pcts = rows.map((r) => {
      const max = r.assignment.maxMarks || 100;
      return max > 0 && r.score != null ? (r.score / max) * 100 : null;
    });
    if (pcts.some((p) => p == null)) {
      return {
        average: null,
        count: rows.length,
        error: "Approved assignment scores are incomplete",
      };
    }
    const avg =
      (pcts as number[]).reduce((s, p) => s + p, 0) / pcts.length;
    return { average: round1(avg), count: rows.length };
  }

  if (type === "QUIZ") {
    const rows = await prisma.quizAttempt.findMany({
      where: {
        studentId,
        gradeStatus: "APPROVED",
        status: "SUBMITTED",
        quiz: { classSectionId },
      },
      include: { quiz: { select: { totalMarks: true } } },
    });
    if (!rows.length) return { average: null, count: 0 };
    const pcts = rows.map((r) => {
      const max = r.quiz.totalMarks || 0;
      return max > 0 && r.score != null ? (r.score / max) * 100 : null;
    });
    if (pcts.some((p) => p == null)) {
      return {
        average: null,
        count: rows.length,
        error: "Approved quiz scores are incomplete",
      };
    }
    const avg =
      (pcts as number[]).reduce((s, p) => s + p, 0) / pcts.length;
    return { average: round1(avg), count: rows.length };
  }

  // Exam/midterm/final/other: no assessment source in Phase 1K
  return {
    average: null,
    count: 0,
    error: `Component ${type} has no assessment source in Phase 1K. Remove its weight or wait for exam module.`,
  };
}

/** Upsert calculated ResultEntry for an enrollment (teacher-owned section). */
export async function upsertCalculatedResult(input: {
  enrollmentId: string;
  teacherId: string;
}) {
  const calc = await calculateFinalNumericForEnrollment(input.enrollmentId);
  if (!calc.ok) return calc;

  if (calc.enrollment.classSection.teacherId !== input.teacherId) {
    return {
      ok: false as const,
      code: "FORBIDDEN",
      message: "You do not own this class section",
    };
  }

  const existing = await prisma.resultEntry.findUnique({
    where: { enrollmentId: input.enrollmentId },
  });
  if (existing && isResultImmutable(existing.status)) {
    return {
      ok: false as const,
      code: "CONFLICT",
      message: "Approved results are immutable",
    };
  }
  if (existing && !canTeacherEditResult(existing.status)) {
    return {
      ok: false as const,
      code: "CONFLICT",
      message: `Cannot recalculate while status is ${existing.status}`,
    };
  }

  const data = {
    enrollmentId: input.enrollmentId,
    studentId: calc.enrollment.studentId,
    classSectionId: calc.enrollment.classSectionId,
    courseId: calc.enrollment.classSection.courseId,
    teacherId: input.teacherId,
    marks: calc.marks,
    maxMarks: calc.maxMarks,
    creditHours: calc.creditHours,
    letterGrade: calc.letterGrade,
    gradePoint: calc.gradePoint,
    status: "CALCULATED" as const,
    calculationJson: JSON.stringify({
      breakdown: calc.breakdown,
      gradeScaleConfigured: calc.gradeScaleConfigured,
    }),
    calculatedAt: new Date(),
    submittedAt: null,
    approvedAt: null,
    approvedById: null,
    returnedAt: null,
    returnedById: null,
    returnReason: null,
  };

  const row = existing
    ? await prisma.resultEntry.update({
        where: { id: existing.id },
        data,
        include: resultInclude,
      })
    : await prisma.resultEntry.create({
        data,
        include: resultInclude,
      });

  return { ok: true as const, result: row, gradeScaleConfigured: calc.gradeScaleConfigured };
}

/**
 * Upsert course ResultEntry from official Dhapti component marks (absolute /100).
 * Computes total, letter grade, and grade point before persist.
 */
export async function upsertBiuGradedResult(input: {
  enrollmentId: string;
  teacherId: string;
  components: {
    midterm: number;
    finalExam: number;
    quiz: number;
    attendance: number;
    presentation: number;
    assignment?: number;
    assignmentScores?: number[];
  };
  teacherNote?: string | null;
}) {
  const { getSystemSettings } = await import("./settings.js");
  const settings = await getSystemSettings();
  const evaluated = evaluateBiuMarks({
    ...input.components,
    passingCutoff: settings.passingGradeCutoff,
  });
  if (evaluated.ok === false) {
    return {
      ok: false as const,
      code: "BAD_REQUEST" as const,
      message: evaluated.message,
    };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: input.enrollmentId },
    include: {
      classSection: {
        include: {
          course: {
            select: { id: true, credits: true, code: true, title: true },
          },
        },
      },
    },
  });
  if (!enrollment) {
    return {
      ok: false as const,
      code: "NOT_FOUND" as const,
      message: "Enrollment not found",
    };
  }
  if (enrollment.status === "DROPPED") {
    return {
      ok: false as const,
      code: "BAD_REQUEST" as const,
      message: "Cannot grade DROPPED enrollments",
    };
  }
  if (enrollment.classSection.teacherId !== input.teacherId) {
    return {
      ok: false as const,
      code: "FORBIDDEN" as const,
      message: "You do not own this class section",
    };
  }

  const existing = await prisma.resultEntry.findUnique({
    where: { enrollmentId: input.enrollmentId },
  });
  if (existing && isResultImmutable(existing.status)) {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: "Approved results are immutable",
    };
  }
  if (existing && !canTeacherEditResult(existing.status)) {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Cannot grade while status is ${existing.status}`,
    };
  }

  const components: BiuComponentMarks = evaluated.components;
  const data = {
    enrollmentId: input.enrollmentId,
    studentId: enrollment.studentId,
    classSectionId: enrollment.classSectionId,
    courseId: enrollment.classSection.courseId,
    teacherId: input.teacherId,
    marks: evaluated.total,
    maxMarks: 100,
    creditHours: enrollment.classSection.course.credits,
    letterGrade: evaluated.letterGrade,
    gradePoint: evaluated.gradePoint,
    status: "CALCULATED" as const,
    teacherNote: input.teacherNote ?? existing?.teacherNote ?? null,
    calculationJson: JSON.stringify({
      policy: "DHAPTI",
      gradeScaleConfigured: true,
      components,
      breakdown: [
        {
          componentType: "MIDTERM",
          max: 30,
          score: components.midterm,
        },
        {
          componentType: "FINAL_EXAM",
          max: 40,
          score: components.finalExam,
        },
        {
          componentType: "ASSIGNMENT",
          max: 5,
          score: components.assignment,
        },
        {
          componentType: "QUIZ",
          max: 10,
          score: components.quiz,
        },
        {
          componentType: "PRESENTATION",
          max: 5,
          score: components.presentation,
        },
        {
          componentType: "ATTENDANCE",
          max: 10,
          score: components.attendance,
        },
      ],
    }),
    calculatedAt: new Date(),
    submittedAt: null,
    approvedAt: null,
    approvedById: null,
    returnedAt: null,
    returnedById: null,
    returnReason: null,
  };

  const row = existing
    ? await prisma.resultEntry.update({
        where: { id: existing.id },
        data,
        include: resultInclude,
      })
    : await prisma.resultEntry.create({
        data,
        include: resultInclude,
      });

  return {
    ok: true as const,
    result: row,
    gradeScaleConfigured: true as const,
    components,
    total: evaluated.total,
    letterGrade: evaluated.letterGrade,
    gradePoint: evaluated.gradePoint,
  };
}

export const resultInclude = {
  enrollment: { select: { id: true, status: true } },
  student: {
    select: {
      id: true,
      studentCode: true,
      fullName: true,
      facultyId: true,
      departmentId: true,
    },
  },
  course: {
    select: { id: true, code: true, title: true, credits: true },
  },
  classSection: {
    select: {
      id: true,
      section: true,
      academicYear: true,
      semester: true,
      teacherId: true,
      course: {
        select: {
          departmentId: true,
          facultyId: true,
          department: { select: { id: true, name: true, code: true } },
          faculty: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.ResultEntryInclude;

export type ResultWithRelations = Prisma.ResultEntryGetPayload<{
  include: typeof resultInclude;
}>;

export async function buildTranscript(studentId: string) {
  const results = await prisma.resultEntry.findMany({
    where: { studentId, status: "APPROVED" },
    include: resultInclude,
    orderBy: [
      { classSection: { academicYear: "asc" } },
      { classSection: { semester: "asc" } },
      { course: { code: "asc" } },
    ],
  });

  const terms = new Map<
    string,
    {
      academicYear: string;
      semester: string;
      courses: ResultWithRelations[];
      credits: number;
    }
  >();

  let totalCredits = 0;
  for (const r of results) {
    const key = `${r.classSection.academicYear}::${r.classSection.semester}`;
    const bucket = terms.get(key) ?? {
      academicYear: r.classSection.academicYear,
      semester: r.classSection.semester,
      courses: [],
      credits: 0,
    };
    bucket.courses.push(r);
    bucket.credits += r.creditHours;
    totalCredits += r.creditHours;
    terms.set(key, bucket);
  }

  return {
    terms: [...terms.values()],
    totalCredits,
    courseCount: results.length,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
