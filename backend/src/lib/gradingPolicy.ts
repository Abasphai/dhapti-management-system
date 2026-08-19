/**
 * Official Dhapti University (Dhapti) assessment distribution
 * and letter-grade / GPA scale policy.
 */

export const BIU_COMPONENT_CAPS = {
  MIDTERM: 30,
  FINAL_EXAM: 40,
  QUIZ: 10,
  ATTENDANCE: 10,
  PRESENTATION: 5,
  ASSIGNMENTS_COMBINED: 5,
  MAX_ASSIGNMENTS_PER_COURSE: 2,
} as const;

export type BiuComponentKey =
  | "midterm"
  | "finalExam"
  | "quiz"
  | "attendance"
  | "presentation"
  | "assignment";

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

export type BiuGradeBand = {
  min: number;
  max: number;
  letter: BiuLetterGrade;
  gradePoint: number;
};

/** Inclusive bands for total marks 0–100 */
export const BIU_GRADE_BANDS: BiuGradeBand[] = [
  { min: 90, max: 100, letter: "A+", gradePoint: 4.0 },
  { min: 85, max: 89, letter: "A", gradePoint: 3.75 },
  { min: 80, max: 84, letter: "A-", gradePoint: 3.5 },
  { min: 75, max: 79, letter: "B+", gradePoint: 3.25 },
  { min: 70, max: 74, letter: "B", gradePoint: 3.0 },
  { min: 65, max: 69, letter: "B-", gradePoint: 2.75 },
  { min: 60, max: 64, letter: "C+", gradePoint: 2.5 },
  { min: 55, max: 59, letter: "C", gradePoint: 2.25 },
  { min: 50, max: 54, letter: "C-", gradePoint: 2.0 },
  { min: 0, max: 49, letter: "F", gradePoint: 0.0 },
];

export type BiuComponentMarks = {
  midterm: number;
  finalExam: number;
  quiz: number;
  attendance: number;
  presentation: number;
  /** Combined assignment marks (0–5). Prefer this OR assignmentScores. */
  assignment: number;
};

/**
 * Max marks for a single assignment given how many published assignments
 * exist in the course/class section (max 2).
 * 1 assignment → 5; 2 assignments → 2.5 each.
 */
export function biuAssignmentMaxPerItem(assignmentCount: number): number {
  const count = Math.max(0, Math.floor(assignmentCount));
  if (count <= 1) return BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED;
  return BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED / 2; // 2.5
}

export function roundMarks(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Map total course marks (0–100) → official Dhapti letter + grade point. */
export function computeBiuLetterGrade(
  totalMarks: number,
  /** Scores strictly below this cutoff are forced to F (admin System Setting). */
  passingCutoff = 50
): {
  letter: BiuLetterGrade;
  gradePoint: number;
} {
  const score = Math.min(100, Math.max(0, totalMarks));
  const cutoff = Math.min(100, Math.max(0, passingCutoff));
  if (score < cutoff) {
    return { letter: "F", gradePoint: 0.0 };
  }
  // Prefer higher bands first; treat boundaries inclusively.
  for (const band of BIU_GRADE_BANDS) {
    if (score >= band.min && score <= band.max) {
      return { letter: band.letter, gradePoint: band.gradePoint };
    }
  }
  // Fractional scores between integer band edges (e.g. 89.5)
  if (score >= 90) return { letter: "A+", gradePoint: 4.0 };
  if (score >= 85) return { letter: "A", gradePoint: 3.75 };
  if (score >= 80) return { letter: "A-", gradePoint: 3.5 };
  if (score >= 75) return { letter: "B+", gradePoint: 3.25 };
  if (score >= 70) return { letter: "B", gradePoint: 3.0 };
  if (score >= 65) return { letter: "B-", gradePoint: 2.75 };
  if (score >= 60) return { letter: "C+", gradePoint: 2.5 };
  if (score >= 55) return { letter: "C", gradePoint: 2.25 };
  if (score >= 50) return { letter: "C-", gradePoint: 2.0 };
  return { letter: "F", gradePoint: 0.0 };
}

export function validateComponentMark(
  label: string,
  value: number,
  max: number
): string | null {
  if (!Number.isFinite(value)) return `${label} must be a finite number`;
  if (value < 0) return `${label} cannot be negative`;
  if (value > max) return `${label} cannot exceed ${max}`;
  return null;
}

/**
 * Validate Dhapti component marks. `assignmentScores` (0–2 items) are summed
 * into the assignment total and must respect per-item + combined caps.
 */
export function validateBiuComponentMarks(input: {
  midterm: number;
  finalExam: number;
  quiz: number;
  attendance: number;
  presentation: number;
  assignment?: number;
  assignmentScores?: number[];
}): { ok: true; components: BiuComponentMarks } | { ok: false; message: string } {
  const checks: Array<[string, number, number]> = [
    ["Midterm Exam", input.midterm, BIU_COMPONENT_CAPS.MIDTERM],
    ["Final Exam", input.finalExam, BIU_COMPONENT_CAPS.FINAL_EXAM],
    ["Quiz", input.quiz, BIU_COMPONENT_CAPS.QUIZ],
    ["Attendance", input.attendance, BIU_COMPONENT_CAPS.ATTENDANCE],
    ["Presentation", input.presentation, BIU_COMPONENT_CAPS.PRESENTATION],
  ];
  for (const [label, value, max] of checks) {
    const err = validateComponentMark(label, value, max);
    if (err) return { ok: false, message: err };
  }

  let assignmentTotal = 0;
  if (input.assignmentScores != null) {
    if (input.assignmentScores.length > BIU_COMPONENT_CAPS.MAX_ASSIGNMENTS_PER_COURSE) {
      return {
        ok: false,
        message: `At most ${BIU_COMPONENT_CAPS.MAX_ASSIGNMENTS_PER_COURSE} assignments are allowed`,
      };
    }
    const perMax = biuAssignmentMaxPerItem(input.assignmentScores.length || 1);
    for (let i = 0; i < input.assignmentScores.length; i++) {
      const v = input.assignmentScores[i];
      const err = validateComponentMark(`Assignment ${i + 1}`, v, perMax);
      if (err) return { ok: false, message: err };
      assignmentTotal += v;
    }
  } else if (input.assignment != null) {
    const err = validateComponentMark(
      "Assignment",
      input.assignment,
      BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED
    );
    if (err) return { ok: false, message: err };
    assignmentTotal = input.assignment;
  }

  assignmentTotal = roundMarks(assignmentTotal);
  if (assignmentTotal > BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED) {
    return {
      ok: false,
      message: `Combined assignment marks cannot exceed ${BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED}`,
    };
  }

  return {
    ok: true,
    components: {
      midterm: roundMarks(input.midterm),
      finalExam: roundMarks(input.finalExam),
      quiz: roundMarks(input.quiz),
      attendance: roundMarks(input.attendance),
      presentation: roundMarks(input.presentation),
      assignment: assignmentTotal,
    },
  };
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

/**
 * Convert logged attendance percentage (0–100) into the Dhapti Attendance
 * component score (0–10). Null/unknown attendance → 0.
 */
export function attendancePercentToMarks(
  percent: number | null | undefined
): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  const p = Math.min(100, Math.max(0, percent));
  return roundMarks((p / 100) * BIU_COMPONENT_CAPS.ATTENDANCE);
}

/** Pass when total meets the institutional cutoff (default 50). */
export function computePassFail(
  totalMarks: number,
  passingCutoff = 50
): "PASS" | "FAIL" {
  const total = Math.min(100, Math.max(0, totalMarks));
  const cutoff = Math.min(100, Math.max(0, passingCutoff));
  return total >= cutoff ? "PASS" : "FAIL";
}

export function evaluateBiuMarks(input: {
  midterm: number;
  finalExam: number;
  quiz: number;
  attendance: number;
  presentation: number;
  assignment?: number;
  assignmentScores?: number[];
  passingCutoff?: number;
}):
  | {
      ok: true;
      components: BiuComponentMarks;
      total: number;
      letterGrade: BiuLetterGrade;
      gradePoint: number;
    }
  | { ok: false; message: string } {
  const validated = validateBiuComponentMarks(input);
  if (!validated.ok) return validated;
  const total = computeBiuTotal(validated.components);
  if (total > 100) {
    return { ok: false, message: "Total marks cannot exceed 100" };
  }
  const grade = computeBiuLetterGrade(total, input.passingCutoff ?? 50);
  return {
    ok: true,
    components: validated.components,
    total,
    letterGrade: grade.letter,
    gradePoint: grade.gradePoint,
  };
}

/** Effective max for grading one assignment submission under Dhapti policy. */
export function effectiveAssignmentScoreCap(opts: {
  assignmentMaxMarks: number;
  publishedAssignmentCountInSection: number;
}): number {
  const biuCap = biuAssignmentMaxPerItem(
    Math.min(
      opts.publishedAssignmentCountInSection,
      BIU_COMPONENT_CAPS.MAX_ASSIGNMENTS_PER_COURSE
    ) || 1
  );
  return Math.min(opts.assignmentMaxMarks, biuCap);
}

export const BIU_COMPONENT_LABELS: Record<
  BiuComponentKey,
  { label: string; max: number }
> = {
  midterm: { label: "Midterm Exam", max: BIU_COMPONENT_CAPS.MIDTERM },
  finalExam: { label: "Final Exam", max: BIU_COMPONENT_CAPS.FINAL_EXAM },
  quiz: { label: "Quiz", max: BIU_COMPONENT_CAPS.QUIZ },
  attendance: { label: "Attendance", max: BIU_COMPONENT_CAPS.ATTENDANCE },
  presentation: {
    label: "Presentation",
    max: BIU_COMPONENT_CAPS.PRESENTATION,
  },
  assignment: {
    label: "Assignments (combined)",
    max: BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED,
  },
};
