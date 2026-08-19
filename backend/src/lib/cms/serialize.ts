import type {
  CmsEvent,
  CmsFacultyMarketing,
  CmsMediaAsset,
  CmsNavItem,
  CmsNewsPost,
  CmsPage,
  CmsPageBlock,
  CmsProgramMarketing,
  CmsPublishStatus,
} from "@prisma/client";

import { parseJsonPayload } from "./blockSchemas.js";
import {
  parseCmsLocale,
  pickLocalized,
  resolveBlockPayloadForLocale,
  type CmsLocale,
} from "./i18n.js";

export type SerializeLocaleOpts = {
  /** When set, resolve localized page/news/event fields + block payloads. */
  lang?: CmsLocale | string;
  includeDraftMeta?: boolean;
};

function localeFromOpts(opts?: SerializeLocaleOpts): CmsLocale {
  return parseCmsLocale(opts?.lang);
}

export function serializePage(
  page: CmsPage & { blocks?: CmsPageBlock[] },
  opts?: SerializeLocaleOpts
) {
  const lang = localeFromOpts(opts);
  const title = pickLocalized(lang, page.title, page.titleSo, page.titleAr);
  const metaDescription = pickLocalized(
    lang,
    page.metaDescription,
    page.metaDescriptionSo,
    page.metaDescriptionAr
  );

  return {
    id: page.id,
    slug: page.slug,
    title,
    metaDescription: metaDescription || null,
    titleEn: page.title,
    titleSo: page.titleSo,
    titleAr: page.titleAr,
    metaDescriptionEn: page.metaDescription,
    metaDescriptionSo: page.metaDescriptionSo,
    metaDescriptionAr: page.metaDescriptionAr,
    status: page.status,
    publishedAt: page.publishedAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
    locale: lang,
    blocks: (page.blocks ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) =>
        serializeBlock(b, opts?.lang != null ? lang : undefined)
      ),
    ...(opts?.includeDraftMeta ? { preview: true } : {}),
  };
}

/**
 * @param lang When provided (public `?lang=`), resolve SO/AR overrides into payload.
 *             When omitted (admin), return full payload including `i18n`.
 */
export function serializeBlock(block: CmsPageBlock, lang?: CmsLocale) {
  const raw = parseJsonPayload(block.jsonPayload);
  return {
    id: block.id,
    pageId: block.pageId,
    blockType: block.blockType,
    schemaVersion: block.schemaVersion,
    sortOrder: block.sortOrder,
    payload:
      lang != null ? resolveBlockPayloadForLocale(raw, lang) : raw,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };
}

export function serializeNews(post: CmsNewsPost, opts?: SerializeLocaleOpts) {
  const lang = localeFromOpts(opts);
  return {
    id: post.id,
    slug: post.slug,
    title: pickLocalized(lang, post.title, post.titleSo, post.titleAr),
    excerpt: pickLocalized(lang, post.excerpt, post.excerptSo, post.excerptAr) || null,
    body: pickLocalized(lang, post.body, post.bodySo, post.bodyAr),
    titleEn: post.title,
    titleSo: post.titleSo,
    titleAr: post.titleAr,
    excerptEn: post.excerpt,
    excerptSo: post.excerptSo,
    excerptAr: post.excerptAr,
    bodyEn: post.body,
    bodySo: post.bodySo,
    bodyAr: post.bodyAr,
    category: post.category,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    coverMediaId: post.coverMediaId,
    coverUrl: post.coverMediaId
      ? `/api/public/cms/media/${post.coverMediaId}/file`
      : null,
    locale: lang,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function serializeEvent(event: CmsEvent, opts?: SerializeLocaleOpts) {
  const lang = localeFromOpts(opts);
  return {
    id: event.id,
    title: pickLocalized(lang, event.title, event.titleSo, event.titleAr),
    description: pickLocalized(
      lang,
      event.description,
      event.descriptionSo,
      event.descriptionAr
    ),
    location:
      pickLocalized(lang, event.location, event.locationSo, event.locationAr) ||
      null,
    titleEn: event.title,
    titleSo: event.titleSo,
    titleAr: event.titleAr,
    descriptionEn: event.description,
    descriptionSo: event.descriptionSo,
    descriptionAr: event.descriptionAr,
    locationEn: event.location,
    locationSo: event.locationSo,
    locationAr: event.locationAr,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    registrationUrl: event.registrationUrl,
    status: event.status,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    coverMediaId: event.coverMediaId,
    coverUrl: event.coverMediaId
      ? `/api/public/cms/media/${event.coverMediaId}/file`
      : null,
    locale: lang,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function serializeNavItem(item: CmsNavItem) {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    location: item.location,
    sortOrder: item.sortOrder,
    visible: item.visible,
    parentId: item.parentId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeMedia(asset: CmsMediaAsset) {
  return {
    id: asset.id,
    originalName: asset.originalName,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
    caption: asset.caption,
    downloadCount: asset.downloadCount,
    uploadedById: asset.uploadedById,
    createdAt: asset.createdAt.toISOString(),
    url: `/api/public/cms/media/${asset.id}/file`,
    downloadUrl: `/api/public/cms/media/${asset.id}/download`,
  };
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function serializeFacultyMarketing(row: CmsFacultyMarketing) {
  return {
    id: row.id,
    facultyKey: row.facultyKey,
    name: row.name,
    shortName: row.shortName,
    heroImageUrl: row.heroImageUrl,
    overviewHtml: row.overviewHtml,
    careerProspectsHtml: row.careerProspectsHtml,
    admissionRequirementsHtml: row.admissionRequirementsHtml,
    deanWelcomeHtml: row.deanWelcomeHtml,
    departments: parseStringArray(row.departmentsJson),
    degrees: parseStringArray(row.degreesJson),
    duration: row.duration,
    credits: row.credits,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeProgramMarketing(row: CmsProgramMarketing) {
  return {
    id: row.id,
    programKey: row.programKey,
    facultyKey: row.facultyKey,
    title: row.title,
    degreeTitle: row.degreeTitle,
    overviewHtml: row.overviewHtml,
    duration: row.duration,
    creditHours: row.creditHours,
    tuitionPerSemester: row.tuitionPerSemester,
    careerOpportunitiesHtml: row.careerOpportunitiesHtml,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const PUBLISHED: CmsPublishStatus = "PUBLISHED";
