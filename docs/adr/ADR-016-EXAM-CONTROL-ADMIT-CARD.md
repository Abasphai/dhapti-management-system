# ADR-016 — Exam Control Admin & Admit Card Clearance

- **Status:** Accepted  
- **Date:** 2026-08-16  
- **Phase:** Step 1 Exam Control

## Context

BIU needs a dedicated Controllers of Examinations workspace separate from Finance/CMS/Settings, plus automated student exam clearance before printing hall tickets.

## Decision

1. Add Prisma role `EXAM_ADMIN` with permissions: `exams.read`, `exams.manage`, `admitcards.generate`, `results.verify`, `results.publish` (plus limited academic read + `results.approve` for publish gate).
2. Models: `ExamSession`, `ExamSchedule`, `ExamAdmitCard`.
3. Clearance engine (`examClearance.ts`):
   - Attendance ≥ 75% overall (PRESENT / (PRESENT+LATE+ABSENT))
   - Zero pending/overdue tuition (`getStudentFinancialHold`)
   - Manual override stored on `ExamAdmitCard`
4. APIs under `/api/student/admit-card` and `/api/admin/exams/*`.
5. UI: `/student/admit-card` (CLEARED printable card / HELD blockers) and `/admin/exam-control` workspace.

## Consequences

- EXAM_ADMIN logs in via Admin portal; nav filtered to Exam Control + results/grades/notifications.
- Finance, global settings, and CMS remain 403 for EXAM_ADMIN.
- Main ADMIN retains exam permissions for continuity.
