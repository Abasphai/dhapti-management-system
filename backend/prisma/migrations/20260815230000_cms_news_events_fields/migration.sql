-- AlterTable
ALTER TABLE "CmsNewsPost" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Campus News';

-- AlterTable
ALTER TABLE "CmsEvent" ADD COLUMN "registrationUrl" TEXT;

-- CreateIndex
CREATE INDEX "CmsNewsPost_category_idx" ON "CmsNewsPost"("category");
