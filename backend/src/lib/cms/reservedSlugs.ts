/**
 * Slugs reserved for dedicated public routes / system CMS pages.
 * Custom pages must not collide with these.
 */
export const RESERVED_CMS_SLUGS = new Set([
  "home",
  "about",
  "authority",
  "programs",
  "academics",
  "faculties",
  "campus-life",
  "news",
  "contact",
  "admissions",
  "student",
  "teacher",
  "admin",
  "verify",
  "pages",
  "api",
  "login",
  "research",
]);

export function isReservedCmsSlug(slug: string): boolean {
  return RESERVED_CMS_SLUGS.has(String(slug || "").trim().toLowerCase());
}

/** System pages edited by dedicated admin UIs (excluded from custom page list). */
export const SYSTEM_CMS_PAGE_SLUGS = new Set(["home", "about"]);

export function isSystemCmsPageSlug(slug: string): boolean {
  return SYSTEM_CMS_PAGE_SLUGS.has(String(slug || "").trim().toLowerCase());
}
