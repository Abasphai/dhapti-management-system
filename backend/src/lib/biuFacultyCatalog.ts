/**
 * Official Dhapti Faculty → Department catalog for seed + admin integrity.
 */
export const DHAPTI_FACULTY_DEPARTMENT_CATALOG = [
  {
    code: "CIT",
    name: "Faculty of Computing & IT",
    description: "Computer science, IT, and software engineering programmes",
    departments: [
      { code: "CS", name: "Computer Science" },
      { code: "IT", name: "Information Technology" },
      { code: "SE", name: "Software Engineering" },
    ],
  },
  {
    code: "MED",
    name: "Faculty of Medicine & Health Sciences",
    description: "Medicine, public health, nursing, and laboratory sciences",
    departments: [
      { code: "MS", name: "Medicine & Surgery" },
      { code: "PH", name: "Public Health" },
      { code: "NUR", name: "Nursing" },
      { code: "MLT", name: "Medical Laboratory" },
    ],
  },
  {
    code: "BUS",
    name: "Faculty of Business & Economics",
    description: "Business, accounting, finance, and public administration",
    departments: [
      { code: "BA", name: "Business Administration" },
      { code: "AF", name: "Accounting & Finance" },
      { code: "PA", name: "Public Administration" },
    ],
  },
  {
    code: "ENG",
    name: "Faculty of Engineering & Technology",
    description: "Civil and electrical engineering programmes",
    departments: [
      { code: "CE", name: "Civil Engineering" },
      { code: "EE", name: "Electrical Engineering" },
    ],
  },
  {
    code: "LAW",
    name: "Faculty of Law & Sharia",
    description: "Law and Sharia & Islamic Studies",
    departments: [
      { code: "LLB", name: "Law" },
      { code: "SIS", name: "Sharia & Islamic Studies" },
    ],
  },
  {
    code: "AGR",
    name: "Faculty of Agriculture",
    description: "Agronomy and animal science programmes",
    departments: [
      { code: "AGN", name: "Agronomy" },
      { code: "ANS", name: "Animal Science" },
    ],
  },
] as const;
