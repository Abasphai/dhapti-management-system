/** Canonical Dhapti academic years for admin filters & forms. */
export const DHAPTI_ACADEMIC_YEARS = [
  "2026/2027",
  "2025/2026",
  "2024/2025",
  "2023/2024",
  "2022/2023",
  "2021/2022",
] as const;

export const DHAPTI_CURRENT_ACADEMIC_YEAR = "2025/2026";

export function academicYearLabel(year: string): string {
  return year === DHAPTI_CURRENT_ACADEMIC_YEAR ? `${year} (Current)` : year;
}

/** Official Dhapti course catalog used for seed + UI reference. */
export const DHAPTI_COURSE_CATALOG = [
  {
    code: "CS101",
    title: "Introduction to Programming",
    facultyCode: "CIT",
    departmentCode: "CS",
    semester: "Semester 1",
  },
  {
    code: "CS301",
    title: "Data Structures & Algorithms",
    facultyCode: "CIT",
    departmentCode: "CS",
    semester: "Semester 3",
  },
  {
    code: "CS305",
    title: "Database Systems",
    facultyCode: "CIT",
    departmentCode: "CS",
    semester: "Semester 3",
  },
  {
    code: "CS312",
    title: "Web Development",
    facultyCode: "CIT",
    departmentCode: "CS",
    semester: "Semester 3",
  },
  {
    code: "CS320",
    title: "Computer Networks",
    facultyCode: "CIT",
    departmentCode: "CS",
    semester: "Semester 3",
  },
  {
    code: "CS401",
    title: "Software Engineering",
    facultyCode: "CIT",
    departmentCode: "CS",
    semester: "Semester 4",
  },
  {
    code: "MED101",
    title: "Human Anatomy & Physiology",
    facultyCode: "MED",
    departmentCode: "MS",
    semester: "Semester 1",
  },
  {
    code: "MED201",
    title: "Pathology & Pharmacology",
    facultyCode: "MED",
    departmentCode: "MS",
    semester: "Semester 2",
  },
  {
    code: "BUS101",
    title: "Principles of Management",
    facultyCode: "BUS",
    departmentCode: "BA",
    semester: "Semester 1",
  },
  {
    code: "BUS301",
    title: "Accounting & Finance",
    facultyCode: "BUS",
    departmentCode: "AF",
    semester: "Semester 3",
  },
  {
    code: "ENG101",
    title: "Civil Engineering Fundamentals",
    facultyCode: "ENG",
    departmentCode: "CE",
    semester: "Semester 1",
  },
  {
    code: "LAW101",
    title: "Introduction to Law & Sharia",
    facultyCode: "LAW",
    departmentCode: "LLB",
    semester: "Semester 1",
  },
  {
    code: "AGR101",
    title: "Fundamentals of Agronomy",
    facultyCode: "AGR",
    departmentCode: "AGN",
    semester: "Semester 1",
  },
] as const;

export function formatCourseOptionLabel(code: string, title: string): string {
  return `${code}: ${title}`;
}
