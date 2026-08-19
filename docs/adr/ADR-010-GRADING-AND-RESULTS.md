# ADR-010 — Grading and Results (Phase 1F-C)

**Status:** Accepted  
**Date:** 2026-08-05  
**Phase:** 1F-C  

## Context

Phase 1F-B delivered assignment file submissions on `Submission` with unused `score` / `feedback` columns. The product requires an Admin-gated grading workflow so **students never see unapproved marks**.

The schema already contained a course-level `ResultEntry` model (`unique(studentId, courseId)`, `ResultStatus`). That model is unsuitable for per-assignment grading without breaking its course-result semantics.

## Decision

1. **Reuse `Submission` for assignment grades** — keep `score` / `feedback`; add explicit `GradeStatus` workflow fields and audit columns (`gradedBy`, `approvedBy`, `returnedBy`, timestamps, `returnReason`).
2. **Do not use `ResultEntry` in 1F-C** — leave it for a future course-level / transcript aggregation module.
3. **Lifecycle:**
   ```
   NOT_GRADED → GRADED → PENDING_APPROVAL → APPROVED
                              ↓
                          RETURNED → (teacher corrects) → GRADED → PENDING_APPROVAL → …
   ```
4. **Student visibility:** only `gradeStatus = APPROVED` is returned from `/api/students/me/results` and from student submission serializers.
5. **Immutability:** `APPROVED` grades cannot be edited by teachers. Formal grade amendment is a future module.
6. **Percentage:** computed server-side as `(score / maxMarks) * 100`. Never trusted from the client.
7. **Permissions:** `grades.read|update|submit|approve|return` plus existing `results.read` for student results.
8. **Assessment type tag:** student result DTOs include `assessmentType: "ASSIGNMENT"` so quizzes/exams can reuse the results envelope later without changing student UX contracts.

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Grade only via `ResultEntry` | One row per course; cannot represent multiple assignments |
| New `Grade` table 1:1 with Submission | Redundant with existing score/feedback; extra join for no gain |
| Null-score = hidden | Ambiguous; no approval audit trail |

## Consequences

- Assignment grading is live for Teacher → Admin → Student.
- Future quizzes/exams should introduce assessment-agnostic grade rows or polymorphic links; `assessmentType` on student results prepares the contract.
- GPA / transcript / amendment workflows remain out of scope (no invented university policy).
- `ResultEntry` remains unused until a dedicated course-result phase.

## Future work (not in 1F-C)

- Grade amendment of approved marks  
- GPA / letter-grade policy  
- Quiz / exam / midterm / final grading  
- Transcript generation  
- Full AuditLog framework (current fields on Submission are the minimum accountability set)
