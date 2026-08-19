-- CreateEnum
CREATE TABLE IF NOT EXISTS "tmp_teacher_timer_enum_placeholder" ("id" INTEGER);
DROP TABLE IF EXISTS "tmp_teacher_timer_enum_placeholder";

-- SQLite: Prisma stores enums as TEXT. Add timer fields to TeacherAttendance.
ALTER TABLE "TeacherAttendance" ADD COLUMN "classSectionId" TEXT;
ALTER TABLE "TeacherAttendance" ADD COLUMN "requiredMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "TeacherAttendance" ADD COLUMN "expectedCheckOutAt" DATETIME;
ALTER TABLE "TeacherAttendance" ADD COLUMN "completedMinutes" INTEGER;
ALTER TABLE "TeacherAttendance" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TeacherAttendance" ADD COLUMN "locationVerified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill classSectionId + expectedCheckOutAt for existing rows
UPDATE "TeacherAttendance"
SET "classSectionId" = (
  SELECT "classSectionId" FROM "ClassSession" WHERE "ClassSession"."id" = "TeacherAttendance"."sessionId"
)
WHERE "classSectionId" IS NULL;

UPDATE "TeacherAttendance"
SET "expectedCheckOutAt" = datetime("startedAt", '+120 minutes')
WHERE "expectedCheckOutAt" IS NULL AND "startedAt" IS NOT NULL;

UPDATE "TeacherAttendance"
SET
  "completedMinutes" = CAST((julianday("endedAt") - julianday("startedAt")) * 24 * 60 AS INTEGER),
  "status" = CASE
    WHEN "endedAt" IS NULL THEN 'ACTIVE'
    WHEN CAST((julianday("endedAt") - julianday("startedAt")) * 24 * 60 AS INTEGER) < 120 THEN 'EARLY_EXIT'
    ELSE 'COMPLETED'
  END
WHERE "endedAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "TeacherAttendance_status_idx" ON "TeacherAttendance"("status");
CREATE INDEX IF NOT EXISTS "TeacherAttendance_classSectionId_idx" ON "TeacherAttendance"("classSectionId");
