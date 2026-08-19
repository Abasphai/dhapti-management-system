-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CourseTeacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseTeacher_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseTeacher" ("courseId", "id", "teacherId") SELECT "courseId", "id", "teacherId" FROM "CourseTeacher";
DROP TABLE "CourseTeacher";
ALTER TABLE "new_CourseTeacher" RENAME TO "CourseTeacher";
CREATE INDEX "CourseTeacher_teacherId_idx" ON "CourseTeacher"("teacherId");
CREATE INDEX "CourseTeacher_courseId_idx" ON "CourseTeacher"("courseId");
CREATE UNIQUE INDEX "CourseTeacher_courseId_teacherId_key" ON "CourseTeacher"("courseId", "teacherId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
