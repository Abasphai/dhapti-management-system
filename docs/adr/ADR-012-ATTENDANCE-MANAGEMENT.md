# ADR-012 — Attendance Management (Phase 1H)

**Status:** Accepted  
**Date:** 2026-08-05  
**Phase:** 1H  

## Context

Schema stubs existed for Course-scoped `ClassSession`, `StudentAttendance`, and loose `TeacherClassSession` check-ins (all empty). Attendance must attach to **ClassSection** meetings, support teacher start/end, student Present/Late/Absent/Excused, and Admin oversight — without inventing HR policies or QR/biometric flows.

## Decisions

### 1. ClassSection vs ClassSession
- **ClassSection** = recurring offering (CS401-A, semester).  
- **ClassSession** = one calendar meeting of that section.  
Retargeted `ClassSession` from `courseId` → `classSectionId`. Removed unused `TeacherClassSession`; introduced `TeacherAttendance` (1:1 with session).

### 2. Session lifecycle
`SCHEDULED → OPEN → COMPLETED` (also `CANCELLED`).  
- Start Class → server sets `actualStartTime` + creates `TeacherAttendance.startedAt` (never trust client clocks).  
- End Class → `actualEndTime` + `endedAt`, status `COMPLETED`.  
- Student marks allowed only while `OPEN`. Completed sessions are immutable for teachers (future Admin correction module).

### 3. Session creation
No mass generation of semester calendars. Teacher/Admin uses **ensure** (idempotent get-or-create) for a given `YYYY-MM-DD`, copying `scheduledStartTime`/`scheduledEndTime` from ClassSection schedule fields. Unique `(classSectionId, date, scheduledStartTime)`.

### 4. Student attendance
Statuses: `PRESENT | LATE | ABSENT | EXCUSED`. Absence of a row = `UNMARKED` in API (never silent mass-absent). Unique `(sessionId, studentId)`. Bulk save is all-or-nothing; only ACTIVE enrollments accepted.

### 5. Percentage policy
```
percentage = Present / (Present + Late + Absent) × 100
```
- **EXCUSED** excluded from denominator (does not penalize).  
- **LATE** does not count as Present.  
- Only **COMPLETED** sessions counted; unmarked on completed sessions counted as **ABSENT** for fairness after finalize.  
Configurable weighting deferred.

### 6. Timezone
- Calendar `date` stored as UTC midnight of `YYYY-MM-DD`.  
- “Today” and schedule wall-clock interpretation use the configurable **institution timezone** (`SystemSettings.institutionTimezone`, default **`Africa/Mogadishu`**).  
- Do **not** mix UTC calendar “today” with OS-local schedule clocks, and do not depend on the API host OS timezone.  
- `actualStartTime` / `actualEndTime` remain absolute UTC timestamps from the server.  
- Historical attendance rows are not rewritten; this changes interpretation of local wall-clock schedule time going forward.

### 7. Authorization
Reuse `attendance.read` / `attendance.manage`. Teacher ownership via ClassSection.teacherId. Student JWT-only self-read. Admin global oversight (read); no silent historical rewrite.

## Consequences
- Teacher `/teacher/attendance`, Student `/student/attendance`, Admin `/admin/attendance`.  
- Extensible for warnings, QR, analytics later without schema fork.

## Non-goals
Elections, notifications, GPA, QR/biometric, SMS, attendance export, Admin correction UI.
