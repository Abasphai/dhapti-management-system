-- Phase 1K: Course-final ResultEntry + assessment weights + grade scale (no seeded policy)

PRAGMA foreign_keys=OFF;

-- Drop unused stub ResultEntry (no API usage; empty in practice)
DROP TABLE IF EXISTS "ResultEntry";

-- Evolved ResultStatus values are string-backed; recreate ResultEntry
CREATE TABLE "ResultEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "marks" REAL,
    "maxMarks" REAL NOT NULL DEFAULT 100,
    "creditHours" INTEGER NOT NULL,
    "letterGrade" TEXT,
    "gradePoint" REAL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "calculationJson" TEXT,
    "teacherNote" TEXT,
    "adminNote" TEXT,
    "returnReason" TEXT,
    "calculatedAt" DATETIME,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "returnedAt" DATETIME,
    "returnedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultEntry_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResultEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResultEntry_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResultEntry_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ResultEntry_enrollmentId_key" ON "ResultEntry"("enrollmentId");
CREATE INDEX "ResultEntry_status_idx" ON "ResultEntry"("status");
CREATE INDEX "ResultEntry_studentId_idx" ON "ResultEntry"("studentId");
CREATE INDEX "ResultEntry_classSectionId_idx" ON "ResultEntry"("classSectionId");
CREATE INDEX "ResultEntry_courseId_idx" ON "ResultEntry"("courseId");
CREATE INDEX "ResultEntry_teacherId_idx" ON "ResultEntry"("teacherId");

CREATE TABLE "AssessmentWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSectionId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "weightPercent" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentWeight_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssessmentWeight_classSectionId_componentType_key" ON "AssessmentWeight"("classSectionId", "componentType");
CREATE INDEX "AssessmentWeight_classSectionId_idx" ON "AssessmentWeight"("classSectionId");

CREATE TABLE "GradeScale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GradeScaleBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeScaleId" TEXT NOT NULL,
    "minScore" REAL NOT NULL,
    "maxScore" REAL NOT NULL,
    "letterGrade" TEXT NOT NULL,
    "gradePoint" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GradeScaleBand_gradeScaleId_fkey" FOREIGN KEY ("gradeScaleId") REFERENCES "GradeScale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GradeScaleBand_gradeScaleId_idx" ON "GradeScaleBand"("gradeScaleId");

PRAGMA foreign_keys=ON;
