# ADR-004: Academic Structure (Faculty → Department → Course)

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-04 |
| Deciders | Lead Architect / Database / API |
| Phase | 1C |

---

## Context

Phase 1B delivered Admin Students & Teachers. Academic hierarchy models already existed in Prisma (`Faculty`, `Department`, `Course`) with FK relationships, but lacked Admin CRUD APIs, status lifecycle, and UI binding. Student/Teacher already had optional `facultyId` / `departmentId` FKs.

## Decision

1. **Hierarchy:** Faculty → Department → Course via foreign keys (`Department.facultyId`, `Course.departmentId`).  
2. **Course.departmentId** is required (was nullable; all existing rows already populated).  
3. **AcademicStatus** enum (`ACTIVE` | `INACTIVE` | `SUSPENDED`) on Faculty, Department, Course for soft deactivation.  
4. **No hard delete** of academic entities by default; DELETE endpoints deactivate.  
5. **No Student/Teacher enrollment or CourseTeacher assignment** in this phase.  
6. **No automatic string→FK backfill** for historical `Student.program` labels that do not uniquely map to Faculty rows; Admin assigns FKs going forward.  
7. **Permissions:** `faculties.*`, `departments.*` Admin-only; `courses.create/update/delete` Admin-only (`courses.read` remains available to Teacher/Student for future portals).  
8. **API prefix** remains `/api` (no `/v1`).

## Consequences

- Future enrollment, assignment, attendance, and results modules can depend on stable academic IDs.  
- Admin UI “Faculties & Departments” manages all three levels with cascading Faculty→Department selectors for courses.  
- Migration: `20260804211448_academic_structure_status` (data preserved; defaults ACTIVE).

## Security note (deferred)

Phase 1B default account password `DHAPTI@2026` remains a **development** credential. Production must move to temporary credentials + forced password change in a future auth phase — not changed in 1C.
