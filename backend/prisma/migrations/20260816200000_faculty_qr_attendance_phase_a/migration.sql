-- Phase A: Dynamic QR Faculty Attendance foundation
-- SQLite stores enums as TEXT — no separate enum ALTER required.

-- TeacherAttendance method / late / location binding (nullable for backward compatibility)
ALTER TABLE "TeacherAttendance" ADD COLUMN "checkInMethod" TEXT;
ALTER TABLE "TeacherAttendance" ADD COLUMN "checkOutMethod" TEXT;
ALTER TABLE "TeacherAttendance" ADD COLUMN "lateByMinutes" INTEGER;
ALTER TABLE "TeacherAttendance" ADD COLUMN "attendanceLocationId" TEXT;
ALTER TABLE "TeacherAttendance" ADD COLUMN "startQrTokenId" TEXT;
ALTER TABLE "TeacherAttendance" ADD COLUMN "endQrTokenId" TEXT;

-- AttendanceLocation
CREATE TABLE "AttendanceLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "roomHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceLocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AttendanceLocation_departmentId_code_key" ON "AttendanceLocation"("departmentId", "code");
CREATE INDEX "AttendanceLocation_departmentId_idx" ON "AttendanceLocation"("departmentId");
CREATE INDEX "AttendanceLocation_status_idx" ON "AttendanceLocation"("status");

-- AttendanceQRToken (hash-only; raw token never persisted)
CREATE TABLE "AttendanceQRToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceQRToken_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AttendanceLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AttendanceQRToken_tokenHash_key" ON "AttendanceQRToken"("tokenHash");
CREATE INDEX "AttendanceQRToken_locationId_mode_active_idx" ON "AttendanceQRToken"("locationId", "mode", "active");
CREATE INDEX "AttendanceQRToken_departmentId_idx" ON "AttendanceQRToken"("departmentId");
CREATE INDEX "AttendanceQRToken_expiresAt_idx" ON "AttendanceQRToken"("expiresAt");

CREATE INDEX "TeacherAttendance_attendanceLocationId_idx" ON "TeacherAttendance"("attendanceLocationId");
