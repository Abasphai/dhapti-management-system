-- Phase 1E-A: Enrollment targets ClassSection (not Course).
-- Legacy course-based Enrollment rows cannot be remapped without ClassSection IDs;
-- clear them before schema change (3 seed rows at migration time).

DELETE FROM "Enrollment";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
DROP TABLE "Enrollment";
ALTER TABLE "new_Enrollment" RENAME TO "Enrollment";
CREATE INDEX "Enrollment_classSectionId_idx" ON "Enrollment"("classSectionId");
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");
CREATE UNIQUE INDEX "Enrollment_studentId_classSectionId_key" ON "Enrollment"("studentId", "classSectionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
