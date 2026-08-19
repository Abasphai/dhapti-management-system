-- Phase 1G: Retarget Quiz to ClassSection; structured questions/choices/answers; GradeStatus on attempts.
-- Existing Quiz tables were empty (verified) — safe rebuild.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "QuizAnswer";
DROP TABLE IF EXISTS "QuizChoice";
DROP TABLE IF EXISTS "QuizAttempt";
DROP TABLE IF EXISTS "QuizQuestion";
DROP TABLE IF EXISTS "Quiz";

CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSectionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "availableFrom" DATETIME,
    "availableUntil" DATETIME,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleChoices" BOOLEAN NOT NULL DEFAULT false,
    "showResultAfterSubmit" BOOLEAN NOT NULL DEFAULT false,
    "assessmentType" TEXT NOT NULL DEFAULT 'QUIZ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "correctBoolean" BOOLEAN,
    "acceptedAnswersJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuizChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QuizChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "submittedAt" DATETIME,
    "score" REAL,
    "maxScore" REAL,
    "percentage" REAL,
    "gradeStatus" TEXT NOT NULL DEFAULT 'NOT_GRADED',
    "needsManualReview" BOOLEAN NOT NULL DEFAULT false,
    "gradedAt" DATETIME,
    "submittedForApprovalAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "returnedAt" DATETIME,
    "returnedById" TEXT,
    "returnReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "choiceId" TEXT,
    "answerText" TEXT,
    "isCorrect" BOOLEAN,
    "marksAwarded" REAL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAnswer_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "QuizChoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Quiz_classSectionId_idx" ON "Quiz"("classSectionId");
CREATE INDEX "Quiz_teacherId_idx" ON "Quiz"("teacherId");
CREATE INDEX "Quiz_status_idx" ON "Quiz"("status");
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");
CREATE INDEX "QuizChoice_questionId_idx" ON "QuizChoice"("questionId");
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_attemptNumber_key" ON "QuizAttempt"("quizId", "studentId", "attemptNumber");
CREATE INDEX "QuizAttempt_quizId_studentId_idx" ON "QuizAttempt"("quizId", "studentId");
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");
CREATE INDEX "QuizAttempt_status_idx" ON "QuizAttempt"("status");
CREATE INDEX "QuizAttempt_gradeStatus_idx" ON "QuizAttempt"("gradeStatus");
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
