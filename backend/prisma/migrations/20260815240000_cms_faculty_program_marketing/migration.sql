-- CreateTable
CREATE TABLE "CmsFacultyMarketing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facultyKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "heroImageUrl" TEXT NOT NULL DEFAULT '',
    "overviewHtml" TEXT NOT NULL DEFAULT '',
    "careerProspectsHtml" TEXT NOT NULL DEFAULT '',
    "admissionRequirementsHtml" TEXT NOT NULL DEFAULT '',
    "deanWelcomeHtml" TEXT NOT NULL DEFAULT '',
    "departmentsJson" TEXT NOT NULL DEFAULT '[]',
    "degreesJson" TEXT NOT NULL DEFAULT '[]',
    "duration" TEXT NOT NULL DEFAULT '',
    "credits" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CmsProgramMarketing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programKey" TEXT NOT NULL,
    "facultyKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "degreeTitle" TEXT NOT NULL DEFAULT '',
    "overviewHtml" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '',
    "creditHours" TEXT NOT NULL DEFAULT '',
    "tuitionPerSemester" TEXT NOT NULL DEFAULT '',
    "careerOpportunitiesHtml" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsFacultyMarketing_facultyKey_key" ON "CmsFacultyMarketing"("facultyKey");

-- CreateIndex
CREATE INDEX "CmsFacultyMarketing_status_idx" ON "CmsFacultyMarketing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CmsProgramMarketing_programKey_key" ON "CmsProgramMarketing"("programKey");

-- CreateIndex
CREATE INDEX "CmsProgramMarketing_facultyKey_idx" ON "CmsProgramMarketing"("facultyKey");

-- CreateIndex
CREATE INDEX "CmsProgramMarketing_status_idx" ON "CmsProgramMarketing"("status");
