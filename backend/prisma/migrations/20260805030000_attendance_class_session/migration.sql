-- Phase 1H: ClassSession → ClassSection; TeacherAttendance; StudentAttendance + EXCUSED.
-- Legacy attendance tables were empty (verified) — safe rebuild.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "StudentAttendance";
DROP TABLE IF EXISTS "TeacherAttendance";
DROP TABLE IF EXISTS "TeacherClassSession";
DROP TABLE IF EXISTS "ClassSession";

CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSectionId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "scheduledStartTime" TEXT,
    "scheduledEndTime" TEXT,
    "actualStartTime" DATETIME,
    "actualEndTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "topic" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassSession_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TeacherAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "status" TEXT NOT NULL,
    "markedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClassSession_classSectionId_date_scheduledStartTime_key" ON "ClassSession"("classSectionId", "date", "scheduledStartTime");
CREATE INDEX "ClassSession_classSectionId_idx" ON "ClassSession"("classSectionId");
CREATE INDEX "ClassSession_date_idx" ON "ClassSession"("date");
CREATE INDEX "ClassSession_status_idx" ON "ClassSession"("status");
CREATE UNIQUE INDEX "TeacherAttendance_sessionId_key" ON "TeacherAttendance"("sessionId");
CREATE INDEX "TeacherAttendance_teacherId_idx" ON "TeacherAttendance"("teacherId");
CREATE UNIQUE INDEX "StudentAttendance_sessionId_studentId_key" ON "StudentAttendance"("sessionId", "studentId");
CREATE INDEX "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");
CREATE INDEX "StudentAttendance_sessionId_idx" ON "StudentAttendance"("sessionId");
CREATE INDEX "StudentAttendance_status_idx" ON "StudentAttendance"("status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
