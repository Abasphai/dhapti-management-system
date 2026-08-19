# ADR-007: Student Enrollment Core

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-05 |
| Deciders | Lead Architect / Database / API |
| Phase | 1E-A |

---

## Context

Phase 1D-B introduced `ClassSection` as the academic offering. The baseline schema had `Enrollment` linking **Student → Course**, which is incorrect for section-based teaching (teacher, room, term, section live on `ClassSection`).

Assignments, Quizzes, Results, and Attendance must later hang off Enrollment / ClassSection — not a direct Student→Course primary link.

## Decision

1. **Reuse** the existing `Enrollment` model; retarget it from `courseId` to **`classSectionId`**.  
2. Relationship chain:

   ```
   Student → Enrollment → ClassSection → Course
                                    └── Teacher
   ```

3. **Uniqueness:** `@@unique([studentId, classSectionId])`.  
4. **Status:** keep existing `EnrollmentStatus` (`ACTIVE` | `COMPLETED` | `DROPPED`). Soft drop via `DROPPED` (DELETE endpoint); no hard delete of history.  
5. **Do not** denormalize `academicYear` / `semester` onto Enrollment — read from ClassSection.  
6. **Do not** introduce Student→Course as the primary enrollment FK.  
7. New enrollments require ACTIVE Student (User), ACTIVE ClassSection, ACTIVE Course.  
8. Admin manages enrollments; Student may only read own enrollments via JWT→Student; Teacher has no enrollment management.  
9. Legacy course-based Enrollment rows (3 seed rows) were cleared in migration — they could not be remapped without ClassSection IDs.

## Consequences

- Migration: `20260804220000_enrollment_class_section`.  
- APIs: `/api/enrollments`, `GET /api/students/me/enrollments`, `GET /api/classes/:id/students`.  
- Permissions: `enrollments.read|create|update|delete` (Admin only).  
- Future modules reference stable `Enrollment.id` and `ClassSection.id`.  
- Same-course multi-section restriction deferred (uniqueness is Student+ClassSection only).
