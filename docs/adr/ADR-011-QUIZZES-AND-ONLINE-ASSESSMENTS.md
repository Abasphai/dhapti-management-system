# ADR-011 — Quizzes & Online Assessments (Phase 1G)

**Status:** Accepted  
**Date:** 2026-08-05  
**Phase:** 1G  

## Context

Phase 1F-C established assignment grading with `GradeStatus` and Admin approval before student-visible results. The Prisma schema already had Course-scoped stub `Quiz` / `QuizQuestion` / `QuizAttempt` models (unused, empty). Phase 1G needs ClassSection quizzes with secure attempts, auto-grading, and consistent academic approval.

## Decisions

### 1. Retarget Quiz to ClassSection
Quizzes belong to `ClassSection` + owning `Teacher` (same ownership pattern as Assignments). Legacy `courseId` removed. Tables were empty → safe rebuild migration `20260805020000_quiz_class_section`.

### 2. Structured questions/choices/answers
- `QuestionType`: `MULTIPLE_CHOICE_SINGLE` | `TRUE_FALSE` | `SHORT_ANSWER`
- `QuizChoice` stores options; `isCorrect` never sent to students during taking
- `QuizAnswer` per attempt+question (unique)

### 3. Attempt lifecycle
`IN_PROGRESS` → `SUBMITTED` | `EXPIRED` | `CANCELLED`  
Server sets `expiresAt = startedAt + durationMinutes`. Client timer is UX only. Submit after expiry finalizes as `EXPIRED` with graded answers. Max attempts + single concurrent `IN_PROGRESS` enforced in transactions + unique `(quizId, studentId, attemptNumber)`.

### 4. Auto-grading
Server `gradeAnswers()`:
- MC / TF: full marks or zero
- Short answer: normalized exact match (trim, collapse whitespace, case-insensitive). Empty accepted list → `needsReview` (0 marks, `needsManualReview` on attempt)

No AI grading. No client-trusted scores.

### 5. Integration with Phase 1F-C grading (no auto-approve)
On submit: `gradeStatus = PENDING_APPROVAL` even for fully objective quizzes.  
Admin approves/returns via `/api/quiz-attempts/:id/approve|return` (same GradeStatus semantics as Submissions).  
**Rationale:** Prefer academic integrity and consistency over convenience; auto-approval would silently bypass the established policy.

`showResultAfterSubmit` does **not** expose official scores before `APPROVED`. Students see “submitted / awaiting approval”. Official results appear on `/students/me/results` when approved (merged with assignment results).

### 6. Extensibility
`Quiz.assessmentType` defaults to `"QUIZ"` for future MIDTERM/FINAL without new tables. Question types are an enum open to extension.

## Consequences

- Teacher `/teacher/quizzes`, Student `/student/quizzes`, Admin Grade Review quiz tab
- Correct answers never in student quiz payloads during taking
- Future: question banks, multi-select, essays, manual short-answer UI (not in 1G)

## Non-goals
Attendance, elections, notifications, GPA, transcripts, amendments, AI grading, question pools.
