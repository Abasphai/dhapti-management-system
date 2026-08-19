# Database Schema & Entity Models — Dhapti UMS

**Authority:** Database Architect Agent  
**Source of truth:** `backend/prisma/schema.prisma`  
**Local provider:** SQLite · **Production target:** PostgreSQL

---

## 1. Design Goals

- Scale from ~500 to 50,000+ students via normalization, indexes, and Postgres.
- Support secret-ballot elections (voter audit ≠ public choice).
- Support multi-step result approval (`PENDING_APPROVAL` → `APPROVED` / `REJECTED`).
- Every schema change requires migration, impact analysis, and rollback plan.

---

## 2. Enums

| Enum | Values |
|------|--------|
| `Role` | `STUDENT`, `TEACHER`, `ADMIN` *(extensible later: REGISTRAR, FINANCE_OFFICER, …)* |
| `UserStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `EnrollmentStatus` | `ACTIVE`, `COMPLETED`, `DROPPED` |
| `AssignmentStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `SubmissionStatus` | `SUBMITTED`, `LATE`, `GRADED` |
| `GradeStatus` | `NOT_GRADED`, `GRADED`, `PENDING_APPROVAL`, `APPROVED`, `RETURNED` |
| `QuizStatus` | `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED` |
| `QuestionType` | `MULTIPLE_CHOICE_SINGLE`, `TRUE_FALSE`, `SHORT_ANSWER` |
| `QuizAttemptStatus` | `IN_PROGRESS`, `SUBMITTED`, `EXPIRED`, `CANCELLED` |
| `AttendanceStatus` | `PRESENT`, `ABSENT`, `LATE`, `EXCUSED` |
| `ClassSessionStatus` | `SCHEDULED`, `OPEN`, `COMPLETED`, `CANCELLED` |
| `ResultStatus` | `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CORRECTION_REQUESTED` *(course-level ResultEntry; unused in 1F-C)* |
| `AdmissionStatus` | `NEW`, `UNDER_REVIEW`, `INTERVIEW_SCHEDULED`, `APPROVED`, `REJECTED` |
| `ElectionStatus` | `DRAFT`, `PUBLISHED`, `OPEN`, `CLOSED`, `FINALIZED`, `ARCHIVED` |
| `ElectionResultVisibility` | `HIDDEN`, `LIVE`, `AFTER_CLOSED`, `AFTER_FINALIZED` |
| `ElectionEligibilityMode` | `ALL_ACTIVE_STUDENTS`, `SELECTED_STUDENTS` |
| `NotificationType` | `SYSTEM`, `ANNOUNCEMENT`, `ASSIGNMENT`, `GRADE`, `QUIZ`, `ATTENDANCE`, `ACADEMIC`, `SECURITY` (+ legacy) |
| `NotificationPriority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` |

---

## 3. Core Models (current Prisma)

### Identity & org
| Model | Purpose |
|-------|---------|
| `User` | Auth identity, role, status |
| `Student` | Profile + academic links; `studentCode` unique |
| `Teacher` | Faculty profile; `facultyCode` unique |
| `Admin` | Admin profile |
| `Faculty` | Top academic unit |
| `Department` | Belongs to Faculty |
| `Course` | Catalog course |
| `CourseTeacher` | Teacher ↔ Course |
| `ClassSection` | Scheduled course offering (section + term) |
| `Enrollment` | Student ↔ ClassSection |

### Assessment & learning
| Model | Purpose |
|-------|---------|
| `Assignment` | ClassSection-scoped work (`maxMarks`, lifecycle status) |
| `AssignmentMaterial` | Attachments (future upload phase) |
| `Submission` | Student upload + grade |
| `Quiz` / `QuizQuestion` / `QuizAttempt` | Timed quizzes |

### Attendance
| Model | Purpose |
|-------|---------|
| `ClassSession` | Session for a course |
| `StudentAttendance` | Present / Absent / Late |
| `TeacherClassSession` | Teacher check-in / check-out |

### Results
| Model | Purpose |
|-------|---------|
| `ResultEntry` | Marks + approval workflow fields |

### Elections (Phase 1J)
| Model | Purpose |
|-------|---------|
| `Election` | Lifecycle, dates, result visibility, eligibility mode |
| `ElectionPosition` | Offices within an election |
| `ElectionCandidate` | Student-linked candidate per position |
| `ElectionVote` | One vote per voter per position (aggregates only in API) |
| `ElectionVoterEligibility` | SELECTED_STUDENTS roster |
| `ElectionAuditLog` | Append-only admin/vote events |

### Comms & ops
| Model | Purpose |
|-------|---------|
| `CourseQuestion` / `CourseQuestionReply` | Student–teacher Q&A |
| `CourseMaterial` | Education materials |
| `AdmissionApplication` | Admissions queue |
| `Payment` | Fees |
| `TeacherRating` | Ratings |
| `Notification` | In-app content (fan-out via recipients) |
| `NotificationRecipient` | Per-user delivery + `readAt` |
| `AuditLog` | Immutable action log |

---

## 4. Conceptual ERD (simplified)

```
User ──1:1── Student|Teacher|Admin
Faculty ──1:N── Department ──1:N── Course
Course ──1:N── ClassSection ──N:1── Teacher
Student ──N:M── ClassSection (via Enrollment)
Teacher ──N:M── Course (via CourseTeacher)
ClassSection ──1:N── Assignment ──1:N── Submission (file + grade workflow)
Course ──1:N── ResultEntry (approval pipeline)
Election ──1:N── ElectionPosition ──1:N── ElectionCandidate → Student
Election ──1:N── ElectionVote (voterUserId; never exposed as individual choices)
Election ──1:N── ElectionAuditLog
```

---

## 5. Student Profile Field Rules

| Field | Student | Admin |
|-------|---------|-------|
| Profile photo, phone, address | Edit | Edit |
| Full name, mother's name, email, blood group | Read-only | Edit |

---

## 6. Indexes (existing highlights)

- `User`: `[role, status]`
- `Student`: `[facultyId]`, `[studentCode]`
- `Teacher`: `[facultyCode]`
- `Department`: `[facultyId]`
- Unique: emails, codes, course codes

**Phase 9:** Add composite indexes for attendance queries, result lookups by student+semester, election tallies.

---

## 7. Gap vs Master Directive Entities

Directive names vs current schema (mapping):

| Directive | Current / plan |
|-----------|----------------|
| Programs / Classes | Partial via `program`, `ClassSession`; expand in Phase 3 |
| AssignmentSubmissions | `Submission` |
| QuizAnswers | Extend `QuizAttempt` payload / child table |
| Questions / Answers | `CourseQuestion` / `CourseQuestionReply` + quiz questions |
| Files | Path fields today; dedicated `File` metadata model Phase 4/13 |
| StudentAttendance / TeacherAttendance | `StudentAttendance` / `TeacherClassSession` |

---

## 8. Migration Policy

1. Database Agent proposes schema diff + impact.
2. Create Prisma migration with `npx prisma migrate dev --name <desc>` (local SQLite).
3. Document rollback (previous migration / DB backup).
4. Update this file + `PROJECT_CONTEXT.md`.
5. **Do not** use `prisma migrate reset` or delete `dev.db` without explicit approval.
6. Prefer **not** using `prisma db push` for feature work once migrations exist.

See [ADR-003](./adr/ADR-003-DATABASE-MIGRATION-STRATEGY.md).

## 9. Phase 1A / Pre-1B / 1B notes

**Phase 1A:** No Prisma schema changes (User/Role/UserStatus sufficient).

**Pre-Phase 1B baseline (2026-08-04):**
- Provider: SQLite (`file:./dev.db`) — synchronized with `schema.prisma` (empty diff).
- History created: `prisma/migrations/20260804200000_baseline/`
- Applied via `prisma migrate resolve --applied` (SQL **not** re-executed; data preserved).
- Status: **Database schema is up to date.**
- PostgreSQL remains optional via Docker; cutover requires separate provider ADR (SQLite baseline SQL is not portable as-is).

**Phase 1B (Students & Teachers Admin):**
- **No new migration** — existing `User` ↔ `Student` / `Teacher` models and unique constraints (`email`, `studentCode`, `facultyCode`) were sufficient.
- Identity: `User` (auth) + profile tables (academic/staff); passwords only on `User.passwordHash`.
- Deactivation: set `User.status` to `INACTIVE` / `SUSPENDED`; do not hard-delete profiles by default.

**Phase 1C (Academic Structure):**
- Migration: `20260804211448_academic_structure_status`
- Added `AcademicStatus` enum; `status` + timestamps on `Faculty`, `Department`, `Course`
- `Course.departmentId` now **required** (existing rows already populated; no orphan courses)
- Hierarchy: Faculty → Department → Course
- Student `facultyId` / `departmentId` and Teacher `departmentId` FKs unchanged (already present)
- Soft deactivate academic entities; no destructive wipe
- See [ADR-004](./adr/ADR-004-ACADEMIC-STRUCTURE.md)

**Phase 1D-A (Teacher ↔ Course):**
- Reused existing `CourseTeacher` join (`@@unique([courseId, teacherId])`)
- Migration: `20260804213144_course_teacher_timestamps` — `createdAt`/`updatedAt` + indexes
- Not Enrollment; not Classes
- See [ADR-005](./adr/ADR-005-TEACHER-COURSE-ASSIGNMENT.md)

**Phase 1D-B (Classes & Sections):**
- New model `ClassSection` (distinct from attendance `ClassSession`)
- Migration: `20260804214209_class_section`
- Unique `(courseId, section, academicYear, semester)`
- Soft status; Restrict FKs on Course/Teacher
- See [ADR-006](./adr/ADR-006-CLASSES-AND-SECTIONS.md)

**Phase 1E-A (Student Enrollment Core):**
- Retargeted `Enrollment` from Course → **ClassSection**
- Migration: `20260804220000_enrollment_class_section` (cleared 3 legacy course-based rows)
- Unique `(studentId, classSectionId)`; status `ACTIVE` \| `COMPLETED` \| `DROPPED`
- Soft drop retains history; academic year/semester via ClassSection
- See [ADR-007](./adr/ADR-007-STUDENT-ENROLLMENT.md)

**Phase 1F-A (Assignment Core):**
- Retargeted `Assignment` from Course → **ClassSection**
- Migration: `20260804223000_assignment_class_section`
- Status `DRAFT` \| `PUBLISHED` \| `ARCHIVED`; fields `instructions`, `maxMarks`, `updatedAt`
- `maxFileMb` retained for Phase 1F-B; no submission UI yet
- See [ADR-008](./adr/ADR-008-ASSIGNMENT-CORE.md)

**Phase 1F-B (Submission & File Storage):**
- Extended `Submission`: required `fileName`, `storageKey`, `mimeType`, `fileSize`, `updatedAt`
- Unique `(assignmentId, studentId)`; no file BLOB in SQLite
- Migration: `20260804224500_submission_storage`
- See [ADR-009](./adr/ADR-009-ASSIGNMENT-SUBMISSION-STORAGE.md)

**Phase 1F-C (Grading & Results):**
- Extended `Submission` with `GradeStatus` + grading/approval audit fields
- Migration: `20260805010000_submission_grading` (non-destructive ALTER)
- Reuses `score`/`feedback`; `ResultEntry` reserved then evolved in Phase 1K
- See [ADR-010](./adr/ADR-010-GRADING-AND-RESULTS.md)

**Phase 1G (Quizzes):**
- Retargeted `Quiz` → ClassSection; added `QuizChoice`, structured `QuizAnswer`
- `QuizAttempt` carries `GradeStatus` for Admin approval (consistent with 1F-C)
- Migration: `20260805020000_quiz_class_section` (empty legacy tables rebuilt)
- See [ADR-011](./adr/ADR-011-QUIZZES-AND-ONLINE-ASSESSMENTS.md)

**Phase 1H (Attendance):**
- Retargeted `ClassSession` → ClassSection; `TeacherAttendance` (1:1 session)
- StudentAttendance unique (sessionId, studentId); EXCUSED added
- Removed unused `TeacherClassSession` stub
- Migration: `20260805030000_attendance_class_session`
- See [ADR-012](./adr/ADR-012-ATTENDANCE-MANAGEMENT.md)

**Phase 1I (Notifications):**
- `Notification` + `NotificationRecipient` (userId ownership; unique notificationId+userId)
- Loose `sourceType`/`sourceId`; unique optional `dedupeKey` for auto-events
- Migration: `20260805040000_notification_foundation`
- See [ADR-013](./adr/ADR-013-NOTIFICATION-FOUNDATION.md)

**Phase 1J (Elections):**
- Replaced stub VoteBallot/VoteTally with `ElectionPosition`, student-linked `ElectionCandidate`, `ElectionVote`, `ElectionVoterEligibility`, `ElectionAuditLog`
- Unique vote `(electionId, voterUserId, positionId)`; candidate unique `(positionId, studentId)`
- Migration: `20260805050000_election_system`
- See [ADR-014](./adr/ADR-014-UNIVERSITY-ELECTION-SYSTEM.md)

**Phase 1K (Course Results / GPA / Transcript):**
- Evolved `ResultEntry`: `UNIQUE(enrollmentId)`; creditHours snapshot; optional letter/gradePoint; workflow statuses
- Added `AssessmentWeight`, `GradeScale`, `GradeScaleBand`, `AssessmentComponentType`
- `ResultStatus` includes DRAFT/CALCULATED/PENDING_APPROVAL/APPROVED/RETURNED (+ legacy REJECTED/CORRECTION_REQUESTED)
- Migration: `20260805060000_course_results_gpa_foundation`
- See [ADR-015](./adr/ADR-015-GPA-RESULTS-TRANSCRIPT.md)

**Phase 1L (Finance & Fees):**
- Evolved stub `Payment` into fee ledger: description, semester, receiptNumber, paymentMethod, PaymentStatus, dueDate, paidAt, recordedBy
- Migration: `20260809100000_finance_payments`
- Student pay + Admin record/summary APIs

**Phase 1M (Online Admissions):**
- Evolved `AdmissionApplication`: trackingCode, required email, programId→Course, highSchoolGPA, documentsUrl, rejectionReason, decisionDate, decidedBy, studentId; status `PENDING` (replaces legacy `NEW`)
- Migration: `20260809110000_admissions_workflow`
- Approve atomically creates User+Student+PENDING Semester 1 Payment

**Phase 1N (Settings & Dashboards):**
- Added `SystemSetting` key-value store (`key`, `value`, `updatedAt`)
- Seeded keys: `isAdmissionsOpen`, `currentAcademicYear`, `currentSemester`, `maintenanceMode`, plus university profile / portal toggles
- Migration: `20260809120000_system_settings`
