import { Router } from "express";

import { getPublicCmsWebsiteSettings } from "../lib/cmsWebsiteSettings.js";
import { parseCmsLocale } from "../lib/cms/i18n.js";
import { sendError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { getCmsMediaStorage } from "../lib/cms/mediaStorage.js";
import {
  PUBLISHED,
  serializeEvent,
  serializeFacultyMarketing,
  serializeMedia,
  serializeNavItem,
  serializeNews,
  serializePage,
  serializeProgramMarketing,
} from "../lib/cms/serialize.js";

/**
 * Anonymous public CMS reads — PUBLISHED content only.
 * Draft/Archived are never returned. Preview is NOT supported here.
 * Optional `?lang=en|so|ar` resolves localized fields (fallback: English).
 */
export const cmsPublicRouter = Router();

cmsPublicRouter.get("/public/cms/settings", async (_req, res) => {
  const settings = await getPublicCmsWebsiteSettings();
  return res.json(settings);
});

cmsPublicRouter.get("/public/cms/pages/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    return sendError(res, 400, "BAD_REQUEST", "slug is required");
  }
  const lang = parseCmsLocale(req.query.lang);
  const page = await prisma.cmsPage.findFirst({
    where: { slug, status: PUBLISHED },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) {
    return sendError(res, 404, "NOT_FOUND", "Page not found");
  }
  return res.json(serializePage(page, { lang }));
});

cmsPublicRouter.get("/public/cms/news", async (req, res) => {
  const lang = parseCmsLocale(req.query.lang);
  const rows = await prisma.cmsNewsPost.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return res.json({ data: rows.map((r) => serializeNews(r, { lang })) });
});

cmsPublicRouter.get("/public/cms/news/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  const lang = parseCmsLocale(req.query.lang);
  const post = await prisma.cmsNewsPost.findFirst({
    where: { slug, status: PUBLISHED },
  });
  if (!post) {
    return sendError(res, 404, "NOT_FOUND", "News post not found");
  }
  return res.json(serializeNews(post, { lang }));
});

cmsPublicRouter.get("/public/cms/events", async (req, res) => {
  const lang = parseCmsLocale(req.query.lang);
  const rows = await prisma.cmsEvent.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ startsAt: "asc" }],
  });
  return res.json({ data: rows.map((r) => serializeEvent(r, { lang })) });
});

cmsPublicRouter.get("/public/cms/nav", async (req, res) => {
  const location = String(req.query.location || "").toUpperCase();
  const where =
    location === "HEADER" || location === "FOOTER"
      ? { location: location as "HEADER" | "FOOTER", visible: true }
      : { visible: true };
  const rows = await prisma.cmsNavItem.findMany({
    where,
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }],
  });
  return res.json({ data: rows.map(serializeNavItem) });
});

cmsPublicRouter.get("/public/cms/media/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return sendError(res, 404, "NOT_FOUND", "Media not found");
  }
  return res.json(serializeMedia(asset));
});

cmsPublicRouter.get("/public/cms/media/:id/file", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return sendError(res, 404, "NOT_FOUND", "Media not found");
  }
  try {
    const storage = getCmsMediaStorage();
    const stream = await storage.openReadStream(asset.storageKey);
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${asset.originalName.replace(/"/g, "")}"`
    );
    stream.pipe(res);
  } catch {
    return sendError(res, 404, "NOT_FOUND", "Media file missing");
  }
});

/** Increment download counter and stream as attachment (Downloads block). */
cmsPublicRouter.get("/public/cms/media/:id/download", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return sendError(res, 404, "NOT_FOUND", "Media not found");
  }
  try {
    await prisma.cmsMediaAsset.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
    const storage = getCmsMediaStorage();
    const stream = await storage.openReadStream(asset.storageKey);
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asset.originalName.replace(/"/g, "")}"`
    );
    stream.pipe(res);
  } catch {
    return sendError(res, 404, "NOT_FOUND", "Media file missing");
  }
});

cmsPublicRouter.get("/public/cms/faculties", async (_req, res) => {
  const rows = await prisma.cmsFacultyMarketing.findMany({
    where: { status: PUBLISHED },
    orderBy: { name: "asc" },
  });
  return res.json({ data: rows.map(serializeFacultyMarketing) });
});

cmsPublicRouter.get("/public/cms/faculties/:facultyKey", async (req, res) => {
  const facultyKey = String(req.params.facultyKey || "").trim();
  const row = await prisma.cmsFacultyMarketing.findFirst({
    where: { facultyKey, status: PUBLISHED },
  });
  if (!row) {
    return sendError(res, 404, "NOT_FOUND", "Faculty marketing not found");
  }
  return res.json(serializeFacultyMarketing(row));
});

cmsPublicRouter.get("/public/cms/programs", async (req, res) => {
  const facultyKey = String(req.query.facultyKey || "").trim();
  const rows = await prisma.cmsProgramMarketing.findMany({
    where: {
      status: PUBLISHED,
      ...(facultyKey ? { facultyKey } : {}),
    },
    orderBy: [{ facultyKey: "asc" }, { title: "asc" }],
  });
  return res.json({ data: rows.map(serializeProgramMarketing) });
});
