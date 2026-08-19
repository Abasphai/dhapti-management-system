import { calcAttendancePercentage } from "./attendanceCalc.js";
import { getStudentFinancialHold } from "./financialHold.js";
import { prisma } from "./prisma.js";

export const MIN_EXAM_ATTENDANCE_PERCENT = 75;

export type ClearanceCriterion = {
  key: "attendance" | "finance";
  met: boolean;
  label: string;
  detail: string;
};

export type ClearanceEvaluation = {
  status: "CLEARED" | "HELD";
  attendancePercent: number | null;
  pendingDues: number;
  hasOverdue: boolean;
  criteria: ClearanceCriterion[];
  blockers: string[];
  manualOverride: boolean;
  overrideReason: string | null;
};

/** Overall attendance across all marked sessions for the student. */
export async function getStudentOverallAttendancePercent(
  studentId: string
): Promise<number | null> {
  const rows = await prisma.studentAttendance.groupBy({
    by: ["status"],
    where: { studentId },
    _count: { _all: true },
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  for (const row of rows) {
    const n = row._count._all;
    if (row.status === "PRESENT") present = n;
    else if (row.status === "LATE") late = n;
    else if (row.status === "ABSENT") absent = n;
    else if (row.status === "EXCUSED") excused = n;
  }

  return calcAttendancePercentage({ present, late, absent, excused });
}

/**
 * Evaluate exam clearance:
 * - Attendance >= 75% (null attendance with no marks → treated as 0% / blocked)
 * - Zero overdue/pending tuition dues
 * Manual override on ExamAdmitCard forces CLEARED.
 */
export async function evaluateExamClearance(input: {
  studentId: string;
  examSessionId: string;
}): Promise<ClearanceEvaluation> {
  const [attendancePercent, hold, card] = await Promise.all([
    getStudentOverallAttendancePercent(input.studentId),
    getStudentFinancialHold(input.studentId),
    prisma.examAdmitCard.findUnique({
      where: {
        examSessionId_studentId: {
          examSessionId: input.examSessionId,
          studentId: input.studentId,
        },
      },
    }),
  ]);

  if (card?.manualOverride) {
    return {
      status: "CLEARED",
      attendancePercent: card.attendancePercent ?? attendancePercent,
      pendingDues: card.pendingDues ?? hold.pendingDues,
      hasOverdue: hold.hasOverdue,
      criteria: [
        {
          key: "attendance",
          met: true,
          label: "Attendance",
          detail: "Cleared by Controllers of Examinations (manual override)",
        },
        {
          key: "finance",
          met: true,
          label: "Financial Status",
          detail: "Cleared by Controllers of Examinations (manual override)",
        },
      ],
      blockers: [],
      manualOverride: true,
      overrideReason: card.overrideReason,
    };
  }

  const attOk =
    attendancePercent != null &&
    attendancePercent >= MIN_EXAM_ATTENDANCE_PERCENT;
  const financeOk = !hold.active && hold.pendingDues <= 0;

  const criteria: ClearanceCriterion[] = [
    {
      key: "attendance",
      met: attOk,
      label: "Attendance",
      detail:
        attendancePercent == null
          ? `No attendance records (Minimum ${MIN_EXAM_ATTENDANCE_PERCENT}% required)`
          : `Attendance: ${attendancePercent}% (Minimum ${MIN_EXAM_ATTENDANCE_PERCENT}% required)`,
    },
    {
      key: "finance",
      met: financeOk,
      label: "Financial Status",
      detail: financeOk
        ? "No outstanding tuition dues"
        : `Outstanding Tuition: $${hold.pendingDues.toFixed(2)}`,
    },
  ];

  const blockers = criteria.filter((c) => !c.met).map((c) => c.detail);
  const status = attOk && financeOk ? "CLEARED" : "HELD";

  return {
    status,
    attendancePercent,
    pendingDues: hold.pendingDues,
    hasOverdue: hold.hasOverdue,
    criteria,
    blockers,
    manualOverride: false,
    overrideReason: null,
  };
}

export function generateAdmitVerificationCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ADM-${stamp}-${rand}`.slice(0, 24);
}

/** Upsert admit-card row reflecting live evaluation (unless overridden). */
export async function syncAdmitCardRecord(input: {
  examSessionId: string;
  studentId: string;
  evaluation: ClearanceEvaluation;
}) {
  const existing = await prisma.examAdmitCard.findUnique({
    where: {
      examSessionId_studentId: {
        examSessionId: input.examSessionId,
        studentId: input.studentId,
      },
    },
  });

  if (existing?.manualOverride) {
    return existing;
  }

  const verificationCode =
    existing?.verificationCode ?? generateAdmitVerificationCode();
  const generatedAt =
    input.evaluation.status === "CLEARED"
      ? existing?.generatedAt ?? new Date()
      : null;

  return prisma.examAdmitCard.upsert({
    where: {
      examSessionId_studentId: {
        examSessionId: input.examSessionId,
        studentId: input.studentId,
      },
    },
    create: {
      examSessionId: input.examSessionId,
      studentId: input.studentId,
      status: input.evaluation.status,
      attendancePercent: input.evaluation.attendancePercent,
      pendingDues: input.evaluation.pendingDues,
      verificationCode,
      generatedAt,
    },
    update: {
      status: input.evaluation.status,
      attendancePercent: input.evaluation.attendancePercent,
      pendingDues: input.evaluation.pendingDues,
      generatedAt,
    },
  });
}
