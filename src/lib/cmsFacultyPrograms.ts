import { facultyDetails, type FacultyDetail } from "@/data/publicSite";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

function hasHtmlText(html: string): boolean {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim().length > 0;
}

export type CmsFacultyMarketing = {
  id: string;
  facultyKey: string;
  name: string;
  shortName: string;
  heroImageUrl: string;
  overviewHtml: string;
  careerProspectsHtml: string;
  admissionRequirementsHtml: string;
  deanWelcomeHtml: string;
  departments: string[];
  degrees: string[];
  duration: string;
  credits: string;
  status: string;
  publishedAt: string | null;
};

export type CmsProgramMarketing = {
  id: string;
  programKey: string;
  facultyKey: string;
  title: string;
  degreeTitle: string;
  overviewHtml: string;
  duration: string;
  creditHours: string;
  tuitionPerSemester: string;
  careerOpportunitiesHtml: string;
  status: string;
  publishedAt: string | null;
};

export type FacultyPublicView = FacultyDetail & {
  overviewHtml?: string;
  careerProspectsHtml?: string;
  admissionRequirementsHtml?: string;
  deanWelcomeHtml?: string;
};

export async function fetchPublishedFaculties(): Promise<CmsFacultyMarketing[]> {
  try {
    const res = await fetch(`${API_BASE}/public/cms/faculties`);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: CmsFacultyMarketing[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function fetchPublishedPrograms(
  facultyKey?: string
): Promise<CmsProgramMarketing[]> {
  try {
    const q = facultyKey
      ? `?facultyKey=${encodeURIComponent(facultyKey)}`
      : "";
    const res = await fetch(`${API_BASE}/public/cms/programs${q}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: CmsProgramMarketing[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

/** Merge published CMS faculty marketing onto hardcoded Dhapti catalog (fallback). */
export function mergeFacultyCatalog(
  cmsRows: CmsFacultyMarketing[],
  catalog: FacultyDetail[] = facultyDetails
): FacultyPublicView[] {
  const byKey = new Map(cmsRows.map((r) => [r.facultyKey, r]));
  return catalog.map((f) => {
    const c = byKey.get(f.id);
    if (!c) return { ...f };
    return {
      ...f,
      name: c.name.trim() || f.name,
      shortName: c.shortName.trim() || f.shortName,
      image: c.heroImageUrl.trim() || f.image,
      overviewHtml: hasHtmlText(c.overviewHtml) ? c.overviewHtml : undefined,
      careerProspectsHtml: hasHtmlText(c.careerProspectsHtml)
        ? c.careerProspectsHtml
        : undefined,
      admissionRequirementsHtml: hasHtmlText(c.admissionRequirementsHtml)
        ? c.admissionRequirementsHtml
        : undefined,
      deanWelcomeHtml: hasHtmlText(c.deanWelcomeHtml)
        ? c.deanWelcomeHtml
        : undefined,
      departments:
        c.departments.length > 0 ? c.departments : f.departments,
      degrees: c.degrees.length > 0 ? c.degrees : f.degrees,
      duration: c.duration.trim() || f.duration,
      credits: c.credits.trim() || f.credits,
    };
  });
}

export const DHAPTI_FACULTY_KEYS = facultyDetails.map((f) => ({
  key: f.id,
  name: f.name,
  shortName: f.shortName,
}));
