/** Official Dhapti assessment caps + real-time gradebook calculations (mirrors backend). */

export const BIU_COMPONENT_CAPS = {
  MIDTERM: 30,
  FINAL_EXAM: 40,
  QUIZ: 10,
  ATTENDANCE: 10,
  PRESENTATION: 5,
  ASSIGNMENTS_COMBINED: 5,
  MAX_ASSIGNMENTS_PER_COURSE: 2,
} as const;

export type BiuLetterGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "F";

export type BiuComponentMarks = {
  midterm: number;
  finalExam: number;
  quiz: number;
  attendance: number;
  presentation: number;
  assignment: number;
};

export const BIU_COMPONENT_FIELDS = [
  {
    key: "midterm" as const,
    label: "Midterm",
    short: "Mid",
    max: BIU_COMPONENT_CAPS.MIDTERM,
  },
  {
    key: "finalExam" as const,
    label: "Final",
    short: "Final",
    max: BIU_COMPONENT_CAPS.FINAL_EXAM,
  },
  {
    key: "quiz" as const,
    label: "Quizzes",
    short: "Quiz",
    max: BIU_COMPONENT_CAPS.QUIZ,
  },
  {
    key: "presentation" as const,
    label: "Presentation",
    short: "Pres",
    max: BIU_COMPONENT_CAPS.PRESENTATION,
  },
  {
    key: "assignment" as const,
    label: "Assignments",
    short: "Assign",
    max: BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED,
  },
  {
    key: "attendance" as const,
    label: "Attendance",
    short: "Att",
    max: BIU_COMPONENT_CAPS.ATTENDANCE,
  },
] as const;

export function clampBiuMark(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

export function roundMarks(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function computeBiuTotal(components: BiuComponentMarks): number {
  return roundMarks(
    components.midterm +
      components.finalExam +
      components.quiz +
      components.attendance +
      components.presentation +
      components.assignment
  );
}

export function computeBiuLetterGrade(
  totalMarks: number,
  passingCutoff = 50
): { letter: BiuLetterGrade; gradePoint: number } {
  const score = Math.min(100, Math.max(0, totalMarks));
  const cutoff = Math.min(100, Math.max(0, passingCutoff));
  if (score < cutoff) return { letter: "F", gradePoint: 0 };
  if (score >= 90) return { letter: "A+", gradePoint: 4.0 };
  if (score >= 85) return { letter: "A", gradePoint: 3.75 };
  if (score >= 80) return { letter: "A-", gradePoint: 3.5 };
  if (score >= 75) return { letter: "B+", gradePoint: 3.25 };
  if (score >= 70) return { letter: "B", gradePoint: 3.0 };
  if (score >= 65) return { letter: "B-", gradePoint: 2.75 };
  if (score >= 60) return { letter: "C+", gradePoint: 2.5 };
  if (score >= 55) return { letter: "C", gradePoint: 2.25 };
  if (score >= 50) return { letter: "C-", gradePoint: 2.0 };
  return { letter: "F", gradePoint: 0 };
}

export function computePassFail(
  totalMarks: number,
  passingCutoff = 50
): "PASS" | "FAIL" {
  return totalMarks >= passingCutoff ? "PASS" : "FAIL";
}

/** Attendance % (0–100) → Dhapti attendance marks (0–10). */
export function attendancePercentToMarks(
  percent: number | null | undefined
): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  const p = Math.min(100, Math.max(0, percent));
  return roundMarks((p / 100) * BIU_COMPONENT_CAPS.ATTENDANCE);
}

export function evaluateBiuMarksLive(
  components: BiuComponentMarks,
  passingCutoff = 50
): {
  total: number;
  letterGrade: BiuLetterGrade;
  gradePoint: number;
  passFail: "PASS" | "FAIL";
} {
  const total = computeBiuTotal(components);
  const grade = computeBiuLetterGrade(total, passingCutoff);
  return {
    total,
    letterGrade: grade.letter,
    gradePoint: grade.gradePoint,
    passFail: computePassFail(total, passingCutoff),
  };
}
