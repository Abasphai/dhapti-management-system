/**
 * Public CMS helpers + approved hardcoded Dhapti fallbacks.
 * If CMS is empty/loading/failed, consumers keep the current public design.
 */

import { API_BASE_URL } from "@/lib/api";

export type CmsWebsiteSettings = {
  universityName: string;
  universityShortName: string;
  logoUrl: string;
  faviconUrl: string;
  logoMediaId: string;
  faviconMediaId: string;
  websiteTitle: string;
  websiteDescription: string;
  seoKeywords: string;
  contactPhone: string;
  emergencyPhone: string;
  contactEmail: string;
  admissionsEmail: string;
  supportEmail: string;
  campusAddress: string;
  officeHours: string;
  socialFacebook: string;
  socialTwitter: string;
  socialLinkedIn: string;
  socialYouTube: string;
  socialInstagram: string;
  themePrimary: string;
  themeSecondary: string;
  themeAccent: string;
  websiteCopyright: string;
  privacyPolicyUrl: string;
  termsOfUseUrl: string;
};

export type CmsNavItem = {
  id: string;
  label: string;
  href: string;
  location: "HEADER" | "FOOTER";
  sortOrder: number;
  visible: boolean;
  parentId: string | null;
};

export type PublicMenuItem = { label: string; to: string };
export type PublicMenuGroup = {
  key: string;
  label: string;
  items: PublicMenuItem[];
  /** Root link with no children — render as top-level Link */
  standalone?: boolean;
};

/** Approved hardcoded Dhapti branding (matches pre-CMS public site). */
export const FALLBACK_WEBSITE_SETTINGS: CmsWebsiteSettings = {
  universityName: "Dhapti University",
  universityShortName: "Dhapti",
  logoUrl: "/dhapti-logo.png",
  faviconUrl: "",
  logoMediaId: "",
  faviconMediaId: "",
  websiteTitle: "Dhapti University | UMS & Student Portal",
  websiteDescription:
    "Skills for a Better Future | Learn • Skill • Grow — Dhapti University.",
  seoKeywords: "Dhapti, University, Somalia, UMS",
  contactPhone: "+252 61 700 1000",
  emergencyPhone: "",
  contactEmail: "info@dhapti.edu.so",
  admissionsEmail: "admissions@dhapti.edu.so",
  supportEmail: "info@dhapti.edu.so",
  campusAddress: "Dhapti Main Campus\nDhapti Region\nSomalia",
  officeHours: "Sun – Thu: 8:00 AM – 4:00 PM",
  socialFacebook: "https://www.facebook.com/",
  socialTwitter: "https://twitter.com/",
  socialLinkedIn: "https://www.linkedin.com/",
  socialYouTube: "",
  socialInstagram: "",
  themePrimary: "#002147",
  themeSecondary: "#ea580c",
  themeAccent: "#16a34a",
  websiteCopyright:
    "© Dhapti University. All rights reserved.",
  privacyPolicyUrl: "/contact",
  termsOfUseUrl: "/contact",
};

export const FALLBACK_MENU_GROUPS: PublicMenuGroup[] = [
  {
    key: "DHAPTI",
    label: "About",
    items: [
      { label: "About University", to: "/about" },
      { label: "Mission & Vision", to: "/about#mission" },
      { label: "History", to: "/about#history" },
    ],
  },
  {
    key: "AUTHORITY",
    label: "Authority",
    items: [
      { label: "Board of Trustees", to: "/authority#board" },
      { label: "Administration", to: "/authority#administration" },
    ],
  },
  {
    key: "PROGRAMS",
    label: "Programs",
    items: [
      { label: "Undergraduate", to: "/programs#undergraduate" },
      { label: "Postgraduate", to: "/programs#postgraduate" },
      { label: "Short Courses", to: "/programs#short-courses" },
    ],
  },
  {
    key: "FACULTY",
    label: "Faculty",
    items: [
      { label: "Medicine", to: "/faculties#medicine" },
      { label: "Engineering", to: "/faculties#engineering" },
      { label: "Business", to: "/faculties#business" },
      { label: "Science", to: "/faculties#science" },
      { label: "Law", to: "/faculties#law" },
      { label: "Agriculture", to: "/faculties#agriculture" },
    ],
  },
  {
    key: "CAMPUS_LIFE",
    label: "Campus Life",
    items: [
      { label: "Facilities", to: "/campus-life#facilities" },
      { label: "Library", to: "/campus-life#library" },
      { label: "Labs", to: "/campus-life#labs" },
    ],
  },
  {
    key: "COMMUNITY",
    label: "News & Events",
    items: [
      { label: "News", to: "/news" },
      { label: "Events", to: "/news" },
      { label: "Contact", to: "/contact" },
    ],
  },
];

export const FALLBACK_FOOTER_QUICK_LINKS: PublicMenuItem[] = [
  { label: "About Dhapti", to: "/about" },
  { label: "Authority", to: "/authority" },
  { label: "Programs", to: "/programs" },
  { label: "Faculties", to: "/faculties" },
  { label: "Campus Life", to: "/campus-life" },
  { label: "News & Events", to: "/news" },
  { label: "Admissions", to: "/admissions" },
  { label: "Contact", to: "/contact" },
];

const API_BASE = API_BASE_URL;

export async function fetchPublicCmsSettings(): Promise<CmsWebsiteSettings | null> {
  try {
    const res = await fetch(`${API_BASE}/public/cms/settings`);
    if (!res.ok) return null;
    return (await res.json()) as CmsWebsiteSettings;
  } catch {
    return null;
  }
}

export async function fetchPublicCmsNav(
  location?: "HEADER" | "FOOTER"
): Promise<CmsNavItem[]> {
  try {
    const q = location ? `?location=${location}` : "";
    const res = await fetch(`${API_BASE}/public/cms/nav${q}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: CmsNavItem[] };
    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}

/** Build mega-menu groups from HEADER nav; null when empty → use fallback. */
export function buildHeaderMenuGroups(
  items: CmsNavItem[]
): PublicMenuGroup[] | null {
  const header = items
    .filter((i) => i.location === "HEADER" && i.visible !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  if (header.length === 0) return null;

  const roots = header.filter((i) => !i.parentId);
  if (roots.length === 0) return null;

  return roots.map((root) => {
    const kids = header.filter((i) => i.parentId === root.id);
    if (kids.length === 0) {
      return {
        key: root.id,
        label: root.label,
        items: [{ label: root.label, to: root.href }],
        standalone: true,
      };
    }
    return {
      key: root.id,
      label: root.label,
      items: kids.map((c) => ({ label: c.label, to: c.href })),
      standalone: false,
    };
  });
}

export function buildFooterQuickLinks(
  items: CmsNavItem[]
): PublicMenuItem[] | null {
  const footer = items
    .filter((i) => i.location === "FOOTER" && i.visible !== false && !i.parentId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  if (footer.length === 0) return null;
  return footer.map((i) => ({ label: i.label, to: i.href }));
}

export function resolveInternalLink(href: string): {
  external: boolean;
  to: string;
} {
  const t = href.trim();
  if (/^https?:\/\//i.test(t) || t.startsWith("mailto:")) {
    return { external: true, to: t };
  }
  return { external: false, to: t.startsWith("/") ? t : `/${t}` };
}
