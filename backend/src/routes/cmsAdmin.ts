import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { writeCmsAudit } from "../lib/cms/audit.js";
import {
  CUSTOM_PAGE_BLOCK_TYPES,
  KNOWN_BLOCK_TYPES,
  validateBlockPayload,
} from "../lib/cms/blockSchemas.js";
import {
  getCmsMediaStorage,
  isAllowedCmsUpload,
} from "../lib/cms/mediaStorage.js";
import {
  isReservedCmsSlug,
  isSystemCmsPageSlug,
} from "../lib/cms/reservedSlugs.js";
import {
  serializeBlock,
  serializeEvent,
  serializeFacultyMarketing,
  serializeMedia,
  serializeNavItem,
  serializeNews,
  serializePage,
  serializeProgramMarketing,
} from "../lib/cms/serialize.js";
import { sanitizeCmsHtml } from "../lib/cms/sanitizeHtml.js";
import {
  cmsWebsiteSettingsPatchSchema,
  getCmsWebsiteSettings,
  patchCmsWebsiteSettings,
} from "../lib/cmsWebsiteSettings.js";
import { sendError } from "../lib/errors.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { getConfiguredMaxUploadFileMb } from "../lib/settings.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

/**
 * Admin CMS management — JWT + cms.* permissions + AuditLog on mutations.
 * Preview of drafts uses authenticated endpoints (never ?preview=1 on public).
 */
export const cmsAdminRouter = Router();
cmsAdminRouter.use(requireAuth);
cmsAdminRouter.use(requireRoles("ADMIN"));

const publishStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case");

const upload = multer({
  dest: "storage/tmp",
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function transitionStatus(
  current: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  action: "publish" | "unpublish" | "archive"
): Promise<"DRAFT" | "PUBLISHED" | "ARCHIVED" | null> {
  if (action === "publish" && current !== "PUBLISHED") return "PUBLISHED";
  if (action === "unpublish" && current === "PUBLISHED") return "DRAFT";
  if (action === "archive" && current !== "ARCHIVED") return "ARCHIVED";
  return null;
}

// ─── Settings (cms.settings.* only — not operational UMS keys) ───────────────

cmsAdminRouter.get(
  "/settings",
  requirePermission(Permission.CMS_SETTINGS_READ),
  async (_req, res) => {
    return res.json(await getCmsWebsiteSettings());
  }
);

cmsAdminRouter.patch(
  "/settings",
  requirePermission(Permission.CMS_SETTINGS_MANAGE),
  async (req: AuthedRequest, res) => {
    const parsed = cmsWebsiteSettingsPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid website settings");
    }
    const updated = await patchCmsWebsiteSettings(parsed.data);
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_SETTINGS_UPDATE",
      entityType: "SystemSetting",
      meta: { keys: Object.keys(parsed.data) },
    });
    return res.json(updated);
  }
);

// ─── Pages ───────────────────────────────────────────────────────────────────

cmsAdminRouter.get(
  "/pages",
  requirePermission(Permission.CMS_PAGES_READ),
  async (req, res) => {
    const scope = String(req.query.scope || "").trim().toLowerCase();
    const rows = await prisma.cmsPage.findMany({
      include: { blocks: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    const filtered =
      scope === "custom"
        ? rows.filter((p) => !isSystemCmsPageSlug(p.slug))
        : rows;
    return res.json({ data: filtered.map((p) => serializePage(p)) });
  }
);

/** Resolve page by slug (drafts included for admin editors). */
cmsAdminRouter.get(
  "/pages/slug/:slug",
  requirePermission(Permission.CMS_PAGES_READ),
  async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    const page = await prisma.cmsPage.findUnique({
      where: { slug },
      include: { blocks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!page) return sendError(res, 404, "NOT_FOUND", "Page not found");
    return res.json(serializePage(page));
  }
);

cmsAdminRouter.get(
  "/pages/:id",
  requirePermission(Permission.CMS_PAGES_READ),
  async (req, res) => {
    const page = await prisma.cmsPage.findUnique({
      where: { id: String(req.params.id) },
      include: { blocks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!page) return sendError(res, 404, "NOT_FOUND", "Page not found");
    return res.json(serializePage(page));
  }
);

/** Secure draft preview — requires cms.pages.read (not public query param). */
cmsAdminRouter.get(
  "/pages/:id/preview",
  requirePermission(Permission.CMS_PAGES_READ),
  async (req, res) => {
    const page = await prisma.cmsPage.findUnique({
      where: { id: String(req.params.id) },
      include: { blocks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!page) return sendError(res, 404, "NOT_FOUND", "Page not found");
    return res.json(serializePage(page, { includeDraftMeta: true }));
  }
);

const optionalLocaleText = z.string().trim().max(200).optional().nullable();
const optionalMetaText = z.string().trim().max(500).optional().nullable();

cmsAdminRouter.post(
  "/pages",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      slug: slugSchema,
      title: z.string().trim().min(1).max(200),
      metaDescription: optionalMetaText,
      titleSo: optionalLocaleText,
      titleAr: optionalLocaleText,
      metaDescriptionSo: optionalMetaText,
      metaDescriptionAr: optionalMetaText,
      status: publishStatus.optional(),
      /** When true, reject reserved public-route slugs (custom page builder). */
      customPage: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid page payload");
    }
    if (parsed.data.customPage && isReservedCmsSlug(parsed.data.slug)) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Slug is reserved for an existing public route"
      );
    }
    const status = parsed.data.status ?? "DRAFT";
    if (status === "PUBLISHED" || status === "ARCHIVED") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Use publish/archive endpoints; create as DRAFT"
      );
    }
    try {
      const created = await prisma.cmsPage.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          metaDescription: parsed.data.metaDescription ?? null,
          titleSo: parsed.data.titleSo ?? null,
          titleAr: parsed.data.titleAr ?? null,
          metaDescriptionSo: parsed.data.metaDescriptionSo ?? null,
          metaDescriptionAr: parsed.data.metaDescriptionAr ?? null,
          status: "DRAFT",
        },
        include: { blocks: true },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: "CMS_PAGE_CREATE",
        entityType: "CmsPage",
        entityId: created.id,
        meta: { slug: created.slug },
      });
      return res.status(201).json(serializePage(created));
    } catch {
      return sendError(res, 409, "CONFLICT", "Slug already exists");
    }
  }
);

cmsAdminRouter.patch(
  "/pages/:id",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      slug: slugSchema.optional(),
      title: z.string().trim().min(1).max(200).optional(),
      metaDescription: optionalMetaText,
      titleSo: optionalLocaleText,
      titleAr: optionalLocaleText,
      metaDescriptionSo: optionalMetaText,
      metaDescriptionAr: optionalMetaText,
      customPage: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid page payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsPage.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Page not found");
    if (
      parsed.data.slug &&
      parsed.data.customPage &&
      isReservedCmsSlug(parsed.data.slug)
    ) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Slug is reserved for an existing public route"
      );
    }
    try {
      const updated = await prisma.cmsPage.update({
        where: { id },
        data: {
          ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          ...(parsed.data.metaDescription !== undefined
            ? { metaDescription: parsed.data.metaDescription }
            : {}),
          ...(parsed.data.titleSo !== undefined
            ? { titleSo: parsed.data.titleSo }
            : {}),
          ...(parsed.data.titleAr !== undefined
            ? { titleAr: parsed.data.titleAr }
            : {}),
          ...(parsed.data.metaDescriptionSo !== undefined
            ? { metaDescriptionSo: parsed.data.metaDescriptionSo }
            : {}),
          ...(parsed.data.metaDescriptionAr !== undefined
            ? { metaDescriptionAr: parsed.data.metaDescriptionAr }
            : {}),
        },
        include: { blocks: { orderBy: { sortOrder: "asc" } } },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: "CMS_PAGE_UPDATE",
        entityType: "CmsPage",
        entityId: id,
        meta: parsed.data,
      });
      return res.json(serializePage(updated));
    } catch {
      return sendError(res, 409, "CONFLICT", "Slug already exists");
    }
  }
);

cmsAdminRouter.delete(
  "/pages/:id",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsPage.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Page not found");
    await prisma.cmsPage.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_PAGE_DELETE",
      entityType: "CmsPage",
      entityId: id,
      meta: { slug: existing.slug },
    });
    return res.json({ ok: true, deleted: true });
  }
);

for (const action of ["publish", "unpublish", "archive"] as const) {
  cmsAdminRouter.post(
    `/pages/:id/${action}`,
    requirePermission(Permission.CMS_PUBLISH),
    async (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const page = await prisma.cmsPage.findUnique({
        where: { id },
        include: { blocks: { orderBy: { sortOrder: "asc" } } },
      });
      if (!page) return sendError(res, 404, "NOT_FOUND", "Page not found");
      const next = await transitionStatus(page.status, action);
      if (!next) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Cannot ${action} page in status ${page.status}`
        );
      }
      const updated = await prisma.cmsPage.update({
        where: { id },
        data: {
          status: next,
          publishedAt:
            next === "PUBLISHED" ? new Date() : page.publishedAt,
        },
        include: { blocks: { orderBy: { sortOrder: "asc" } } },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: `CMS_PAGE_${action.toUpperCase()}`,
        entityType: "CmsPage",
        entityId: id,
        meta: { from: page.status, to: next },
      });
      return res.json(serializePage(updated));
    }
  );
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

/** Replace all blocks on a page (editor save). Validates each payload. */
cmsAdminRouter.put(
  "/pages/:pageId/blocks",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const itemSchema = z.object({
      blockType: z.string().trim().min(1).max(64),
      schemaVersion: z.number().int().min(1).max(100).optional().default(1),
      sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
      payload: z.unknown(),
    });
    const schema = z.object({
      blocks: z.array(itemSchema).max(40),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid blocks payload");
    }
    const pageId = String(req.params.pageId);
    const page = await prisma.cmsPage.findUnique({ where: { id: pageId } });
    if (!page) return sendError(res, 404, "NOT_FOUND", "Page not found");

    const validatedBlocks: Array<{
      blockType: string;
      schemaVersion: number;
      sortOrder: number;
      jsonPayload: string;
    }> = [];

    for (const [index, item] of parsed.data.blocks.entries()) {
      const validated = validateBlockPayload(
        item.blockType,
        item.schemaVersion,
        item.payload
      );
      if (!validated.ok) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Block ${index}: ${validated.message}`
        );
      }
      validatedBlocks.push({
        blockType: item.blockType,
        schemaVersion: item.schemaVersion,
        sortOrder: item.sortOrder ?? index,
        jsonPayload: JSON.stringify(validated.data),
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.cmsPageBlock.deleteMany({ where: { pageId } });
      if (validatedBlocks.length > 0) {
        await tx.cmsPageBlock.createMany({
          data: validatedBlocks.map((b) => ({
            pageId,
            blockType: b.blockType,
            schemaVersion: b.schemaVersion,
            sortOrder: b.sortOrder,
            jsonPayload: b.jsonPayload,
          })),
        });
      }
      await tx.cmsPage.update({
        where: { id: pageId },
        data: { updatedAt: new Date() },
      });
      return tx.cmsPage.findUnique({
        where: { id: pageId },
        include: { blocks: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_BLOCKS_REPLACE",
      entityType: "CmsPage",
      entityId: pageId,
      meta: { blockCount: validatedBlocks.length },
    });

    return res.json(serializePage(updated!));
  }
);

cmsAdminRouter.post(
  "/pages/:pageId/blocks",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      blockType: z.string().trim().min(1).max(64),
      schemaVersion: z.number().int().min(1).max(100).optional().default(1),
      sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
      payload: z.unknown(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid block payload");
    }
    const pageId = String(req.params.pageId);
    const page = await prisma.cmsPage.findUnique({ where: { id: pageId } });
    if (!page) return sendError(res, 404, "NOT_FOUND", "Page not found");

    const validated = validateBlockPayload(
      parsed.data.blockType,
      parsed.data.schemaVersion,
      parsed.data.payload
    );
    if (!validated.ok) {
      return sendError(res, 400, "BAD_REQUEST", validated.message);
    }

    const block = await prisma.cmsPageBlock.create({
      data: {
        pageId,
        blockType: parsed.data.blockType,
        schemaVersion: parsed.data.schemaVersion,
        sortOrder: parsed.data.sortOrder,
        jsonPayload: JSON.stringify(validated.data),
      },
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_BLOCK_CREATE",
      entityType: "CmsPageBlock",
      entityId: block.id,
      meta: { pageId, blockType: block.blockType },
    });
    return res.status(201).json(serializeBlock(block));
  }
);

cmsAdminRouter.patch(
  "/blocks/:id",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      blockType: z.string().trim().min(1).max(64).optional(),
      schemaVersion: z.number().int().min(1).max(100).optional(),
      sortOrder: z.number().int().min(0).max(10_000).optional(),
      payload: z.unknown().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid block payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsPageBlock.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Block not found");

    const blockType = parsed.data.blockType ?? existing.blockType;
    const schemaVersion = parsed.data.schemaVersion ?? existing.schemaVersion;
    let jsonPayload = existing.jsonPayload;
    if (parsed.data.payload !== undefined) {
      const validated = validateBlockPayload(
        blockType,
        schemaVersion,
        parsed.data.payload
      );
      if (!validated.ok) {
        return sendError(res, 400, "BAD_REQUEST", validated.message);
      }
      jsonPayload = JSON.stringify(validated.data);
    } else if (
      parsed.data.blockType !== undefined ||
      parsed.data.schemaVersion !== undefined
    ) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "payload required when changing blockType or schemaVersion"
      );
    }

    const updated = await prisma.cmsPageBlock.update({
      where: { id },
      data: {
        blockType,
        schemaVersion,
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
        jsonPayload,
      },
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_BLOCK_UPDATE",
      entityType: "CmsPageBlock",
      entityId: id,
    });
    return res.json(serializeBlock(updated));
  }
);

cmsAdminRouter.delete(
  "/blocks/:id",
  requirePermission(Permission.CMS_PAGES_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsPageBlock.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Block not found");
    await prisma.cmsPageBlock.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_BLOCK_DELETE",
      entityType: "CmsPageBlock",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

cmsAdminRouter.get(
  "/block-types",
  requirePermission(Permission.CMS_PAGES_READ),
  (_req, res) => {
    return res.json({
      data: KNOWN_BLOCK_TYPES,
      customPageBlockTypes: CUSTOM_PAGE_BLOCK_TYPES,
    });
  }
);

// ─── News ────────────────────────────────────────────────────────────────────

cmsAdminRouter.get(
  "/news",
  requirePermission(Permission.CMS_NEWS_READ),
  async (_req, res) => {
    const rows = await prisma.cmsNewsPost.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return res.json({ data: rows.map(serializeNews) });
  }
);

const newsCategory = z.enum([
  "Campus News",
  "Research",
  "Admissions",
  "Events",
]);

function parseDateInput(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

cmsAdminRouter.post(
  "/news",
  requirePermission(Permission.CMS_NEWS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      slug: slugSchema,
      title: z.string().trim().min(1).max(200),
      excerpt: z.string().trim().max(500).optional().nullable(),
      body: z.string().max(100_000).optional().default(""),
      titleSo: optionalLocaleText,
      titleAr: optionalLocaleText,
      excerptSo: z.string().trim().max(500).optional().nullable(),
      excerptAr: z.string().trim().max(500).optional().nullable(),
      bodySo: z.string().max(100_000).optional().nullable(),
      bodyAr: z.string().max(100_000).optional().nullable(),
      category: newsCategory.optional().default("Campus News"),
      coverMediaId: z.string().trim().max(64).optional().nullable(),
      publishedAt: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid news payload");
    }
    const publishedAt = parsed.data.publishedAt
      ? parseDateInput(parsed.data.publishedAt)
      : null;
    if (parsed.data.publishedAt && !publishedAt) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid publishedAt");
    }
    try {
      const created = await prisma.cmsNewsPost.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          excerpt: parsed.data.excerpt ?? null,
          body: sanitizeCmsHtml(parsed.data.body ?? ""),
          titleSo: parsed.data.titleSo ?? null,
          titleAr: parsed.data.titleAr ?? null,
          excerptSo: parsed.data.excerptSo ?? null,
          excerptAr: parsed.data.excerptAr ?? null,
          bodySo: sanitizeCmsHtml(parsed.data.bodySo ?? ""),
          bodyAr: sanitizeCmsHtml(parsed.data.bodyAr ?? ""),
          category: parsed.data.category,
          coverMediaId: parsed.data.coverMediaId ?? null,
          status: "DRAFT",
          publishedAt,
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: "CMS_NEWS_CREATE",
        entityType: "CmsNewsPost",
        entityId: created.id,
      });
      return res.status(201).json(serializeNews(created));
    } catch {
      return sendError(res, 409, "CONFLICT", "Slug already exists");
    }
  }
);

cmsAdminRouter.patch(
  "/news/:id",
  requirePermission(Permission.CMS_NEWS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      slug: slugSchema.optional(),
      title: z.string().trim().min(1).max(200).optional(),
      excerpt: z.string().trim().max(500).optional().nullable(),
      body: z.string().max(100_000).optional(),
      titleSo: optionalLocaleText,
      titleAr: optionalLocaleText,
      excerptSo: z.string().trim().max(500).optional().nullable(),
      excerptAr: z.string().trim().max(500).optional().nullable(),
      bodySo: z.string().max(100_000).optional().nullable(),
      bodyAr: z.string().max(100_000).optional().nullable(),
      category: newsCategory.optional(),
      coverMediaId: z.string().trim().max(64).optional().nullable(),
      publishedAt: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid news payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsNewsPost.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "News not found");

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.body !== undefined) {
      data.body = sanitizeCmsHtml(parsed.data.body);
    }
    if (parsed.data.bodySo !== undefined) {
      data.bodySo = sanitizeCmsHtml(parsed.data.bodySo ?? "");
    }
    if (parsed.data.bodyAr !== undefined) {
      data.bodyAr = sanitizeCmsHtml(parsed.data.bodyAr ?? "");
    }
    if (parsed.data.publishedAt !== undefined) {
      if (parsed.data.publishedAt === null || parsed.data.publishedAt === "") {
        data.publishedAt = null;
      } else {
        const d = parseDateInput(parsed.data.publishedAt);
        if (!d) {
          return sendError(res, 400, "BAD_REQUEST", "Invalid publishedAt");
        }
        data.publishedAt = d;
      }
    }

    try {
      const updated = await prisma.cmsNewsPost.update({
        where: { id },
        data,
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: "CMS_NEWS_UPDATE",
        entityType: "CmsNewsPost",
        entityId: id,
      });
      return res.json(serializeNews(updated));
    } catch {
      return sendError(res, 409, "CONFLICT", "Slug already exists");
    }
  }
);

cmsAdminRouter.delete(
  "/news/:id",
  requirePermission(Permission.CMS_NEWS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsNewsPost.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "News not found");
    await prisma.cmsNewsPost.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_NEWS_DELETE",
      entityType: "CmsNewsPost",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

for (const action of ["publish", "unpublish", "archive"] as const) {
  cmsAdminRouter.post(
    `/news/:id/${action}`,
    requirePermission(Permission.CMS_PUBLISH),
    async (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const post = await prisma.cmsNewsPost.findUnique({ where: { id } });
      if (!post) return sendError(res, 404, "NOT_FOUND", "News not found");
      const next = await transitionStatus(post.status, action);
      if (!next) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Cannot ${action} news in status ${post.status}`
        );
      }
      const updated = await prisma.cmsNewsPost.update({
        where: { id },
        data: {
          status: next,
          publishedAt:
            next === "PUBLISHED" ? new Date() : post.publishedAt,
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: `CMS_NEWS_${action.toUpperCase()}`,
        entityType: "CmsNewsPost",
        entityId: id,
        meta: { from: post.status, to: next },
      });
      return res.json(serializeNews(updated));
    }
  );
}

// ─── Events ──────────────────────────────────────────────────────────────────

cmsAdminRouter.get(
  "/events",
  requirePermission(Permission.CMS_EVENTS_READ),
  async (_req, res) => {
    const rows = await prisma.cmsEvent.findMany({
      orderBy: { startsAt: "desc" },
    });
    return res.json({ data: rows.map(serializeEvent) });
  }
);

cmsAdminRouter.post(
  "/events",
  requirePermission(Permission.CMS_EVENTS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(20_000).optional().default(""),
      location: z.string().trim().max(200).optional().nullable(),
      titleSo: optionalLocaleText,
      titleAr: optionalLocaleText,
      descriptionSo: z.string().max(20_000).optional().nullable(),
      descriptionAr: z.string().max(20_000).optional().nullable(),
      locationSo: optionalLocaleText,
      locationAr: optionalLocaleText,
      startsAt: z.string().min(1),
      endsAt: z.string().optional().nullable(),
      registrationUrl: z.string().trim().max(500).optional().nullable(),
      coverMediaId: z.string().trim().max(64).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid event payload");
    }
    const startsAt = parseDateInput(parsed.data.startsAt);
    if (!startsAt) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid startsAt");
    }
    let endsAt: Date | null = null;
    if (parsed.data.endsAt) {
      endsAt = parseDateInput(parsed.data.endsAt);
      if (!endsAt) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid endsAt");
      }
    }
    const created = await prisma.cmsEvent.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        location: parsed.data.location ?? null,
        titleSo: parsed.data.titleSo ?? null,
        titleAr: parsed.data.titleAr ?? null,
        descriptionSo: parsed.data.descriptionSo ?? "",
        descriptionAr: parsed.data.descriptionAr ?? "",
        locationSo: parsed.data.locationSo ?? null,
        locationAr: parsed.data.locationAr ?? null,
        startsAt,
        endsAt,
        registrationUrl: parsed.data.registrationUrl ?? null,
        coverMediaId: parsed.data.coverMediaId ?? null,
        status: "DRAFT",
      },
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_EVENT_CREATE",
      entityType: "CmsEvent",
      entityId: created.id,
    });
    return res.status(201).json(serializeEvent(created));
  }
);

cmsAdminRouter.patch(
  "/events/:id",
  requirePermission(Permission.CMS_EVENTS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(20_000).optional(),
      location: z.string().trim().max(200).optional().nullable(),
      titleSo: optionalLocaleText,
      titleAr: optionalLocaleText,
      descriptionSo: z.string().max(20_000).optional().nullable(),
      descriptionAr: z.string().max(20_000).optional().nullable(),
      locationSo: optionalLocaleText,
      locationAr: optionalLocaleText,
      startsAt: z.string().min(1).optional(),
      endsAt: z.string().optional().nullable(),
      registrationUrl: z.string().trim().max(500).optional().nullable(),
      coverMediaId: z.string().trim().max(64).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid event payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsEvent.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Event not found");

    const data: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      data.description = parsed.data.description;
    }
    if (parsed.data.location !== undefined) data.location = parsed.data.location;
    if (parsed.data.titleSo !== undefined) data.titleSo = parsed.data.titleSo;
    if (parsed.data.titleAr !== undefined) data.titleAr = parsed.data.titleAr;
    if (parsed.data.descriptionSo !== undefined) {
      data.descriptionSo = parsed.data.descriptionSo ?? "";
    }
    if (parsed.data.descriptionAr !== undefined) {
      data.descriptionAr = parsed.data.descriptionAr ?? "";
    }
    if (parsed.data.locationSo !== undefined) {
      data.locationSo = parsed.data.locationSo;
    }
    if (parsed.data.locationAr !== undefined) {
      data.locationAr = parsed.data.locationAr;
    }
    if (parsed.data.registrationUrl !== undefined) {
      data.registrationUrl = parsed.data.registrationUrl;
    }
    if (parsed.data.coverMediaId !== undefined) {
      data.coverMediaId = parsed.data.coverMediaId;
    }
    if (parsed.data.startsAt !== undefined) {
      const startsAt = parseDateInput(parsed.data.startsAt);
      if (!startsAt) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid startsAt");
      }
      data.startsAt = startsAt;
    }
    if (parsed.data.endsAt !== undefined) {
      if (parsed.data.endsAt === null || parsed.data.endsAt === "") {
        data.endsAt = null;
      } else {
        const endsAt = parseDateInput(parsed.data.endsAt);
        if (!endsAt) {
          return sendError(res, 400, "BAD_REQUEST", "Invalid endsAt");
        }
        data.endsAt = endsAt;
      }
    }

    const updated = await prisma.cmsEvent.update({
      where: { id },
      data,
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_EVENT_UPDATE",
      entityType: "CmsEvent",
      entityId: id,
    });
    return res.json(serializeEvent(updated));
  }
);

cmsAdminRouter.delete(
  "/events/:id",
  requirePermission(Permission.CMS_EVENTS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsEvent.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Event not found");
    await prisma.cmsEvent.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_EVENT_DELETE",
      entityType: "CmsEvent",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

for (const action of ["publish", "unpublish", "archive"] as const) {
  cmsAdminRouter.post(
    `/events/:id/${action}`,
    requirePermission(Permission.CMS_PUBLISH),
    async (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const event = await prisma.cmsEvent.findUnique({ where: { id } });
      if (!event) return sendError(res, 404, "NOT_FOUND", "Event not found");
      const next = await transitionStatus(event.status, action);
      if (!next) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Cannot ${action} event in status ${event.status}`
        );
      }
      const updated = await prisma.cmsEvent.update({
        where: { id },
        data: {
          status: next,
          publishedAt:
            next === "PUBLISHED" ? new Date() : event.publishedAt,
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: `CMS_EVENT_${action.toUpperCase()}`,
        entityType: "CmsEvent",
        entityId: id,
        meta: { from: event.status, to: next },
      });
      return res.json(serializeEvent(updated));
    }
  );
}

// ─── Navigation ──────────────────────────────────────────────────────────────

cmsAdminRouter.get(
  "/nav",
  requirePermission(Permission.CMS_NAV_READ),
  async (_req, res) => {
    const rows = await prisma.cmsNavItem.findMany({
      orderBy: [{ location: "asc" }, { sortOrder: "asc" }],
    });
    return res.json({ data: rows.map(serializeNavItem) });
  }
);

cmsAdminRouter.post(
  "/nav",
  requirePermission(Permission.CMS_NAV_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      label: z.string().trim().min(1).max(120),
      href: z.string().trim().min(1).max(300),
      location: z.enum(["HEADER", "FOOTER"]).optional().default("HEADER"),
      sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
      visible: z.boolean().optional().default(true),
      parentId: z.string().trim().max(64).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid nav payload");
    }
    const created = await prisma.cmsNavItem.create({
      data: {
        label: parsed.data.label,
        href: parsed.data.href,
        location: parsed.data.location,
        sortOrder: parsed.data.sortOrder,
        visible: parsed.data.visible,
        parentId: parsed.data.parentId ?? null,
      },
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_NAV_CREATE",
      entityType: "CmsNavItem",
      entityId: created.id,
    });
    return res.status(201).json(serializeNavItem(created));
  }
);

cmsAdminRouter.patch(
  "/nav/:id",
  requirePermission(Permission.CMS_NAV_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      label: z.string().trim().min(1).max(120).optional(),
      href: z.string().trim().min(1).max(300).optional(),
      location: z.enum(["HEADER", "FOOTER"]).optional(),
      sortOrder: z.number().int().min(0).max(10_000).optional(),
      visible: z.boolean().optional(),
      parentId: z.string().trim().max(64).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid nav payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsNavItem.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Nav item not found");
    const updated = await prisma.cmsNavItem.update({
      where: { id },
      data: parsed.data,
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_NAV_UPDATE",
      entityType: "CmsNavItem",
      entityId: id,
    });
    return res.json(serializeNavItem(updated));
  }
);

cmsAdminRouter.delete(
  "/nav/:id",
  requirePermission(Permission.CMS_NAV_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsNavItem.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Nav item not found");
    await prisma.cmsNavItem.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_NAV_DELETE",
      entityType: "CmsNavItem",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

// ─── Media ───────────────────────────────────────────────────────────────────

cmsAdminRouter.get(
  "/media",
  requirePermission(Permission.CMS_MEDIA_READ),
  async (_req, res) => {
    const rows = await prisma.cmsMediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ data: rows.map(serializeMedia) });
  }
);

cmsAdminRouter.post(
  "/media",
  requirePermission(Permission.CMS_MEDIA_MANAGE),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) {
      return sendError(res, 400, "BAD_REQUEST", "file is required");
    }
    const maxMb = await getConfiguredMaxUploadFileMb();
    if (file.size > maxMb * 1024 * 1024) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        `File exceeds max upload size (${maxMb}MB)`
      );
    }
    if (!isAllowedCmsUpload(file.originalname, file.mimetype)) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "File type not allowed (images and PDF only)"
      );
    }

    const storage = getCmsMediaStorage();
    const storageKey = storage.buildKey(file.originalname);
    const saved = await storage.saveFromPath(file.path, storageKey);

    const asset = await prisma.cmsMediaAsset.create({
      data: {
        originalName: file.originalname,
        storageKey: saved.storageKey,
        mimeType: file.mimetype,
        size: saved.sizeBytes,
        altText: typeof req.body?.altText === "string" ? req.body.altText : null,
        caption: typeof req.body?.caption === "string" ? req.body.caption : null,
        uploadedById: req.user!.id,
      },
    });

    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_MEDIA_CREATE",
      entityType: "CmsMediaAsset",
      entityId: asset.id,
      meta: { mimeType: asset.mimeType, size: asset.size },
    });

    return res.status(201).json(serializeMedia(asset));
  }
);

cmsAdminRouter.delete(
  "/media/:id",
  requirePermission(Permission.CMS_MEDIA_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });
    if (!asset) return sendError(res, 404, "NOT_FOUND", "Media not found");
    await getCmsMediaStorage().delete(asset.storageKey);
    await prisma.cmsMediaAsset.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_MEDIA_DELETE",
      entityType: "CmsMediaAsset",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

// ─── Faculty marketing ───────────────────────────────────────────────────────

const stringListSchema = z.array(z.string().trim().min(1).max(200)).max(40);

cmsAdminRouter.get(
  "/faculties",
  requirePermission(Permission.CMS_FACULTIES_READ),
  async (_req, res) => {
    const rows = await prisma.cmsFacultyMarketing.findMany({
      orderBy: { name: "asc" },
    });
    return res.json({ data: rows.map(serializeFacultyMarketing) });
  }
);

cmsAdminRouter.post(
  "/faculties",
  requirePermission(Permission.CMS_FACULTIES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      facultyKey: z
        .string()
        .trim()
        .min(2)
        .max(64)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      name: z.string().trim().min(2).max(200),
      shortName: z.string().trim().min(1).max(80),
      heroImageUrl: z.string().trim().max(500).optional().default(""),
      overviewHtml: z.string().max(50_000).optional().default(""),
      careerProspectsHtml: z.string().max(50_000).optional().default(""),
      admissionRequirementsHtml: z.string().max(50_000).optional().default(""),
      deanWelcomeHtml: z.string().max(50_000).optional().default(""),
      departments: stringListSchema.optional().default([]),
      degrees: stringListSchema.optional().default([]),
      duration: z.string().trim().max(80).optional().default(""),
      credits: z.string().trim().max(80).optional().default(""),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid faculty marketing payload");
    }
    try {
      const created = await prisma.cmsFacultyMarketing.create({
        data: {
          facultyKey: parsed.data.facultyKey,
          name: parsed.data.name,
          shortName: parsed.data.shortName,
          heroImageUrl: parsed.data.heroImageUrl,
          overviewHtml: sanitizeCmsHtml(parsed.data.overviewHtml),
          careerProspectsHtml: sanitizeCmsHtml(parsed.data.careerProspectsHtml),
          admissionRequirementsHtml: sanitizeCmsHtml(
            parsed.data.admissionRequirementsHtml
          ),
          deanWelcomeHtml: sanitizeCmsHtml(parsed.data.deanWelcomeHtml),
          departmentsJson: JSON.stringify(parsed.data.departments),
          degreesJson: JSON.stringify(parsed.data.degrees),
          duration: parsed.data.duration,
          credits: parsed.data.credits,
          status: "DRAFT",
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: "CMS_FACULTY_CREATE",
        entityType: "CmsFacultyMarketing",
        entityId: created.id,
      });
      return res.status(201).json(serializeFacultyMarketing(created));
    } catch {
      return sendError(res, 409, "CONFLICT", "facultyKey already exists");
    }
  }
);

cmsAdminRouter.patch(
  "/faculties/:id",
  requirePermission(Permission.CMS_FACULTIES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(200).optional(),
      shortName: z.string().trim().min(1).max(80).optional(),
      heroImageUrl: z.string().trim().max(500).optional(),
      overviewHtml: z.string().max(50_000).optional(),
      careerProspectsHtml: z.string().max(50_000).optional(),
      admissionRequirementsHtml: z.string().max(50_000).optional(),
      deanWelcomeHtml: z.string().max(50_000).optional(),
      departments: stringListSchema.optional(),
      degrees: stringListSchema.optional(),
      duration: z.string().trim().max(80).optional(),
      credits: z.string().trim().max(80).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid faculty marketing payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsFacultyMarketing.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Faculty marketing not found");
    }
    const updated = await prisma.cmsFacultyMarketing.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.shortName !== undefined
          ? { shortName: parsed.data.shortName }
          : {}),
        ...(parsed.data.heroImageUrl !== undefined
          ? { heroImageUrl: parsed.data.heroImageUrl }
          : {}),
        ...(parsed.data.overviewHtml !== undefined
          ? { overviewHtml: sanitizeCmsHtml(parsed.data.overviewHtml) }
          : {}),
        ...(parsed.data.careerProspectsHtml !== undefined
          ? {
              careerProspectsHtml: sanitizeCmsHtml(
                parsed.data.careerProspectsHtml
              ),
            }
          : {}),
        ...(parsed.data.admissionRequirementsHtml !== undefined
          ? {
              admissionRequirementsHtml: sanitizeCmsHtml(
                parsed.data.admissionRequirementsHtml
              ),
            }
          : {}),
        ...(parsed.data.deanWelcomeHtml !== undefined
          ? { deanWelcomeHtml: sanitizeCmsHtml(parsed.data.deanWelcomeHtml) }
          : {}),
        ...(parsed.data.departments !== undefined
          ? { departmentsJson: JSON.stringify(parsed.data.departments) }
          : {}),
        ...(parsed.data.degrees !== undefined
          ? { degreesJson: JSON.stringify(parsed.data.degrees) }
          : {}),
        ...(parsed.data.duration !== undefined
          ? { duration: parsed.data.duration }
          : {}),
        ...(parsed.data.credits !== undefined
          ? { credits: parsed.data.credits }
          : {}),
      },
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_FACULTY_UPDATE",
      entityType: "CmsFacultyMarketing",
      entityId: id,
    });
    return res.json(serializeFacultyMarketing(updated));
  }
);

cmsAdminRouter.delete(
  "/faculties/:id",
  requirePermission(Permission.CMS_FACULTIES_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsFacultyMarketing.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Faculty marketing not found");
    }
    await prisma.cmsFacultyMarketing.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_FACULTY_DELETE",
      entityType: "CmsFacultyMarketing",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

for (const action of ["publish", "unpublish", "archive"] as const) {
  cmsAdminRouter.post(
    `/faculties/:id/${action}`,
    requirePermission(Permission.CMS_PUBLISH),
    async (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const row = await prisma.cmsFacultyMarketing.findUnique({ where: { id } });
      if (!row) {
        return sendError(res, 404, "NOT_FOUND", "Faculty marketing not found");
      }
      const next = await transitionStatus(row.status, action);
      if (!next) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Cannot ${action} faculty in status ${row.status}`
        );
      }
      const updated = await prisma.cmsFacultyMarketing.update({
        where: { id },
        data: {
          status: next,
          publishedAt: next === "PUBLISHED" ? new Date() : row.publishedAt,
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: `CMS_FACULTY_${action.toUpperCase()}`,
        entityType: "CmsFacultyMarketing",
        entityId: id,
        meta: { from: row.status, to: next },
      });
      return res.json(serializeFacultyMarketing(updated));
    }
  );
}

// ─── Program marketing ───────────────────────────────────────────────────────

cmsAdminRouter.get(
  "/programs",
  requirePermission(Permission.CMS_PROGRAMS_READ),
  async (_req, res) => {
    const rows = await prisma.cmsProgramMarketing.findMany({
      orderBy: [{ facultyKey: "asc" }, { title: "asc" }],
    });
    return res.json({ data: rows.map(serializeProgramMarketing) });
  }
);

cmsAdminRouter.post(
  "/programs",
  requirePermission(Permission.CMS_PROGRAMS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      programKey: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      facultyKey: z.string().trim().min(2).max(64),
      title: z.string().trim().min(2).max(200),
      degreeTitle: z.string().trim().max(160).optional().default(""),
      overviewHtml: z.string().max(50_000).optional().default(""),
      duration: z.string().trim().max(80).optional().default(""),
      creditHours: z.string().trim().max(80).optional().default(""),
      tuitionPerSemester: z.string().trim().max(80).optional().default(""),
      careerOpportunitiesHtml: z.string().max(50_000).optional().default(""),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid program marketing payload");
    }
    try {
      const created = await prisma.cmsProgramMarketing.create({
        data: {
          programKey: parsed.data.programKey,
          facultyKey: parsed.data.facultyKey,
          title: parsed.data.title,
          degreeTitle: parsed.data.degreeTitle,
          overviewHtml: sanitizeCmsHtml(parsed.data.overviewHtml),
          duration: parsed.data.duration,
          creditHours: parsed.data.creditHours,
          tuitionPerSemester: parsed.data.tuitionPerSemester,
          careerOpportunitiesHtml: sanitizeCmsHtml(
            parsed.data.careerOpportunitiesHtml
          ),
          status: "DRAFT",
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: "CMS_PROGRAM_CREATE",
        entityType: "CmsProgramMarketing",
        entityId: created.id,
      });
      return res.status(201).json(serializeProgramMarketing(created));
    } catch {
      return sendError(res, 409, "CONFLICT", "programKey already exists");
    }
  }
);

cmsAdminRouter.patch(
  "/programs/:id",
  requirePermission(Permission.CMS_PROGRAMS_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      facultyKey: z.string().trim().min(2).max(64).optional(),
      title: z.string().trim().min(2).max(200).optional(),
      degreeTitle: z.string().trim().max(160).optional(),
      overviewHtml: z.string().max(50_000).optional(),
      duration: z.string().trim().max(80).optional(),
      creditHours: z.string().trim().max(80).optional(),
      tuitionPerSemester: z.string().trim().max(80).optional(),
      careerOpportunitiesHtml: z.string().max(50_000).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid program marketing payload");
    }
    const id = String(req.params.id);
    const existing = await prisma.cmsProgramMarketing.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Program marketing not found");
    }
    const updated = await prisma.cmsProgramMarketing.update({
      where: { id },
      data: {
        ...(parsed.data.facultyKey !== undefined
          ? { facultyKey: parsed.data.facultyKey }
          : {}),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.degreeTitle !== undefined
          ? { degreeTitle: parsed.data.degreeTitle }
          : {}),
        ...(parsed.data.overviewHtml !== undefined
          ? { overviewHtml: sanitizeCmsHtml(parsed.data.overviewHtml) }
          : {}),
        ...(parsed.data.duration !== undefined
          ? { duration: parsed.data.duration }
          : {}),
        ...(parsed.data.creditHours !== undefined
          ? { creditHours: parsed.data.creditHours }
          : {}),
        ...(parsed.data.tuitionPerSemester !== undefined
          ? { tuitionPerSemester: parsed.data.tuitionPerSemester }
          : {}),
        ...(parsed.data.careerOpportunitiesHtml !== undefined
          ? {
              careerOpportunitiesHtml: sanitizeCmsHtml(
                parsed.data.careerOpportunitiesHtml
              ),
            }
          : {}),
      },
    });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_PROGRAM_UPDATE",
      entityType: "CmsProgramMarketing",
      entityId: id,
    });
    return res.json(serializeProgramMarketing(updated));
  }
);

cmsAdminRouter.delete(
  "/programs/:id",
  requirePermission(Permission.CMS_PROGRAMS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.cmsProgramMarketing.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Program marketing not found");
    }
    await prisma.cmsProgramMarketing.delete({ where: { id } });
    await writeCmsAudit({
      actorId: req.user!.id,
      action: "CMS_PROGRAM_DELETE",
      entityType: "CmsProgramMarketing",
      entityId: id,
    });
    return res.json({ ok: true, deleted: true });
  }
);

for (const action of ["publish", "unpublish", "archive"] as const) {
  cmsAdminRouter.post(
    `/programs/:id/${action}`,
    requirePermission(Permission.CMS_PUBLISH),
    async (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const row = await prisma.cmsProgramMarketing.findUnique({ where: { id } });
      if (!row) {
        return sendError(res, 404, "NOT_FOUND", "Program marketing not found");
      }
      const next = await transitionStatus(row.status, action);
      if (!next) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Cannot ${action} program in status ${row.status}`
        );
      }
      const updated = await prisma.cmsProgramMarketing.update({
        where: { id },
        data: {
          status: next,
          publishedAt: next === "PUBLISHED" ? new Date() : row.publishedAt,
        },
      });
      await writeCmsAudit({
        actorId: req.user!.id,
        action: `CMS_PROGRAM_${action.toUpperCase()}`,
        entityType: "CmsProgramMarketing",
        entityId: id,
        meta: { from: row.status, to: next },
      });
      return res.json(serializeProgramMarketing(updated));
    }
  );
}
