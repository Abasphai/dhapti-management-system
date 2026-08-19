-- CMS Phase 6: custom page SEO + trilingual fields + download counters

ALTER TABLE "CmsPage" ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "CmsPage" ADD COLUMN "titleSo" TEXT;
ALTER TABLE "CmsPage" ADD COLUMN "titleAr" TEXT;
ALTER TABLE "CmsPage" ADD COLUMN "metaDescriptionSo" TEXT;
ALTER TABLE "CmsPage" ADD COLUMN "metaDescriptionAr" TEXT;

ALTER TABLE "CmsNewsPost" ADD COLUMN "titleSo" TEXT;
ALTER TABLE "CmsNewsPost" ADD COLUMN "titleAr" TEXT;
ALTER TABLE "CmsNewsPost" ADD COLUMN "excerptSo" TEXT;
ALTER TABLE "CmsNewsPost" ADD COLUMN "excerptAr" TEXT;
ALTER TABLE "CmsNewsPost" ADD COLUMN "bodySo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CmsNewsPost" ADD COLUMN "bodyAr" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CmsEvent" ADD COLUMN "titleSo" TEXT;
ALTER TABLE "CmsEvent" ADD COLUMN "titleAr" TEXT;
ALTER TABLE "CmsEvent" ADD COLUMN "descriptionSo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CmsEvent" ADD COLUMN "descriptionAr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CmsEvent" ADD COLUMN "locationSo" TEXT;
ALTER TABLE "CmsEvent" ADD COLUMN "locationAr" TEXT;

ALTER TABLE "CmsMediaAsset" ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0;
