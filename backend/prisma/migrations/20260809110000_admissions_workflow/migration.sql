-- Phase 1M: Evolve AdmissionApplication for online admissions workflow.
-- Legacy status NEW → PENDING; appliedAt → createdAt.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AdmissionApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "facultyId" TEXT,
    "programId" TEXT,
    "highSchoolGPA" REAL,
    "documentsUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "notes" TEXT,
    "decisionDate" DATETIME,
    "decidedById" TEXT,
    "studentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionApplication_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdmissionApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdmissionApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdmissionApplication_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_AdmissionApplication" (
  "id", "trackingCode", "fullName", "email", "phone", "facultyId", "programId",
  "highSchoolGPA", "documentsUrl", "status", "rejectionReason", "notes",
  "decisionDate", "decidedById", "studentId", "createdAt", "updatedAt"
)
SELECT
  "id",
  'LEGACY-' || "id",
  "fullName",
  COALESCE(
    NULLIF(TRIM("email"), ''),
    lower(replace(replace("fullName", ' ', '.'), '''', '')) || '@pending.biu.edu.so'
  ),
  "phone",
  "facultyId",
  NULL,
  NULL,
  NULL,
  CASE
    WHEN "status" = 'NEW' THEN 'PENDING'
    ELSE "status"
  END,
  NULL,
  "notes",
  NULL,
  NULL,
  NULL,
  "appliedAt",
  "appliedAt"
FROM "AdmissionApplication";

DROP TABLE "AdmissionApplication";
ALTER TABLE "new_AdmissionApplication" RENAME TO "AdmissionApplication";

CREATE UNIQUE INDEX "AdmissionApplication_trackingCode_key" ON "AdmissionApplication"("trackingCode");
CREATE UNIQUE INDEX "AdmissionApplication_studentId_key" ON "AdmissionApplication"("studentId");
CREATE INDEX "AdmissionApplication_status_idx" ON "AdmissionApplication"("status");
CREATE INDEX "AdmissionApplication_facultyId_idx" ON "AdmissionApplication"("facultyId");
CREATE INDEX "AdmissionApplication_email_idx" ON "AdmissionApplication"("email");
CREATE INDEX "AdmissionApplication_createdAt_idx" ON "AdmissionApplication"("createdAt");

PRAGMA foreign_keys=ON;
