/**
 * One-shot rebrand: BIU → Dhapti University
 * Run: node scripts/rebrand-to-dhapti.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".cursor"]);
const EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".html",
  ".md",
  ".css",
  ".example",
  ".yml",
  ".yaml",
]);

/** Order matters — longest / most specific first */
const REPLACEMENTS = [
  ["Baidoa International University", "Dhapti University"],
  ["Jaamacadda Caalamiga ah ee Baydhabo", "Jaamacadda Dhapti"],
  ["جامعة بيدوا الدولية", "جامعة ضapti"],
  ["Baidoa International", "Dhapti University"],
  ["@biu.edu.so", "@dhapti.edu.so"],
  ["/biu-logo.png", "/dhapti-logo.png"],
  ["/biu-logo.jpg", "/dhapti-logo.png"],
  ["biu-logo.png", "dhapti-logo.png"],
  ["BIU@2026", "DHAPTI@2026"],
  ["BIU_IMAGES", "DHAPTI_IMAGES"],
  ["BIU_LOGO_PLACEHOLDER", "DHAPTI_LOGO_URL"],
  ["BIU_SEMESTERS", "DHAPTI_SEMESTERS"],
  ["BIU_ACADEMIC_YEARS", "DHAPTI_ACADEMIC_YEARS"],
  ["BIU_CURRENT_ACADEMIC_YEAR", "DHAPTI_CURRENT_ACADEMIC_YEAR"],
  ["BIU_FACULTY_KEYS", "DHAPTI_FACULTY_KEYS"],
  ["BIU_ADMISSIONS_CATALOG", "DHAPTI_ADMISSIONS_CATALOG"],
  ["BIU_COURSE_CATALOG", "DHAPTI_COURSE_CATALOG"],
  ["BIU_FACULTY_DEPARTMENT_CATALOG", "DHAPTI_FACULTY_DEPARTMENT_CATALOG"],
  ["BIU-FAC-", "DHAPTI-FAC-"],
  ["BIU-STU-", "DHAPTI-STU-"],
  ["BIU-ATT:", "DHAPTI-ATT:"],
  ["BIU Main Campus", "Dhapti Main Campus"],
  ["BIU Official Scale", "Dhapti Official Scale"],
  ["BIU Faculty Creed", "Dhapti Faculty Creed"],
  ["BIU Medical Center", "Dhapti Medical Center"],
  ["BIU Campus Clinic", "Dhapti Campus Clinic"],
  ["BIU Grand Auditorium", "Dhapti Grand Auditorium"],
  ["BIU Collection", "Dhapti Collection"],
  ["Welcome To BIU", "Welcome To Dhapti"],
  ["Ku Soo Dhawoow BIU", "Ku Soo Dhawoow Dhapti"],
  ["مرحبًا بكم في BIU", "مرحبًا بكم في Dhapti"],
  ["Why Choose BIU?", "Why Choose Dhapti?"],
  ["Maxaad u Dooranaysaa BIU?", "Maxaad u Dooranaysaa Dhapti?"],
  ["لماذا تختار BIU؟", "لماذا تختار Dhapti؟"],
  ["Why BIU", "Why Dhapti"],
  ["Maxaa BIU", "Maxaa Dhapti"],
  ["لماذا BIU", "لماذا Dhapti"],
  ["About BIU", "About Dhapti"],
  ["Laga eege BIU", "Laga eege Dhapti"],
  ["History of BIU", "History of Dhapti University"],
  ["Taariikhda BIU", "Taariikhda Dhapti"],
  ["تاريخ BIU", "تاريخ Dhapti"],
  ["Learn more about BIU", "Learn more about Dhapti"],
  ["Wax badan ka baro BIU", "Wax badan ka baro Dhapti"],
  ["اعرف المزيد عن BIU", "اعرف المزيد عن Dhapti"],
  ["biu-university-system", "dhapti-university-system"],
  ["biu-backend", "dhapti-backend"],
  ["biu-postgres", "dhapti-postgres"],
  ["biu_pg_data", "dhapti_pg_data"],
  ["biu-auth-token", "dhapti-auth-token"],
  ["biu-auth-user", "dhapti-auth-user"],
  ["biu-session-expired", "dhapti-session-expired"],
  ["biu-theme", "dhapti-theme"],
  ["biu-layout-settings", "dhapti-layout-settings"],
  ["biu-notifications-changed", "dhapti-notifications-changed"],
  ["biu-analytics-", "dhapti-analytics-"],
  ["biu-system-backup-", "dhapti-system-backup-"],
  ["biu-teacher-performance-", "dhapti-teacher-performance-"],
  ["BIU University Management API", "Dhapti University Management API"],
  ["BIU API", "Dhapti API"],
  ["Seeding BIU database", "Seeding Dhapti database"],
  ["BIU faculty catalog", "Dhapti faculty catalog"],
  ["/* BIU brand assets */", "/* Dhapti brand assets */"],
  ["BIU Slide", "Dhapti Slide"],
  ["BIU Logo", "Dhapti Logo"],
  ["BIU academic campus", "Dhapti academic campus"],
  ["BIU Admission Help Desk", "Dhapti Admission Help Desk"],
  ["Official BIU", "Official Dhapti"],
  ["property of BIU", "property of Dhapti"],
  ["issued by BIU", "issued by Dhapti Registrar"],
  ["contact the BIU Registrar", "contact the Dhapti Registrar"],
  ["Join the BIU campus", "Join the Dhapti campus"],
  ["at BIU is", "at Dhapti is"],
  ["guiding BIU", "guiding Dhapti"],
  ["ensures BIU", "ensures Dhapti"],
  ["represents BIU", "represents Dhapti"],
  ["calendar dates at BIU", "calendar dates at Dhapti"],
  ["contacting BIU", "contacting Dhapti"],
  ["BIU will respond", "Dhapti will respond"],
  ["BIU-|", "DHAPTI-|"],
  ["BIU Student", "Dhapti Student"],
  ["BIU Faculty", "Dhapti Faculty"],
  ["across BIU", "across Dhapti University"],
  ["6 BIU faculties", "6 Dhapti faculties"],
  ["the BIU catalog", "the Dhapti catalog"],
  ["Default BIU", "Default Dhapti"],
  ["hardcoded BIU", "hardcoded Dhapti"],
  ["approved BIU", "approved Dhapti"],
  ["official BIU", "official Dhapti"],
  ["BIU fee receipt", "Dhapti fee receipt"],
  ["BIU-|", "DHAPTI-|"],
  ["BIU-${", "DHAPTI-${"],
  ["`BIU-", "`DHAPTI-"],
  ["BIU on Facebook", "Dhapti on Facebook"],
  ["BIU on X", "Dhapti on X"],
  ["BIU on LinkedIn", "Dhapti on LinkedIn"],
  ["BIU on YouTube", "Dhapti on YouTube"],
  ["BIU on Instagram", "Dhapti on Instagram"],
  ["BIU Opens", "Dhapti Opens"],
  ["BIU is established", "Dhapti University is established"],
  ["for Baidoa,", "for Dhapti,"],
  ["in Baidoa", "in Dhapti"],
  ["Baidoa,", "Dhapti,"],
  ["Horseed District, Dhapti", "Dhapti Campus"],
  ["Dhapti, Bay Region", "Dhapti Region"],
  ["Dhapti, Dhapti Region", "Dhapti Region"],
  ['"BIU"', '"DHAPTI"'],
  ["(BIU)", "(Dhapti)"],
  [" BIU ", " Dhapti "],
  [" BIU.", " Dhapti."],
  [" BIU,", " Dhapti,"],
  [" BIU?", " Dhapti?"],
  [" BIU!", " Dhapti!"],
  [" BIU'", " Dhapti'"],
  [" BIU\"", " Dhapti\""],
  [" BIU\n", " Dhapti\n"],
  ["| BIU", "| Dhapti"],
  [">BIU<", ">Dhapti<"],
  ["BIU |", "Dhapti |"],
  ["| BIU |", "| Dhapti |"],
  ["BIU UMS", "Dhapti UMS"],
  ["BIU-", "DHAPTI-"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(ent.name))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes(`${path.sep}scripts${path.sep}rebrand-to-dhapti.mjs`))
    continue;
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    changed++;
    console.log("updated:", path.relative(ROOT, file));
  }
}
console.log(`Done. ${changed} files updated.`);
