-- Step 1: Exam Control Admin + Admit Card engine
-- AlterEnum Role: SQLite stores as TEXT; recreate via Prisma migrate if needed.

-- SQLite: Prisma maps enums as strings — add new tables.

CREATE TABLE IF NOT EXISTS "ExamSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "semester" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ExamSession_status_idx" ON "ExamSession"("status");
CREATE INDEX IF NOT EXISTS "ExamSession_published_idx" ON "ExamSession"("published");

CREATE TABLE IF NOT EXISTS "ExamSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examSessionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "examDate" DATETIME NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "seatLabel" TEXT,
    "chiefInvigilator" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSchedule_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ExamSchedule_examSessionId_idx" ON "ExamSchedule"("examSessionId");
CREATE INDEX IF NOT EXISTS "ExamSchedule_courseId_idx" ON "ExamSchedule"("courseId");
CREATE INDEX IF NOT EXISTS "ExamSchedule_examDate_idx" ON "ExamSchedule"("examDate");

CREATE TABLE IF NOT EXISTS "ExamAdmitCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "attendancePercent" REAL,
    "pendingDues" REAL NOT NULL DEFAULT 0,
    "verificationCode" TEXT NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overriddenById" TEXT,
    "overriddenAt" DATETIME,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAdmitCard_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAdmitCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAdmitCard_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExamAdmitCard_verificationCode_key" ON "ExamAdmitCard"("verificationCode");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamAdmitCard_examSessionId_studentId_key" ON "ExamAdmitCard"("examSessionId", "studentId");
CREATE INDEX IF NOT EXISTS "ExamAdmitCard_studentId_idx" ON "ExamAdmitCard"("studentId");
CREATE INDEX IF NOT EXISTS "ExamAdmitCard_status_idx" ON "ExamAdmitCard"("status");
CREATE INDEX IF NOT EXISTS "ExamAdmitCard_verificationCode_idx" ON "ExamAdmitCard"("verificationCode");
