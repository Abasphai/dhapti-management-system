# ADR-017 — Dynamic QR Faculty Attendance (Phase A Foundation)

**Status:** Accepted (Phase A complete; Phases B–E pending)  
**Date:** 2026-08-16  
**Related:** [ADR-012 Attendance Management](ADR-012-ATTENDANCE-MANAGEMENT.md)

## Context

BIU already has ClassSection → ClassSession → TeacherAttendance (2-hour timer) plus an admin live monitor. The university needs **Dynamic QR Verified Attendance** (START/END modes, 5-minute rotating tokens, department displays) without forking a parallel FacultyAttendance model.

## Decisions (Phase A)

### 1. Extend, do not replace
- Reuse `TeacherAttendance` + `ClassSession` + existing `teacherCheckInSession` / `teacherCheckOutSession`.
- Record `checkInMethod` / `checkOutMethod`: `MANUAL | QR | ADMIN_OVERRIDE`.
- Optional `attendanceLocationId` + QR token FKs enable future room-level binding without redesign.

### 2. Status enum extension
`TeacherClassTimerStatus` adds `LATE` and `MISSED_CHECKOUT` (used in later phases; consistent across API/UI).

### 3. New models
- `AttendanceLocation` — per-department QR display (code unique per department; optional `roomHint`).
- `AttendanceQRToken` — hash-only, `START|END` mode, TTL, active/revoked (minting/display in Phase B).

### 4. SystemSettings (configurable, not hard-coded)
| Key | Default |
|-----|---------|
| `facultyAttendanceGraceMinutes` | 10 |
| `facultyQrTokenTtlSeconds` | 300 (5 min) |
| `facultyRequiredClassMinutesFallback` | 120 |
| `allowManualFacultyAttendance` | true |
| `institutionTimezone` | `Africa/Mogadishu` |
| `facultyQrEarlyStartMinutes` | 30 |
| `facultyQrLateEndMinutes` | 60 |

### 5. Permissions
- `attendance.locations.manage` — ADMIN create/update/regenerate.
- List/read: `attendance.read` for ADMIN + DEPARTMENT_ADMIN (**scoped** via `resolveDepartmentFilter`).

### 6. Security posture
Public display (Phase B) may show the current opaque token only. Tokens are cryptographically random, short-lived, mode-scoped, department/location-scoped, server-validated. Product copy: **Dynamic QR Verified Attendance** — not “100% fraud-proof”.

### 7. Manual path policy
When `allowManualFacultyAttendance` is false, shared check-in/out services reject `MANUAL` with 403.

## Phase B (2026-08-16) — Dynamic QR flow

Implemented:
- Public display `GET /api/attendance/display/:locationId` + UI `/attendance/display/:locationId`
- Token mint/rotate (hash-only, TTL from `facultyQrTokenTtlSeconds`, START|END modes)
- Faculty scan `POST /api/teacher/attendance/qr-scan` → shared `teacherCheckInSession` / `teacherCheckOutSession`
- Faculty scanner (BarcodeDetector + paste fallback) on My Attendance
- Live monitor Method + DEPARTMENT_ADMIN scope
- Multi-teacher: START/END tokens are **not** globally consumed on scan

**Known limitation:** One department display shows a single mode (END if any in-progress, else START). Overlapping classes needing the opposite action may use **manual** attendance until room-level displays (v1.1).

## Security hardening (post Phase A+B audit)

- **C1:** Live QR images are generated **in-browser** (`qrcode`); tokens are never sent to third-party QR image CDNs.
- **H1:** Anonymous `?force=1` does **not** revoke valid tokens. Display reuses the active token and re-serves the payload from an in-process raw-token cache. Admin `regenerate-tokens` remains the authorized invalidate path. Display/scan endpoints are rate-limited.
- **H2:** QR scan requires the ClassSession to be on the institution “today” and within `[scheduledStart − earlyStart, scheduledEnd + lateEnd]`.
- **H3:** Institution timezone (`Africa/Mogadishu` default) drives today, schedule binding, late detection, and display mode date selection.
- **H4:** Concurrent duplicate check-in maps Prisma `P2002` to clean HTTP 409.
- **M3:** Per `(locationId, mode)` mutex + transaction; SQLite has no partial unique index — documented alternative.
- **M6:** Initial `ACTIVE`/`LATE` status is written atomically with `TeacherAttendance` create.

## Non-goals (later phases)
Missed-checkout jobs, advanced reporting, room-level displays.
