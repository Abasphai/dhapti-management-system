-- Phase 1N: System settings key-value store + dashboard support.

CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "SystemSetting" ("key", "value", "updatedAt") VALUES
  ('isAdmissionsOpen', 'true', CURRENT_TIMESTAMP),
  ('currentAcademicYear', '2025/2026', CURRENT_TIMESTAMP),
  ('currentSemester', 'Semester 1', CURRENT_TIMESTAMP),
  ('maintenanceMode', 'false', CURRENT_TIMESTAMP),
  ('universityName', 'Baidoa International University', CURRENT_TIMESTAMP),
  ('campusAddress', 'BIU Campus, Horseed District, Baidoa, South West State of Somalia', CURRENT_TIMESTAMP),
  ('contactEmail', 'admin@biu.edu.so', CURRENT_TIMESTAMP),
  ('contactPhone', '+252 61 555 0100', CURRENT_TIMESTAMP),
  ('registrationOpen', 'true', CURRENT_TIMESTAMP),
  ('studentPortalEnabled', 'true', CURRENT_TIMESTAMP),
  ('teacherPortalEnabled', 'true', CURRENT_TIMESTAMP);
