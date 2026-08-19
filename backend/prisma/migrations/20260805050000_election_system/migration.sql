-- Phase 1J: University Election System
-- Safe rebuild of stub Election tables (no production election data retained from stub).

PRAGMA foreign_keys=OFF;

-- Drop stub election tables (VoteTally → VoteBallot → ElectionCandidate → Election)
DROP TABLE IF EXISTS "VoteTally";
DROP TABLE IF EXISTS "VoteBallot";
DROP TABLE IF EXISTS "ElectionCandidate";
DROP TABLE IF EXISTS "Election";

-- Recreate Election with Phase 1J fields
CREATE TABLE "Election" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "resultVisibility" TEXT NOT NULL DEFAULT 'AFTER_CLOSED',
    "eligibilityMode" TEXT NOT NULL DEFAULT 'ALL_ACTIVE_STUDENTS',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Election_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ElectionPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElectionPosition_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ElectionCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "manifesto" TEXT,
    "biography" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElectionCandidate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ElectionPosition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionCandidate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ElectionVoterEligibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "electionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElectionVoterEligibility_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionVoterEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ElectionVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "electionId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElectionVote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionVote_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ElectionPosition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionVote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ElectionCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionVote_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ElectionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "electionId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElectionAuditLog_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElectionAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Election_status_idx" ON "Election"("status");
CREATE INDEX "Election_startsAt_idx" ON "Election"("startsAt");
CREATE INDEX "Election_endsAt_idx" ON "Election"("endsAt");

CREATE UNIQUE INDEX "ElectionPosition_electionId_name_key" ON "ElectionPosition"("electionId", "name");
CREATE INDEX "ElectionPosition_electionId_idx" ON "ElectionPosition"("electionId");

CREATE UNIQUE INDEX "ElectionCandidate_positionId_studentId_key" ON "ElectionCandidate"("positionId", "studentId");
CREATE INDEX "ElectionCandidate_positionId_idx" ON "ElectionCandidate"("positionId");
CREATE INDEX "ElectionCandidate_studentId_idx" ON "ElectionCandidate"("studentId");

CREATE UNIQUE INDEX "ElectionVoterEligibility_electionId_userId_key" ON "ElectionVoterEligibility"("electionId", "userId");
CREATE INDEX "ElectionVoterEligibility_userId_idx" ON "ElectionVoterEligibility"("userId");
CREATE INDEX "ElectionVoterEligibility_electionId_idx" ON "ElectionVoterEligibility"("electionId");

CREATE UNIQUE INDEX "ElectionVote_electionId_voterUserId_positionId_key" ON "ElectionVote"("electionId", "voterUserId", "positionId");
CREATE INDEX "ElectionVote_electionId_idx" ON "ElectionVote"("electionId");
CREATE INDEX "ElectionVote_positionId_idx" ON "ElectionVote"("positionId");
CREATE INDEX "ElectionVote_candidateId_idx" ON "ElectionVote"("candidateId");
CREATE INDEX "ElectionVote_voterUserId_idx" ON "ElectionVote"("voterUserId");
CREATE INDEX "ElectionVote_electionId_candidateId_idx" ON "ElectionVote"("electionId", "candidateId");

CREATE INDEX "ElectionAuditLog_electionId_createdAt_idx" ON "ElectionAuditLog"("electionId", "createdAt");
CREATE INDEX "ElectionAuditLog_actorUserId_idx" ON "ElectionAuditLog"("actorUserId");

PRAGMA foreign_keys=ON;
