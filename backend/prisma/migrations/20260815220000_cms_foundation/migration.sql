-- CMS foundation (Phase 1). Additive only — no public website migration.
-- Website brand/theme keys use existing SystemSetting table (no CmsSiteSettings).

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CmsPageBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "jsonPayload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CmsPageBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CmsMediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "caption" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CmsMediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CmsNewsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "coverMediaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CmsNewsPost_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "CmsMediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CmsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "coverMediaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CmsEvent_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "CmsMediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CmsNavItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'HEADER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CmsNavItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CmsNavItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");

-- CreateIndex
CREATE INDEX "CmsPage_status_idx" ON "CmsPage"("status");

-- CreateIndex
CREATE INDEX "CmsPageBlock_pageId_sortOrder_idx" ON "CmsPageBlock"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "CmsPageBlock_blockType_idx" ON "CmsPageBlock"("blockType");

-- CreateIndex
CREATE UNIQUE INDEX "CmsMediaAsset_storageKey_key" ON "CmsMediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "CmsMediaAsset_mimeType_idx" ON "CmsMediaAsset"("mimeType");

-- CreateIndex
CREATE INDEX "CmsMediaAsset_uploadedById_idx" ON "CmsMediaAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "CmsMediaAsset_createdAt_idx" ON "CmsMediaAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmsNewsPost_slug_key" ON "CmsNewsPost"("slug");

-- CreateIndex
CREATE INDEX "CmsNewsPost_status_publishedAt_idx" ON "CmsNewsPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CmsEvent_status_startsAt_idx" ON "CmsEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "CmsNavItem_location_sortOrder_idx" ON "CmsNavItem"("location", "sortOrder");

-- CreateIndex
CREATE INDEX "CmsNavItem_parentId_idx" ON "CmsNavItem"("parentId");
