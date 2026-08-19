# ADR-015 — GPA, Course Results & Transcript Foundation (Phase 1K)

**Status:** Accepted  
**Date:** 2026-08-05  
**Phase:** 1K  

## Context

Phase 1F-C established **assessment grading** on Assignment `Submission` and QuizAttempt (`grades.*`), exposed to students as APPROVED rows on `GET /api/students/me/results`. Course-level finals, GPA, and transcripts were explicitly deferred.

Phase 1K must deliver an Enrollment/ClassSection-scoped **course-final** layer without inventing Dhapti institutional policy (letter bands, grade-point scale, assessment weights, retake rules, academic standing).

## Decisions

### 1. ResultEntry reused and evolved

The existing unused `ResultEntry` model was evolved rather than replaced with a duplicate `CourseResult` table. Migration: `20260805060000_course_results_gpa_foundation` (non-destructive).

### 2. Enrollment / ClassSection-scoped identity (retake-safe)

Primary uniqueness is `UNIQUE(enrollmentId)`. The prior `UNIQUE(studentId, courseId)` rule was removed so the same student may have multiple finals for the same course across different ClassSections/terms. Retake **replacement / averaging policy is deferred** (future Dhapti business rule).

### 3. Assessment results remain separate

`GET /api/students/me/results` continues to mean **APPROVED assignment/quiz assessment results**. Course finals use additive endpoints:

- `GET /api/students/me/course-results`
- `GET /api/students/me/gpa`
- `GET /api/students/me/transcript`

### 4. No Dhapti grading policy invented

No seeded A/B/C/D/F thresholds or 4.0/5.0 grade-point values. `GradeScale` + `GradeScaleBand` exist as configuration tables; until an **active** scale with bands exists:

- `letterGrade` / `gradePoint` remain null → API displays `"Not configured"`
- GPA status is `NOT_CONFIGURED`

### 5. No hardcoded assessment weights

`AssessmentWeight` is per ClassSection and must sum to 100. Calculation fails with a clear error if weights are missing or invalid. No silent 40/60 (or any) default.

### 6. GPA disabled until grade-point policy configured

`backend/src/lib/gpa.ts` returns `status: "NOT_CONFIGURED"` when no active grade scale exists. It does **not** invent a numeric GPA.

### 7. Retake policy deferred

Architecture allows multiple Enrollment-scoped results for one Course. Which result counts toward GPA/transcript standing is **future Dhapti policy**.

### 8. Academic standing deferred

No probation / suspension thresholds.

### 9. Result amendments deferred

`APPROVED` course results are immutable. No correction workflow in Phase 1K. Legacy enum values `REJECTED` / `CORRECTION_REQUESTED` remain in the schema for compatibility but are unused by the 1K workflow.

## Result workflow

Evolved `ResultStatus` for course finals:

```
DRAFT → CALCULATED → PENDING_APPROVAL → APPROVED
                         ↓
                     RETURNED → (recalculate) → CALCULATED → …
```

Distinct from assessment `GradeStatus` on Submission/QuizAttempt.

| Role | Capabilities |
|------|----------------|
| TEACHER | Configure weights for own ClassSection; calculate; submit; cannot approve |
| ADMIN | Review; approve; return with reason |
| STUDENT | See APPROVED course results only |

## Permissions

| Domain | Permissions | Meaning |
|--------|-------------|---------|
| Assessment grading | `grades.*` | Assignment/Quiz marks |
| Course finals | `results.read/create/update/submit/approve/return` | ClassSection final ResultEntry |

`results.read` and `results.approve` already existed; create/update/submit/return were added without renaming.

## Weighting architecture

```
ClassSection → AssessmentWeight[] → APPROVED assessment scores → numeric final
```

Supported component types: ASSIGNMENT, QUIZ, EXAM, MIDTERM, FINAL_EXAM, OTHER.  
Phase 1K calculation uses ASSIGNMENT and QUIZ approved averages only; configuring EXAM/MIDTERM/FINAL_EXAM weights blocks calculation until those sources exist.

## Grading-scale architecture

`backend/src/lib/gradingScale.ts` + `GradeScale` / `GradeScaleBand`. Maps numeric score → letter → grade point **only when configured**.

## Transcript

`GET /api/students/me/transcript` groups APPROVED course results by Academic Year → Semester, with credit totals. PDF/printing deferred. Cumulative GPA appears only when the grade scale is configured.

## Notifications

On Admin approval, Phase 1I `notifyCourseResultApproved` creates type `RESULT` with dedupe `result.approved:{resultId}` for the student only.

## Consequences

- Numeric course finals can ship without inventing Dhapti policy.
- GPA/letter displays honestly as “Not configured” until Admin configures an active scale.
- Assessment and course-final APIs remain non-breaking and distinct.

## Future work (not Phase 1K)

- DHAPTI-approved letter/grade-point bands  
- Institutional default weight templates  
- Exam / midterm / final-exam score sources  
- Retake replacement/averaging rules  
- Academic standing  
- Grade amendments of APPROVED finals  
- Transcript PDF  
- Graduation / degree audit  
