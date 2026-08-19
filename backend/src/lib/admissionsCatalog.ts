/** Shared Dhapti admissions catalog for options fallback + apply resolution. */
export const BIU_FACULTY_CATALOG = [
  { code: "CIT", name: "Faculty of Computing & IT" },
  { code: "MED", name: "Faculty of Medicine & Health Sciences" },
  { code: "BUS", name: "Faculty of Business & Economics" },
  { code: "ENG", name: "Faculty of Engineering & Technology" },
  { code: "LAW", name: "Faculty of Law & Sharia" },
  { code: "AGR", name: "Faculty of Agriculture" },
] as const;

export const BIU_PROGRAM_CATALOG: Array<{
  facultyCode: string;
  code: string;
  title: string;
}> = [
  { facultyCode: "CIT", code: "BSC-CS", title: "B.Sc. Computer Science" },
  { facultyCode: "CIT", code: "BSC-IT", title: "B.Sc. Information Technology" },
  {
    facultyCode: "CIT",
    code: "BSC-SE",
    title: "B.Sc. Software Engineering",
  },
  {
    facultyCode: "MED",
    code: "MBBS",
    title: "Bachelor of Medicine & Surgery",
  },
  { facultyCode: "MED", code: "BSC-PH", title: "B.Sc. Public Health" },
  { facultyCode: "MED", code: "BSC-NUR", title: "B.Sc. Nursing" },
  {
    facultyCode: "MED",
    code: "BSC-MLT",
    title: "B.Sc. Medical Laboratory",
  },
  { facultyCode: "BUS", code: "BBA", title: "Bachelor of Business Admin" },
  {
    facultyCode: "BUS",
    code: "BSC-AF",
    title: "B.Sc. Accounting & Finance",
  },
  {
    facultyCode: "BUS",
    code: "BPA",
    title: "Bachelor of Public Administration",
  },
  { facultyCode: "ENG", code: "BSC-CE", title: "B.Sc. Civil Engineering" },
  {
    facultyCode: "ENG",
    code: "BSC-EE",
    title: "B.Sc. Electrical Engineering",
  },
  { facultyCode: "LAW", code: "LLB", title: "Bachelor of Law" },
  {
    facultyCode: "LAW",
    code: "BSC-SIS",
    title: "B.A. Sharia & Islamic Studies",
  },
  { facultyCode: "AGR", code: "BSC-AGR", title: "B.Sc. Agronomy" },
  { facultyCode: "AGR", code: "BSC-ANS", title: "B.Sc. Animal Science" },
];
