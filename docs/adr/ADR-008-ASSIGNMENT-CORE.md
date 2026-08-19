# ADR-008: Assignment Core (ClassSection-scoped)

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-05 |
| Deciders | Lead Architect / Database / API |
| Phase | 1F-A |

---

## Context

Baseline `Assignment` was attached to `Course` with status `OPEN`/`CLOSED`. Enrollment and teaching offerings are section-based (`ClassSection`). Students must only see assignments for sections where they have an ACTIVE enrollment.

## Decision

1. Retarget `Assignment` to **`classSectionId`** (Restrict FK). Remove primary `courseId`.  
2. Lifecycle status: **`DRAFT` | `PUBLISHED` | `ARCHIVED`** (replaces OPEN/CLOSED).  
3. Add `instructions`, `maxMarks`, `updatedAt`. Keep `maxFileMb` for Phase 1F-B uploads (unused in 1F-A).  
4. Ownership: ClassSection.teacherId + CourseTeacher link; teacherId derived from JWT (never trusted from client).  
5. Student visibility: ACTIVE Enrollment → ClassSection → **PUBLISHED** Assignment only.  
6. Soft archive via status; do not hard-delete. No submissions/uploads/grading in this phase.

## Consequences

- Migration: `20260804223000_assignment_class_section`.  
- APIs: `/api/assignments`, `/api/assignments/me`, `/api/students/me/assignments`.  
- Future `Submission` continues to reference Assignment + Student.
