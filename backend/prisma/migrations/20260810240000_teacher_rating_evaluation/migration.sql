-- Expand TeacherRating for end-of-semester lecturer evaluation.
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "TeacherRating";

CREATE TABLE "TeacherRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "teachingQuality" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "engagement" INTEGER NOT NULL,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherRating_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherRating_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeacherRating_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TeacherRating_studentId_teacherId_courseId_semester_academicYear_key"
ON "TeacherRating"("studentId", "teacherId", "courseId", "semester", "academicYear");

CREATE INDEX "TeacherRating_teacherId_idx" ON "TeacherRating"("teacherId");
CREATE INDEX "TeacherRating_courseId_idx" ON "TeacherRating"("courseId");
CREATE INDEX "TeacherRating_academicYear_semester_idx" ON "TeacherRating"("academicYear", "semester");

PRAGMA foreign_keys=ON;
