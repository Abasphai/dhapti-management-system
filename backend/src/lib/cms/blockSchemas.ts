import { z } from "zod";

import { sanitizeCmsHtml } from "./sanitizeHtml.js";
import { DEFAULT_HERO_SLIDER_SLIDES } from "./defaultHeroSlides.js";

export { DEFAULT_HERO_SLIDER_SLIDES };

/**
 * Block payload validation by (blockType, schemaVersion).
 * Admins use typed forms; raw JSON is never exposed in the UI.
 */

const ctaSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(300),
});

const heroV1 = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(400).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
  imageMediaId: z.string().trim().max(64).optional().nullable(),
  ctas: z.array(ctaSchema).max(4).optional().default([]),
});

const richTextV1 = z.object({
  heading: z.string().trim().max(200).optional().default(""),
  body: z.string().trim().max(50_000).default(""),
});

/** Optional SO/AR overrides nested under `i18n` (Phase 6). */
function withI18n<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    ...shape,
    i18n: z
      .object({
        so: z.record(z.string(), z.unknown()).optional(),
        ar: z.record(z.string(), z.unknown()).optional(),
      })
      .optional()
      .default({}),
  });
}

const richTextBlockV1 = withI18n({
  heading: z.string().trim().max(200).optional().default(""),
  body: z.string().trim().max(50_000).default(""),
});

const faqAccordionBlockV1 = withI18n({
  sectionTitle: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("Frequently Asked Questions"),
  items: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().min(1).max(20_000),
      })
    )
    .min(1)
    .max(40),
});

const downloadsBlockV1 = withI18n({
  sectionTitle: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("Downloads"),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).optional().default(""),
        mediaId: z.string().trim().min(1).max(64),
        fileName: z.string().trim().max(200).optional().default(""),
      })
    )
    .min(1)
    .max(40),
});

const calloutBannerBlockV1 = withI18n({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().default(""),
  ctaLabel: z.string().trim().min(1).max(80),
  ctaHref: z.string().trim().min(1).max(300),
  backgroundImageUrl: z.string().trim().max(500).optional().default(""),
  backgroundMediaId: z.string().trim().max(64).optional().nullable(),
});

const statsV1 = z.object({
  items: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(80),
      })
    )
    .min(1)
    .max(8),
});

const imageBannerV1 = z.object({
  imageMediaId: z.string().trim().min(1).max(64),
  altText: z.string().trim().max(200).optional().default(""),
  caption: z.string().trim().max(300).optional().default(""),
});

/** Homepage hero carousel (Phase 3) */
const heroSliderV1 = z.object({
  slides: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        subtitle: z.string().trim().max(200).optional().default(""),
        description: z.string().trim().max(2000).optional().default(""),
        imageUrl: z.string().trim().max(500).optional(),
        image: z.string().trim().max(500).optional(),
        backgroundUrl: z.string().trim().max(500).optional(),
        buttonText: z.string().trim().min(1).max(80),
        buttonLink: z.string().trim().min(1).max(300),
        imagePos: z
          .enum(["object-top", "object-center", "object-bottom"])
          .optional()
          .default("object-center"),
      })
      .refine(
        (s) =>
          Boolean(
            s.imageUrl?.trim() || s.image?.trim() || s.backgroundUrl?.trim()
          ),
        { message: "imageUrl, image, or backgroundUrl is required" }
      )
      .transform((slide) => ({
        ...slide,
        imageUrl: (
          slide.imageUrl?.trim() ||
          slide.image?.trim() ||
          slide.backgroundUrl?.trim() ||
          ""
        ).slice(0, 500),
      }))
    )
    .min(1)
    .max(12),
});

/** Why Choose Dhapti — stats + feature cards */
const whyChooseV1 = z.object({
  sectionLabel: z.string().trim().max(80).optional().default("Why Dhapti"),
  sectionTitle: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .default("Why Choose Dhapti?"),
  sectionDescription: z.string().trim().max(800).optional().default(""),
  stats: z
    .array(
      z.object({
        value: z.number().int().min(0).max(1_000_000),
        suffix: z.string().trim().max(8).optional().default(""),
        label: z.string().trim().min(1).max(80),
      })
    )
    .min(1)
    .max(8),
  features: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(500),
        icon: z
          .enum([
            "GraduationCap",
            "Users",
            "Globe",
            "Lightbulb",
            "Award",
            "HeartHandshake",
          ])
          .optional()
          .default("GraduationCap"),
      })
    )
    .min(1)
    .max(12),
});

/** Rector message on homepage */
const rectorMessageV1 = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  photoUrl: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(50_000),
  eyebrow: z.string().trim().max(80).optional().default("Leadership"),
  heading: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("Message from the University Rector"),
  ctaLabel: z.string().trim().max(80).optional().default("Learn more about Dhapti"),
  ctaHref: z.string().trim().max(300).optional().default("/about"),
});

/** About — mission & vision */
const aboutMissionVisionV1 = z.object({
  missionEyebrow: z.string().trim().max(40).optional().default("Mission"),
  missionHeading: z.string().trim().min(1).max(200),
  missionBody: z.string().trim().min(1).max(50_000),
  visionEyebrow: z.string().trim().max(40).optional().default("Vision"),
  visionHeading: z.string().trim().min(1).max(200),
  visionBody: z.string().trim().min(1).max(50_000),
});

/** About — history timeline */
const aboutHistoryV1 = z.object({
  sectionTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("History of Dhapti University"),
  items: z
    .array(
      z.object({
        year: z.string().trim().min(1).max(20),
        title: z.string().trim().min(1).max(160),
        text: z.string().trim().min(1).max(20_000),
      })
    )
    .min(1)
    .max(30),
});

/** About — leadership cards */
const aboutLeadershipV1 = z.object({
  sectionTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("University Leadership"),
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        role: z.string().trim().min(1).max(160),
        bio: z.string().trim().min(1).max(1000),
        imageUrl: z.string().trim().min(1).max(500),
      })
    )
    .min(1)
    .max(24),
});

type BlockSchema = z.ZodTypeAny;

const REGISTRY: Record<string, Record<number, BlockSchema>> = {
  HERO: { 1: heroV1 },
  RICH_TEXT: { 1: richTextV1 },
  RICH_TEXT_BLOCK: { 1: richTextBlockV1 },
  FAQ_ACCORDION_BLOCK: { 1: faqAccordionBlockV1 },
  DOWNLOADS_BLOCK: { 1: downloadsBlockV1 },
  CALLOUT_BANNER_BLOCK: { 1: calloutBannerBlockV1 },
  STATS: { 1: statsV1 },
  IMAGE_BANNER: { 1: imageBannerV1 },
  HERO_SLIDER: { 1: heroSliderV1 },
  WHY_CHOOSE: { 1: whyChooseV1 },
  RECTOR_MESSAGE: { 1: rectorMessageV1 },
  ABOUT_MISSION_VISION: { 1: aboutMissionVisionV1 },
  ABOUT_HISTORY: { 1: aboutHistoryV1 },
  ABOUT_LEADERSHIP: { 1: aboutLeadershipV1 },
};

export const KNOWN_BLOCK_TYPES = Object.keys(REGISTRY);

export const CUSTOM_PAGE_BLOCK_TYPES = [
  "RICH_TEXT_BLOCK",
  "FAQ_ACCORDION_BLOCK",
  "DOWNLOADS_BLOCK",
  "CALLOUT_BANNER_BLOCK",
] as const;

export function validateBlockPayload(
  blockType: string,
  schemaVersion: number,
  payload: unknown
):
  | { ok: true; data: unknown }
  | { ok: false; message: string } {
  const versions = REGISTRY[blockType];
  if (!versions) {
    return {
      ok: false,
      message: `Unknown blockType: ${blockType}`,
    };
  }
  const schema = versions[schemaVersion];
  if (!schema) {
    return {
      ok: false,
      message: `Unsupported schemaVersion ${schemaVersion} for ${blockType}`,
    };
  }
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      message: `Invalid payload for ${blockType} v${schemaVersion}`,
    };
  }
  return { ok: true, data: sanitizeBlockRichText(blockType, parsed.data) };
}

function sanitizeI18nHtmlFields(i18n: unknown, htmlKeys: string[]): unknown {
  if (!i18n || typeof i18n !== "object") return i18n;
  const out: Record<string, unknown> = {
    ...(i18n as Record<string, unknown>),
  };
  for (const locale of ["so", "ar"] as const) {
    const bag = out[locale];
    if (!bag || typeof bag !== "object") continue;
    const next = { ...(bag as Record<string, unknown>) };
    for (const key of htmlKeys) {
      if (typeof next[key] === "string") {
        next[key] = sanitizeCmsHtml(next[key] as string);
      }
    }
    if (Array.isArray(next.items)) {
      next.items = next.items.map((item) => {
        if (!item || typeof item !== "object") return item;
        const row = { ...(item as Record<string, unknown>) };
        if (typeof row.answer === "string") {
          row.answer = sanitizeCmsHtml(row.answer);
        }
        return row;
      });
    }
    out[locale] = next;
  }
  return out;
}

/** Sanitize known rich-text fields after Zod validation. */
function sanitizeBlockRichText(blockType: string, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const d = { ...(data as Record<string, unknown>) };

  if (
    (blockType === "RICH_TEXT" || blockType === "RICH_TEXT_BLOCK") &&
    typeof d.body === "string"
  ) {
    d.body = sanitizeCmsHtml(d.body);
  }
  if (blockType === "RICH_TEXT_BLOCK") {
    d.i18n = sanitizeI18nHtmlFields(d.i18n, ["body"]);
  }
  if (blockType === "FAQ_ACCORDION_BLOCK" && Array.isArray(d.items)) {
    d.items = d.items.map((item) => {
      if (!item || typeof item !== "object") return item;
      const row = { ...(item as Record<string, unknown>) };
      if (typeof row.answer === "string") {
        row.answer = sanitizeCmsHtml(row.answer);
      }
      return row;
    });
    d.i18n = sanitizeI18nHtmlFields(d.i18n, ["answer"]);
  }
  if (blockType === "RECTOR_MESSAGE" && typeof d.message === "string") {
    d.message = sanitizeCmsHtml(d.message);
  }
  if (blockType === "ABOUT_MISSION_VISION") {
    if (typeof d.missionBody === "string") {
      d.missionBody = sanitizeCmsHtml(d.missionBody);
    }
    if (typeof d.visionBody === "string") {
      d.visionBody = sanitizeCmsHtml(d.visionBody);
    }
  }
  if (blockType === "ABOUT_HISTORY" && Array.isArray(d.items)) {
    d.items = d.items.map((item) => {
      if (!item || typeof item !== "object") return item;
      const row = { ...(item as Record<string, unknown>) };
      if (typeof row.text === "string") {
        row.text = sanitizeCmsHtml(row.text);
      }
      return row;
    });
  }
  return d;
}

export function parseJsonPayload(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
