# ADR-005: Teacher ↔ Course Assignment

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-04 |
| Deciders | Lead Architect / Database / API |
| Phase | 1D-A |

---

## Context

Phase 1C established Faculty → Department → Course. Teachers already have optional `departmentId`. The schema already included a many-to-many join `CourseTeacher` (`@@unique([courseId, teacherId])`) used lightly by seed data, but Admin UI did not persist assignments and Teacher Portal had no self-service course list.

## Decision

1. **Reuse `CourseTeacher`** — do not invent a second join table.  
2. Add `createdAt` / `updatedAt` (+ indexes) for assignment metadata.  
3. **Many-to-many:** a Teacher may teach many Courses; a Course may have many Teachers.  
4. **Cross-department teaching allowed:** schema does not require `Teacher.departmentId === Course.departmentId`, and `Teacher.departmentId` is nullable. Assignment APIs do **not** enforce department equality.  
5. **Active-only for new assignments:** Teacher `User.status` and Course `AcademicStatus` must be `ACTIVE`. Existing rows are not auto-deleted when status later changes.  
6. **Admin APIs:** `GET/POST /teachers/:id/courses`, `DELETE /teachers/:id/courses/:courseId`, `GET /courses/:id/teachers`.  
7. **Teacher self API:** `GET /teachers/me/courses` — identity from JWT only.  
8. **Permissions:** `teacher_courses.read|assign|remove` (Admin). Teachers use role gate for `/me/courses`.  
9. **Out of scope:** Classes, Enrollment, Assignments, timetable fields on the join.

## Consequences

- Admin Teachers UI and Teacher “My Courses” bind to real assignments.  
- Future Classes/Enrollment can reference Course + Teacher without restructuring this join.  
- Migration: `20260804213144_course_teacher_timestamps`.
