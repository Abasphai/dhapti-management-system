/**
 * Public news/events CMS helpers + approved hardcoded Dhapti fallbacks.
 */
import { getStoredLocale } from "@/context/LocaleContext";
import { newsFeed, upcomingEvents, type NewsItem } from "@/data/publicSite";
import { API_BASE_URL } from "@/lib/api";

const API_BASE = API_BASE_URL;

export type NewsCategory =
  | "Campus News"
  | "Research"
  | "Admissions"
  | "Events";

export type CmsNewsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CmsEvent = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  registrationUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CmsMediaAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  altText: string | null;
  caption: string | null;
  url: string;
  createdAt: string;
};

export type PublicEventCard = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  registrationUrl?: string | null;
  image: string;
};

/** High-res academic Unsplash covers — never use dhapti-logo for thumbnails. */
export const NEWS_COVER_IMAGES = {
  Research:
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop",
  Admissions:
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop",
  "Campus News":
    "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop",
  Events:
    "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop",
} as const;

export const EVENT_COVER_IMAGE = NEWS_COVER_IMAGES.Events;

function isWeakCoverUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return true;
  if (u.includes("dhapti-logo")) return true;
  if (u.startsWith("/images/slide")) return true;
  return false;
}

export function resolveNewsCoverImage(
  category: string,
  coverUrl?: string | null
): string {
  if (coverUrl && !isWeakCoverUrl(coverUrl)) return coverUrl;
  if (category in NEWS_COVER_IMAGES) {
    return NEWS_COVER_IMAGES[category as NewsCategory];
  }
  return NEWS_COVER_IMAGES["Campus News"];
}

export function resolveEventCoverImage(coverUrl?: string | null): string {
  if (coverUrl && !isWeakCoverUrl(coverUrl)) return coverUrl;
  return EVENT_COVER_IMAGE;
}

/** Vivid category pills for dark news cards. */
export function newsCategoryBadgeClass(category: string): string {
  switch (category) {
    case "Research":
      return "bg-orange-500 text-white";
    case "Admissions":
      return "bg-[#16a34a] text-white";
    case "Events":
      return "bg-sky-500 text-white";
    case "Campus News":
    default:
      return "bg-[#ea580c] text-white";
  }
}

function plainTextExcerpt(htmlOrText: string, max = 160): string {
  const plain = htmlOrText
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  "Campus News",
  "Research",
  "Admissions",
  "Events",
];

export const FALLBACK_NEWS: NewsItem[] = newsFeed.map((item) => ({
  ...item,
  image: resolveNewsCoverImage(item.category, item.image),
}));

export const FALLBACK_EVENTS: PublicEventCard[] = upcomingEvents.map(
  (e, i) => ({
    id: `fallback-event-${i}`,
    title: e.title,
    date: e.date,
    time: e.time,
    location: e.location,
    image: EVENT_COVER_IMAGE,
  })
);

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatNewsDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventTime(iso: string, endIso?: string | null): string {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const startLabel = start.toLocaleTimeString("en-US", opts);
  if (!endIso) return startLabel;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel} – ${end.toLocaleTimeString("en-US", opts)}`;
}

export function mapCmsNewsToPublic(post: CmsNewsPost): NewsItem {
  const category = NEWS_CATEGORIES.includes(post.category as NewsCategory)
    ? (post.category as NewsCategory)
    : "Campus News";
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt || plainTextExcerpt(post.body),
    date: formatNewsDate(post.publishedAt || post.createdAt),
    category,
    image: resolveNewsCoverImage(category, post.coverUrl),
  };
}

export function mapCmsEventToPublic(event: CmsEvent): PublicEventCard {
  return {
    id: event.id,
    title: event.title,
    date: formatEventDate(event.startsAt),
    time: formatEventTime(event.startsAt, event.endsAt),
    location: event.location || "Dhapti Campus",
    registrationUrl: event.registrationUrl,
    image: resolveEventCoverImage(event.coverUrl),
  };
}

export async function fetchPublishedNews(): Promise<NewsItem[]> {
  try {
    const lang = getStoredLocale();
    const res = await fetch(
      `${API_BASE}/public/cms/news?lang=${encodeURIComponent(lang)}`
    );
    if (!res.ok) return FALLBACK_NEWS;
    const body = (await res.json()) as { data?: CmsNewsPost[] };
    const rows = Array.isArray(body.data) ? body.data : [];
    if (rows.length === 0) return FALLBACK_NEWS;
    return rows.map(mapCmsNewsToPublic);
  } catch {
    return FALLBACK_NEWS;
  }
}

export async function fetchPublishedEvents(): Promise<PublicEventCard[]> {
  try {
    const lang = getStoredLocale();
    const res = await fetch(
      `${API_BASE}/public/cms/events?lang=${encodeURIComponent(lang)}`
    );
    if (!res.ok) return FALLBACK_EVENTS;
    const body = (await res.json()) as { data?: CmsEvent[] };
    const rows = Array.isArray(body.data) ? body.data : [];
    if (rows.length === 0) return FALLBACK_EVENTS;
    return rows.map(mapCmsEventToPublic);
  } catch {
    return FALLBACK_EVENTS;
  }
}

export function mediaPublicUrl(assetId: string): string {
  return `${API_BASE}/public/cms/media/${assetId}/file`;
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
