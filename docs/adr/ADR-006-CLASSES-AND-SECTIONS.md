# ADR-006: Classes & Sections (Course Offerings)

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-04 |
| Deciders | Lead Architect / Database / API |
| Phase | 1D-B |

---

## Context

Phase 1D-A linked Teachers to Courses via `CourseTeacher`. The Teacher portal still used mock “My Classes” cards. Attendance already had `ClassSession` (dated meeting for attendance), which is **not** a section offering.

## Decision

1. Introduce **`ClassSection`** — a scheduled offering of a Course (section A/B/C), distinct from `ClassSession`.  
2. Required FKs: `courseId`, `teacherId`.  
3. Soft academic fields: `section`, `academicYear` (string e.g. `2026/2027`), `semester` (project labels: Semester 1–IV), optional `room`, `dayOfWeek`, `startTime`, `endTime`.  
4. **Uniqueness:** `@@unique([courseId, section, academicYear, semester])`.  
5. **Teacher must already be on `CourseTeacher` for that Course** — enforced in API; Class creation does **not** auto-create CourseTeacher.  
6. Status: reuse `AcademicStatus`; DELETE soft-deactivates (future Enrollment will reference ClassSection id).  
7. No full timetable conflict engine; schedule is informational strings.  
8. No AcademicYear / Room CRUD modules.  
9. Teacher self-list: `GET /teachers/me/classes` (ACTIVE only). Admin: `/api/classes`.

## Consequences

- Future Enrollment can reference `ClassSection.id`.  
- Migration: `20260804214209_class_section`.  
- Timetable conflict detection deferred.
