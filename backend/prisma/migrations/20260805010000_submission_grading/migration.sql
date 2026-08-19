-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "gradeStatus" TEXT NOT NULL DEFAULT 'NOT_GRADED';
ALTER TABLE "Submission" ADD COLUMN "gradedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "gradedById" TEXT;
ALTER TABLE "Submission" ADD COLUMN "submittedForApprovalAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Submission" ADD COLUMN "returnedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "returnedById" TEXT;
ALTER TABLE "Submission" ADD COLUMN "returnReason" TEXT;

-- CreateIndex
CREATE INDEX "Submission_gradeStatus_idx" ON "Submission"("gradeStatus");
