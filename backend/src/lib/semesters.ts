/** Canonical Dhapti semester labels (numeric). */
export const DHAPTI_SEMESTERS = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8",
] as const;

const ROMAN_TO_NUMERIC: Record<string, string> = {
  "Semester I": "Semester 1",
  "Semester II": "Semester 2",
  "Semester III": "Semester 3",
  "Semester IV": "Semester 4",
  "Semester V": "Semester 5",
  "Semester VI": "Semester 6",
  "Semester VII": "Semester 7",
  "Semester VIII": "Semester 8",
};

export function normalizeSemesterLabel(
  value: string | null | undefined
): string {
  if (!value) return "";
  const trimmed = value.trim();
  return ROMAN_TO_NUMERIC[trimmed] ?? trimmed;
}

/** Values that should match a semester filter (legacy Roman + numeric). */
export function semesterFilterVariants(semester: string): string[] {
  const normalized = normalizeSemesterLabel(semester);
  const variants = new Set<string>([semester, normalized]);
  for (const [roman, numeric] of Object.entries(ROMAN_TO_NUMERIC)) {
    if (numeric === normalized) variants.add(roman);
  }
  return [...variants];
}

/** 1–8 for Dhapti semester labels; null if unrecognized. */
export function semesterIndex(value: string | null | undefined): number | null {
  const normalized = normalizeSemesterLabel(value);
  const match = /^Semester\s+(\d+)$/i.exec(normalized);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 8 ? n : null;
}

export function isSameSemester(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizeSemesterLabel(a);
  const right = normalizeSemesterLabel(b);
  return Boolean(left && right && left === right);
}

/** Relative position of `courseSemester` vs student's current active semester. */
export function semesterWindow(
  courseSemester: string | null | undefined,
  studentCurrentSemester: string | null | undefined
): "current" | "past" | "future" | "unknown" {
  if (isSameSemester(courseSemester, studentCurrentSemester)) return "current";
  const courseIdx = semesterIndex(courseSemester);
  const currentIdx = semesterIndex(studentCurrentSemester);
  if (courseIdx == null || currentIdx == null) return "unknown";
  if (courseIdx < currentIdx) return "past";
  if (courseIdx > currentIdx) return "future";
  return "current";
}

export function currentSemesterEvaluationBlockedMessage(
  currentSemester: string
): string {
  const label = normalizeSemesterLabel(currentSemester) || "your current semester";
  return `Teacher evaluation is strictly restricted to your current active semester (${label}). You cannot evaluate past or future semester courses.`;
}
