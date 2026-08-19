/**
 * Website brand/theme keys stored in SystemSetting (single SSoT).
 * Exposed only via cms.settings.* — not via operational settings.* admin UI.
 */
import { z } from "zod";

import { prisma } from "./prisma.js";

export type CmsWebsiteSettings = {
  universityName: string;
  universityShortName: string;
  logoUrl: string;
  faviconUrl: string;
  /** Optional media library refs (Phase 1); prefer logoUrl/faviconUrl in Phase 2 UI */
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

const DEFAULTS: CmsWebsiteSettings = {
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
  websiteCopyright: "© Dhapti University. All rights reserved.",
  privacyPolicyUrl: "/contact",
  termsOfUseUrl: "/contact",
};

/** Keys that cms.settings.* may read/write (never operational UMS keys). */
export const CMS_WEBSITE_SETTING_KEYS = Object.keys(
  DEFAULTS
) as Array<keyof CmsWebsiteSettings>;

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Invalid hex color");

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine((v) => v.length === 0 || z.string().email().safeParse(v).success, {
    message: "Invalid email",
  });

const optionalUrl = z.string().trim().max(500);

export const cmsWebsiteSettingsPatchSchema = z
  .object({
    universityName: z.string().trim().min(2).max(160).optional(),
    universityShortName: z.string().trim().min(1).max(40).optional(),
    logoUrl: optionalUrl.optional(),
    faviconUrl: optionalUrl.optional(),
    logoMediaId: z.string().trim().max(64).optional(),
    faviconMediaId: z.string().trim().max(64).optional(),
    websiteTitle: z.string().trim().min(2).max(160).optional(),
    websiteDescription: z.string().trim().max(500).optional(),
    seoKeywords: z.string().trim().max(300).optional(),
    contactPhone: z.string().trim().min(3).max(40).optional(),
    emergencyPhone: z.string().trim().max(40).optional(),
    contactEmail: optionalEmail.optional(),
    admissionsEmail: optionalEmail.optional(),
    supportEmail: optionalEmail.optional(),
    campusAddress: z.string().trim().min(2).max(400).optional(),
    officeHours: z.string().trim().max(120).optional(),
    socialFacebook: optionalUrl.optional(),
    socialTwitter: optionalUrl.optional(),
    socialLinkedIn: optionalUrl.optional(),
    socialYouTube: optionalUrl.optional(),
    socialInstagram: optionalUrl.optional(),
    themePrimary: hexColor.optional(),
    themeSecondary: hexColor.optional(),
    themeAccent: hexColor.optional(),
    websiteCopyright: z.string().trim().max(240).optional(),
    privacyPolicyUrl: optionalUrl.optional(),
    termsOfUseUrl: optionalUrl.optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one website setting is required",
  });

export type CmsWebsiteSettingsPatch = z.infer<
  typeof cmsWebsiteSettingsPatchSchema
>;

function readString(
  map: Map<string, string>,
  key: keyof CmsWebsiteSettings
): string {
  const v = map.get(key)?.trim();
  return v && v.length > 0 ? v : DEFAULTS[key];
}

function readOptional(
  map: Map<string, string>,
  key: keyof CmsWebsiteSettings
): string {
  const raw = map.get(key);
  if (raw === undefined) return DEFAULTS[key];
  return raw.trim();
}

export async function getCmsWebsiteSettings(): Promise<CmsWebsiteSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...CMS_WEBSITE_SETTING_KEYS] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    universityName: readString(map, "universityName"),
    universityShortName: readString(map, "universityShortName"),
    logoUrl: readString(map, "logoUrl"),
    faviconUrl: readOptional(map, "faviconUrl"),
    logoMediaId: readOptional(map, "logoMediaId"),
    faviconMediaId: readOptional(map, "faviconMediaId"),
    websiteTitle: readString(map, "websiteTitle"),
    websiteDescription: readString(map, "websiteDescription"),
    seoKeywords: readString(map, "seoKeywords"),
    contactPhone: readString(map, "contactPhone"),
    emergencyPhone: readOptional(map, "emergencyPhone"),
    contactEmail: readString(map, "contactEmail"),
    admissionsEmail: readString(map, "admissionsEmail"),
    supportEmail: readString(map, "supportEmail"),
    campusAddress: readString(map, "campusAddress"),
    officeHours: readString(map, "officeHours"),
    socialFacebook: readOptional(map, "socialFacebook"),
    socialTwitter: readOptional(map, "socialTwitter"),
    socialLinkedIn: readOptional(map, "socialLinkedIn"),
    socialYouTube: readOptional(map, "socialYouTube"),
    socialInstagram: readOptional(map, "socialInstagram"),
    themePrimary: readString(map, "themePrimary"),
    themeSecondary: readString(map, "themeSecondary"),
    themeAccent: readString(map, "themeAccent"),
    websiteCopyright: readString(map, "websiteCopyright"),
    privacyPolicyUrl: readString(map, "privacyPolicyUrl"),
    termsOfUseUrl: readString(map, "termsOfUseUrl"),
  };
}

/** Public-safe website settings (no internal IDs required beyond logo refs). */
export async function getPublicCmsWebsiteSettings(): Promise<CmsWebsiteSettings> {
  return getCmsWebsiteSettings();
}

export async function patchCmsWebsiteSettings(
  patch: CmsWebsiteSettingsPatch
): Promise<CmsWebsiteSettings> {
  const entries = Object.entries(patch).filter(
    ([, v]) => v !== undefined
  ) as Array<[keyof CmsWebsiteSettings, string]>;

  if (entries.length > 0) {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      )
    );
  }

  return getCmsWebsiteSettings();
}

export { DEFAULTS as CMS_WEBSITE_SETTING_DEFAULTS };
