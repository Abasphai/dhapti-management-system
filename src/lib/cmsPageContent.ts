/**
 * CMS page content helpers + approved hardcoded Dhapti fallbacks for Home/About.
 */
import {
  DHAPTI_IMAGES,
  historyTimeline,
  leadership,
} from "@/data/publicSite";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export type CmsPageBlock = {
  id?: string;
  blockType: string;
  schemaVersion: number;
  sortOrder: number;
  payload: unknown;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  metaDescription?: string | null;
  titleSo?: string | null;
  titleAr?: string | null;
  metaDescriptionSo?: string | null;
  metaDescriptionAr?: string | null;
  titleEn?: string | null;
  metaDescriptionEn?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  locale?: string;
  blocks: CmsPageBlock[];
};

export type HeroSlide = {
  title: string;
  subtitle?: string;
  description: string;
  imageUrl: string;
  /** Legacy/alternate field — prefer imageUrl */
  image?: string;
  /** Legacy CMS field — mapped to imageUrl on read */
  backgroundUrl?: string;
  buttonText: string;
  buttonLink: string;
  imagePos?: "object-top" | "object-center" | "object-bottom";
};

/** Legacy paths kept for CMS/back-compat; resolved to remote URLs below. */
export const LEGACY_SLIDE_IMAGE_PATHS = [
  "/images/slide1.jpg",
  "/images/slide2.jpg",
  "/images/slide3.jpg",
  "/images/slide4.jpg",
  "/images/slide5.jpg",
] as const;

/** Working hero backgrounds — high-res Unsplash CDN (globally reachable). */
export const DEFAULT_SLIDE_IMAGES = [
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1920&auto=format&fit=crop",
] as const;

/** Absolute last-resort CDN image if every Unsplash URL fails. */
export const HERO_CDN_LAST_RESORT =
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1920&auto=format&fit=crop";


const LEGACY_PATH_TO_REMOTE = Object.fromEntries(
  LEGACY_SLIDE_IMAGE_PATHS.map((path, i) => [path, DEFAULT_SLIDE_IMAGES[i]!])
) as Record<string, string>;

function upgradeLegacySlidePath(url: string, index: number): string {
  const mapped = LEGACY_PATH_TO_REMOTE[url];
  if (mapped) return mapped;
  if (/^\/images\/slide\d+\.jpe?g$/i.test(url)) {
    return DEFAULT_SLIDE_IMAGES[index % DEFAULT_SLIDE_IMAGES.length]!;
  }
  return url;
}

export type SlideImageFields = {
  imageUrl?: string | null;
  image?: string | null;
  backgroundUrl?: string | null;
};

/**
 * Bulletproof slide image resolver — never returns empty string.
 * Checks imageUrl, image, and backgroundUrl (legacy CMS fields).
 */
export function resolveSlideImage(
  slide: SlideImageFields | null | undefined,
  index = 0
): string {
  const candidate = slide?.imageUrl || slide?.image || slide?.backgroundUrl;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return upgradeLegacySlidePath(candidate.trim(), index);
  }
  return DEFAULT_SLIDE_IMAGES[index % DEFAULT_SLIDE_IMAGES.length]!;
}

/** Alias used by UI components */
export const getSlideImage = resolveSlideImage;

/** When img onError fires: step through alternate stock photos for this index. */
export function slideImageOnErrorSrc(currentSrc: string, index = 0): string {
  const pool = [
    DEFAULT_SLIDE_IMAGES[index % DEFAULT_SLIDE_IMAGES.length]!,
    DEFAULT_SLIDE_IMAGES[(index + 1) % DEFAULT_SLIDE_IMAGES.length]!,
    DEFAULT_SLIDE_IMAGES[(index + 2) % DEFAULT_SLIDE_IMAGES.length]!,
    DEFAULT_SLIDE_IMAGES[(index + 3) % DEFAULT_SLIDE_IMAGES.length]!,
    HERO_CDN_LAST_RESORT,
  ];
  const next = pool.find((url) => url !== currentSrc);
  return next ?? HERO_CDN_LAST_RESORT;
}

export function normalizeHeroSlide(slide: HeroSlide, index: number): HeroSlide {
  return {
    ...slide,
    imageUrl: resolveSlideImage(slide, index),
  };
}

export function normalizeHeroSlides(slides: HeroSlide[]): HeroSlide[] {
  return slides.map((slide, index) => normalizeHeroSlide(slide, index));
}

export type WhyChooseStat = {
  value: number;
  suffix: string;
  label: string;
};

export type WhyChooseFeature = {
  title: string;
  description: string;
  icon:
    | "GraduationCap"
    | "Users"
    | "Globe"
    | "Lightbulb"
    | "Award"
    | "HeartHandshake";
};

export type WhyChoosePayload = {
  sectionLabel: string;
  sectionTitle: string;
  sectionDescription: string;
  stats: WhyChooseStat[];
  features: WhyChooseFeature[];
};

export type RectorPayload = {
  name: string;
  title: string;
  photoUrl: string;
  message: string;
  eyebrow: string;
  heading: string;
  ctaLabel: string;
  ctaHref: string;
};

export type MissionVisionPayload = {
  missionEyebrow: string;
  missionHeading: string;
  missionBody: string;
  visionEyebrow: string;
  visionHeading: string;
  visionBody: string;
};

export type HistoryPayload = {
  sectionTitle: string;
  items: Array<{ year: string; title: string; text: string }>;
};

export type LeadershipPayload = {
  sectionTitle: string;
  people: Array<{
    name: string;
    role: string;
    bio: string;
    imageUrl: string;
  }>;
};

export const FALLBACK_HERO_SLIDES: HeroSlide[] = [
  {
    imageUrl: DEFAULT_SLIDE_IMAGES[0]!,
    title: "Welcome To Dhapti",
    subtitle: "",
    description:
      "“Aqoontu waa iftiin, akhriskuna waa fure.” Build your future with world-class education.",
    buttonText: "Apply Now",
    buttonLink: "/admissions",
    imagePos: "object-top",
  },
  {
    imageUrl: DEFAULT_SLIDE_IMAGES[1]!,
    title: "Admission Open 2026",
    subtitle: "",
    description:
      "“Education is the most powerful weapon which you can use to change the world.” Join us today.",
    buttonText: "Register Now",
    buttonLink: "/admissions",
    imagePos: "object-center",
  },
  {
    imageUrl: DEFAULT_SLIDE_IMAGES[2]!,
    title: "Modern Tech Labs",
    subtitle: "",
    description:
      "“Innovation distinguishes between a leader and a follower.” Explore our digital campus.",
    buttonText: "Explore Labs",
    buttonLink: "/campus-life#labs",
    imagePos: "object-top",
  },
  {
    imageUrl: DEFAULT_SLIDE_IMAGES[3]!,
    title: "Expert Faculty",
    subtitle: "",
    description:
      "“Success is the sum of small efforts, repeated day in and day out.” Learn from the best.",
    buttonText: "Meet Faculty",
    buttonLink: "/faculties",
    imagePos: "object-center",
  },
  {
    imageUrl: DEFAULT_SLIDE_IMAGES[4]!,
    title: "Merit Scholarships",
    subtitle: "",
    description:
      "“The roots of education are bitter, but the fruit is sweet.” Avail up to 50% scholarships.",
    buttonText: "Learn More",
    buttonLink: "/admissions",
    imagePos: "object-top",
  },
];

export const FALLBACK_WHY_CHOOSE: WhyChoosePayload = {
  sectionLabel: "Why Dhapti",
  sectionTitle: "Why Choose Dhapti?",
  sectionDescription:
    "Discover what makes Dhapti University the preferred choice for students seeking excellence in higher education.",
  stats: [
    { value: 15, suffix: "+", label: "Faculties & Programs" },
    { value: 120, suffix: "+", label: "Faculty Members" },
    { value: 2500, suffix: "+", label: "Enrolled Students" },
    { value: 95, suffix: "%", label: "Graduate Employment" },
  ],
  features: [
    {
      icon: "GraduationCap",
      title: "Accredited Programs",
      description:
        "Nationally recognized degree programs designed to meet international academic standards.",
    },
    {
      icon: "Users",
      title: "Expert Faculty",
      description:
        "Learn from experienced professors and industry professionals dedicated to student success.",
    },
    {
      icon: "Globe",
      title: "Global Partnerships",
      description:
        "Collaborations with international universities opening doors to exchange and research.",
    },
    {
      icon: "Lightbulb",
      title: "Innovation Focus",
      description:
        "Modern labs, digital resources, and research centers fostering creative problem-solving.",
    },
    {
      icon: "Award",
      title: "Career Support",
      description:
        "Dedicated career services, internships, and alumni networks to launch your professional journey.",
    },
    {
      icon: "HeartHandshake",
      title: "Inclusive Community",
      description:
        "A welcoming campus culture that celebrates diversity and supports every student's growth.",
    },
  ],
};

export const FALLBACK_RECTOR: RectorPayload = {
  name: leadership[0].name,
  title: leadership[0].role,
  photoUrl: leadership[0].image,
  message:
    "At Dhapti University, we believe education is the cornerstone of national renewal. Our faculties, staff, and partners work each day to prepare graduates who lead with wisdom, effort, integrity, and innovation — for Dhapti, for Somalia, and for the region.",
  eyebrow: "Leadership",
  heading: "Message from the University Rector",
  ctaLabel: "Learn more about Dhapti",
  ctaHref: "/about",
};

export const FALLBACK_MISSION_VISION: MissionVisionPayload = {
  missionEyebrow: "Mission",
  missionHeading: "Educate. Empower. Transform.",
  missionBody:
    "To deliver high-quality teaching, research, and community service that prepare graduates to lead Somalia’s social and economic transformation with competence and character.",
  visionEyebrow: "Vision",
  visionHeading: "A premier regional university of choice",
  visionBody:
    "To be recognized across East Africa as a trusted university that blends academic excellence, ethical leadership, and practical innovation for community impact.",
};

export const FALLBACK_HISTORY: HistoryPayload = {
  sectionTitle: "History of Dhapti University",
  items: historyTimeline.map((i) => ({
    year: i.year,
    title: i.title,
    text: i.text,
  })),
};

export const FALLBACK_LEADERSHIP: LeadershipPayload = {
  sectionTitle: "University Leadership",
  people: leadership.map((p) => ({
    name: p.name,
    role: p.role,
    bio: p.bio,
    imageUrl: p.image,
  })),
};

export const FALLBACK_ABOUT_HERO = {
  title: "About Dhapti University",
  subtitle:
    "A center of wisdom, effort, integrity, and innovation serving Somalia’s next generation of leaders.",
  image: DHAPTI_IMAGES.campus,
};

export async function fetchPublishedCmsPage(
  slug: string,
  lang?: string
): Promise<CmsPage | null> {
  try {
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    const res = await fetch(`${API_BASE}/public/cms/pages/${slug}${qs}`);
    if (!res.ok) return null;
    return (await res.json()) as CmsPage;
  } catch {
    return null;
  }
}

export type RichTextBlockPayload = {
  heading?: string;
  body?: string;
  i18n?: {
    so?: Record<string, unknown>;
    ar?: Record<string, unknown>;
  };
};

export type FaqAccordionBlockPayload = {
  sectionTitle?: string;
  items: Array<{ question: string; answer: string }>;
  i18n?: {
    so?: Record<string, unknown>;
    ar?: Record<string, unknown>;
  };
};

export type DownloadsBlockPayload = {
  sectionTitle?: string;
  items: Array<{
    title: string;
    description?: string;
    mediaId: string;
    fileName?: string;
  }>;
  i18n?: {
    so?: Record<string, unknown>;
    ar?: Record<string, unknown>;
  };
};

export type CalloutBannerBlockPayload = {
  title: string;
  body?: string;
  ctaLabel: string;
  ctaHref: string;
  backgroundImageUrl?: string;
  backgroundMediaId?: string | null;
  i18n?: {
    so?: Record<string, unknown>;
    ar?: Record<string, unknown>;
  };
};

export function mediaDownloadUrl(mediaId: string): string {
  return `${API_BASE}/public/cms/media/${mediaId}/download`;
}

export function findBlockPayload<T>(
  page: CmsPage | null | undefined,
  blockType: string
): T | null {
  if (!page?.blocks?.length) return null;
  const block = page.blocks.find((b) => b.blockType === blockType);
  if (!block || !block.payload || typeof block.payload !== "object") {
    return null;
  }
  return block.payload as T;
}

export function defaultHomeBlocks(): Array<{
  blockType: string;
  schemaVersion: number;
  sortOrder: number;
  payload: unknown;
}> {
  return [
    {
      blockType: "HERO_SLIDER",
      schemaVersion: 1,
      sortOrder: 0,
      payload: { slides: FALLBACK_HERO_SLIDES },
    },
    {
      blockType: "WHY_CHOOSE",
      schemaVersion: 1,
      sortOrder: 1,
      payload: FALLBACK_WHY_CHOOSE,
    },
    {
      blockType: "RECTOR_MESSAGE",
      schemaVersion: 1,
      sortOrder: 2,
      payload: FALLBACK_RECTOR,
    },
  ];
}

export function defaultAboutBlocks(): Array<{
  blockType: string;
  schemaVersion: number;
  sortOrder: number;
  payload: unknown;
}> {
  return [
    {
      blockType: "ABOUT_MISSION_VISION",
      schemaVersion: 1,
      sortOrder: 0,
      payload: FALLBACK_MISSION_VISION,
    },
    {
      blockType: "ABOUT_HISTORY",
      schemaVersion: 1,
      sortOrder: 1,
      payload: FALLBACK_HISTORY,
    },
    {
      blockType: "ABOUT_LEADERSHIP",
      schemaVersion: 1,
      sortOrder: 2,
      payload: FALLBACK_LEADERSHIP,
    },
  ];
}
