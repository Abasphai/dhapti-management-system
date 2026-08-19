-- Phase 1F-A: Assignment belongs to ClassSection; lifecycle DRAFT/PUBLISHED/ARCHIVED.
-- No existing Assignment rows at migration time.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSectionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "dueAt" DATETIME NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "maxFileMb" INTEGER NOT NULL DEFAULT 500,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";

CREATE INDEX "Assignment_classSectionId_idx" ON "Assignment"("classSectionId");
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");
CREATE INDEX "Assignment_dueAt_idx" ON "Assignment"("dueAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
