/** Official Dhapti faculty codes + admin filter labels. */
export const BIU_FACULTY_FILTER_LABELS: Record<string, string> = {
  CIT: "Faculty of Computing & IT",
  MED: "Faculty of Medicine & Health Sciences",
  BUS: "Faculty of Business & Economics",
  ENG: "Faculty of Engineering & Technology",
  LAW: "Faculty of Law & Sharia",
  AGR: "Faculty of Agriculture",
};

export const BIU_FACULTY_CODE_ORDER = [
  "CIT",
  "MED",
  "BUS",
  "ENG",
  "LAW",
  "AGR",
] as const;

/** All 8 Dhapti programme semesters (numeric labels). */
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

export type BiuSemester = (typeof DHAPTI_SEMESTERS)[number];

/** Map legacy Roman labels → numeric labels. */
const SEMESTER_ROMAN_TO_NUMERIC: Record<string, BiuSemester> = {
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
  return SEMESTER_ROMAN_TO_NUMERIC[trimmed] ?? trimmed;
}

export function facultyFilterLabel(faculty: {
  code: string;
  name: string;
}): string {
  const byCode = BIU_FACULTY_FILTER_LABELS[faculty.code.toUpperCase()];
  if (byCode) return byCode;
  if (faculty.name.startsWith("Faculty of ")) return faculty.name;
  return `Faculty of ${faculty.name}`;
}

/** Sort faculties in official Dhapti order for dropdowns. */
export function sortFacultiesForFilter<T extends { code: string }>(
  faculties: T[]
): T[] {
  const order = new Map(
    BIU_FACULTY_CODE_ORDER.map((code, i) => [code, i] as const)
  );
  return [...faculties].sort((a, b) => {
    const ai = order.get(
      a.code.toUpperCase() as (typeof BIU_FACULTY_CODE_ORDER)[number]
    );
    const bi = order.get(
      b.code.toUpperCase() as (typeof BIU_FACULTY_CODE_ORDER)[number]
    );
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.code.localeCompare(b.code);
  });
}
