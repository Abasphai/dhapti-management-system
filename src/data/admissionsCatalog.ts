/** Default Dhapti apply-form catalog when API options are empty or unavailable. */
export type CatalogProgram = {
  id: string;
  code: string;
  title: string;
  facultyCode: string;
};

export type CatalogFaculty = {
  id: string;
  code: string;
  name: string;
  programs: CatalogProgram[];
};

function prog(
  facultyCode: string,
  code: string,
  title: string
): CatalogProgram {
  return {
    id: `fallback:prog:${code}`,
    code,
    title,
    facultyCode,
  };
}

export const DHAPTI_ADMISSIONS_CATALOG: CatalogFaculty[] = [
  {
    id: "fallback:CIT",
    code: "CIT",
    name: "Faculty of Computing & IT",
    programs: [
      prog("CIT", "BSC-CS", "B.Sc. Computer Science"),
      prog("CIT", "BSC-IT", "B.Sc. Information Technology"),
      prog("CIT", "BSC-SE", "B.Sc. Software Engineering"),
    ],
  },
  {
    id: "fallback:MED",
    code: "MED",
    name: "Faculty of Medicine & Health Sciences",
    programs: [
      prog("MED", "MBBS", "Bachelor of Medicine & Surgery"),
      prog("MED", "BSC-PH", "B.Sc. Public Health"),
      prog("MED", "BSC-NUR", "B.Sc. Nursing"),
      prog("MED", "BSC-MLT", "B.Sc. Medical Laboratory"),
    ],
  },
  {
    id: "fallback:BUS",
    code: "BUS",
    name: "Faculty of Business & Economics",
    programs: [
      prog("BUS", "BBA", "Bachelor of Business Admin"),
      prog("BUS", "BSC-AF", "B.Sc. Accounting & Finance"),
      prog("BUS", "BPA", "Bachelor of Public Administration"),
    ],
  },
  {
    id: "fallback:ENG",
    code: "ENG",
    name: "Faculty of Engineering & Technology",
    programs: [
      prog("ENG", "BSC-CE", "B.Sc. Civil Engineering"),
      prog("ENG", "BSC-EE", "B.Sc. Electrical Engineering"),
    ],
  },
  {
    id: "fallback:LAW",
    code: "LAW",
    name: "Faculty of Law & Sharia",
    programs: [
      prog("LAW", "LLB", "Bachelor of Law"),
      prog("LAW", "BSC-SIS", "B.A. Sharia & Islamic Studies"),
    ],
  },
  {
    id: "fallback:AGR",
    code: "AGR",
    name: "Faculty of Agriculture",
    programs: [
      prog("AGR", "BSC-AGR", "B.Sc. Agronomy"),
      prog("AGR", "BSC-ANS", "B.Sc. Animal Science"),
    ],
  },
];

export const FALLBACK_FACULTIES = DHAPTI_ADMISSIONS_CATALOG.map(
  ({ id, code, name }) => ({ id, code, name })
);

export const FALLBACK_PROGRAMS = DHAPTI_ADMISSIONS_CATALOG.flatMap((f) =>
  f.programs.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    facultyId: f.id,
    facultyCode: f.code,
  }))
);
