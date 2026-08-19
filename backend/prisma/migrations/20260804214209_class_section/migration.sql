-- CreateTable
CREATE TABLE "ClassSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "room" TEXT,
    "dayOfWeek" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassSection_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ClassSection_teacherId_idx" ON "ClassSection"("teacherId");

-- CreateIndex
CREATE INDEX "ClassSection_courseId_idx" ON "ClassSection"("courseId");

-- CreateIndex
CREATE INDEX "ClassSection_status_idx" ON "ClassSection"("status");

-- CreateIndex
CREATE INDEX "ClassSection_academicYear_semester_idx" ON "ClassSection"("academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSection_courseId_section_academicYear_semester_key" ON "ClassSection"("courseId", "section", "academicYear", "semester");
