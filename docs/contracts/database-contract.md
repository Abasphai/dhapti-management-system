# Database Contract — Dhapti UMS

**Owner:** Database Architect  
**Source of truth:** `backend/prisma/schema.prisma`  
**Consumers:** Backend Engineer, API Architect, all domain agents  

---

## 1. Rules

1. Prisma schema is the only structural source of truth.  
2. Every schema change requires a migration (or documented `db push` for local-only) + impact analysis.  
3. No agent invents parallel models that duplicate existing entities.  
4. Breaking column renames require API contract updates in the same change set.

---

## 2. Identity Core

| Entity | Key fields | Notes |
|--------|------------|-------|
| `User` | `id`, `email` unique, `passwordHash`, `role`, `status` | Auth root |
| `Student` | `userId` 1:1, `studentCode` unique, profile fields | See profile edit rules |
| `Teacher` | `userId` 1:1, `facultyCode` unique | Staff ID = `facultyCode` |
| `Admin` | `userId` 1:1 | |

**Roles enum:** `STUDENT` \| `TEACHER` \| `ADMIN` (extensible later).

### Phase 1B identity rules

1. Do not store password/role on `Student` / `Teacher` — only on `User`.  
2. Admin create must insert `User` + profile in one transaction.  
3. Unique: `User.email`, `Student.studentCode`, `Teacher.facultyCode`.  
4. Soft deactivate via `User.status` (`ACTIVE` \| `INACTIVE` \| `SUSPENDED`); prefer over hard delete.  
5. Student self-edit (API): phone, address, profilePhoto only. Admin may update protected fields (name, motherName, email, bloodGroup, codes).  
6. No schema migration in Phase 1B (models already present).

### Phase 1C academic structure

| Entity | Unique | Status | Parent FK |
|--------|--------|--------|-----------|
| `Faculty` | `code` | `AcademicStatus` | — |
| `Department` | `code` | `AcademicStatus` | `facultyId` required |
| `Course` | `code` | `AcademicStatus` | `departmentId` required; `facultyId` denormalized from department |

1. Soft deactivate academic entities; do not hard-delete when children/history exist.  
2. Student may reference `facultyId` / `departmentId`; Teacher may reference `departmentId`.  
3. Enrollment / `CourseTeacher` assignment modules are **out of scope** for 1C.  
4. Migration: `20260804211448_academic_structure_status` — see ADR-004.

### Phase 1D-A Teacher ↔ Course

| Entity | Keys | Notes |
|--------|------|-------|
| `CourseTeacher` | `id`, unique `(courseId, teacherId)`, `createdAt`, `updatedAt` | Many-to-many; not Enrollment |

1. Assign only when Teacher user is ACTIVE and Course is ACTIVE.  
2. Removing an assignment deletes the join row only.  
3. Cross-department teaching allowed — see ADR-005.

### Phase 1D-B ClassSection

| Field | Notes |
|-------|-------|
| `courseId`, `teacherId` | Required FKs (Restrict) |
| `section`, `academicYear`, `semester` | Unique together with `courseId` |
| `room`, `dayOfWeek`, `startTime`, `endTime` | Optional schedule display |
| `status` | `AcademicStatus` |

1. Distinct from `ClassSession` (attendance).  
2. API requires `CourseTeacher` link — not a DB FK.  
3. Stable `id` for Enrollment. See ADR-006.

### Phase 1E-A Enrollment

| Field | Notes |
|-------|-------|
| `studentId` | FK → Student (Cascade) |
| `classSectionId` | FK → ClassSection (Restrict) |
| `status` | `EnrollmentStatus`: ACTIVE / COMPLETED / DROPPED |
| `enrolledAt`, `updatedAt` | Timestamps |
| Unique | `(studentId, classSectionId)` |

1. Primary enrollment is **Student → ClassSection**, not Student → Course.  
2. Soft drop uses `DROPPED`; do not hard-delete history.  
3. New enrollments require ACTIVE User (student), ACTIVE ClassSection, ACTIVE Course.  
4. Migration: `20260804220000_enrollment_class_section` — see ADR-007.

### Phase 1F-A Assignment

| Field | Notes |
|-------|-------|
| `classSectionId` | FK → ClassSection (Restrict) |
| `teacherId` | FK → Teacher (Restrict); must match ClassSection teacher |
| `title`, `description`, `instructions` | Text fields |
| `dueAt` | DateTime |
| `maxMarks` | Positive int |
| `maxFileMb` | Reserved for Phase 1F-B (default 500) |
| `status` | DRAFT / PUBLISHED / ARCHIVED |

1. Primary owner is **ClassSection**, not Course.  
2. Students see PUBLISHED only via ACTIVE Enrollment.  
3. Soft archive; Submission table unused in 1F-A.  
4. Migration: `20260804223000_assignment_class_section` — see ADR-008.

### Phase 1F-B Submission

| Field | Notes |
|-------|-------|
| `assignmentId`, `studentId` | Unique pair |
| `fileName`, `mimeType`, `fileSize` | Client-facing metadata |
| `storageKey` | Relative private storage key |
| `status` | SUBMITTED / LATE / GRADED (create uses SUBMITTED) |
| `score`, `feedback` | Used by Phase 1F-C grading |

Migration: `20260804224500_submission_storage` — see ADR-009.

### Phase 1F-C Grading on Submission

| Field | Notes |
|-------|-------|
| `gradeStatus` | `NOT_GRADED` → `GRADED` → `PENDING_APPROVAL` → `APPROVED` \| `RETURNED` |
| `gradedAt`, `gradedById` | Teacher audit |
| `submittedForApprovalAt` | Teacher submit |
| `approvedAt`, `approvedById` | Admin approve |
| `returnedAt`, `returnedById`, `returnReason` | Admin return |
| `ResultEntry` | Evolved in Phase 1K for course finals (not used for assignment grades) |

Migration: `20260805010000_submission_grading` — see ADR-010.  
Invariant: students see marks only when `gradeStatus = APPROVED`. APPROVED is immutable for teachers.

### Phase 1G Quiz

| Model | Notes |
|-------|-------|
| `Quiz` | ClassSection + Teacher; QuizStatus; server `totalMarks` |
| `QuizQuestion` | QuestionType + marks; SHORT_ANSWER `acceptedAnswersJson` |
| `QuizChoice` | `isCorrect` teacher-only |
| `QuizAttempt` | attemptNumber unique per student; GradeStatus approval |
| `QuizAnswer` | unique (attemptId, questionId) |

Migration: `20260805020000_quiz_class_section` — see ADR-011.

### Phase 1H Attendance

| Model | Notes |
|-------|-------|
| `ClassSession` | ClassSection meeting; ClassSessionStatus |
| `TeacherAttendance` | Unique sessionId; startedAt/endedAt |
| `StudentAttendance` | Unique (sessionId, studentId); PRESENT/LATE/ABSENT/EXCUSED |

Migration: `20260805030000_attendance_class_session` — see ADR-012.

### Phase 1I Notifications

| Model | Notes |
|-------|-------|
| `Notification` | type, title, message, priority, sourceType/sourceId, dedupeKey?, createdById? |
| `NotificationRecipient` | unique (notificationId, userId); readAt per user |

Migration: `20260805040000_notification_foundation` — see ADR-013.

### Phase 1J Elections

| Model | Notes |
|-------|-------|
| `Election` | status lifecycle + resultVisibility + eligibilityMode |
| `ElectionPosition` | unique (electionId, name); maxSelections=1 |
| `ElectionCandidate` | studentId FK; unique (positionId, studentId) |
| `ElectionVote` | unique (electionId, voterUserId, positionId) |
| `ElectionVoterEligibility` | SELECTED_STUDENTS |
| `ElectionAuditLog` | append-only |

Migration: `20260805050000_election_system` — see ADR-014. Stub VoteBallot/VoteTally removed.

---

## 3. Academic Hierarchy

`Faculty` → `Department` → `Course` → `ClassSection` → (`Enrollment`, `Assignment`)  
Also: `CourseTeacher`, attendance `ClassSession`

Future: explicit `Program` / academic year tables if needed (Phase 3) without breaking `Course`.

---

## 4. Assessment

| Entity | Relationship |
|--------|--------------|
| `Assignment` | Teacher + ClassSection; status DRAFT/PUBLISHED/ARCHIVED |
| `AssignmentMaterial` | Files for assignment (future upload) |
| `Submission` | Student + Assignment; file + GradeStatus workflow (1F-C) |
| `Quiz` / `QuizQuestion` / `QuizAttempt` | Timed assessments |

**Invariant:** Submissions after deadline must not be accepted (service rule).

---

## 5. Course Results Approval (Phase 1K)

`ResultEntry`: one row per `Enrollment` (`UNIQUE(enrollmentId)`); creditHours snapshotted.

`ResultEntry.status`: `DRAFT` → `CALCULATED` → `PENDING_APPROVAL` → `APPROVED` \| `RETURNED`  
(Legacy: `REJECTED`, `CORRECTION_REQUESTED` unused in 1K.)

Supporting: `AssessmentWeight` (per ClassSection), `GradeScale` / `GradeScaleBand` (optional; GPA off until active).

**Invariant:** Student course-result / transcript queries return **APPROVED only**. Assessment grades remain on `Submission`/`QuizAttempt` (`grades.*`). See ADR-015.

---

## 6. Attendance

| Entity | Purpose |
|--------|---------|
| `StudentAttendance` | PRESENT / ABSENT / LATE per session |
| `TeacherClassSession` | Check-in / check-out timestamps |

---

## 7. Elections (secret ballot)

| Entity | Public? | Purpose |
|--------|---------|---------|
| `Election` / `ElectionCandidate` | Yes (meta) | Admin/student UI |
| `VoteBallot` | **No** (audit: who voted) | One row per voter per election |
| `VoteTally` | Aggregates only | Charts / percentages |

**Invariant:** Atomic insert of ballot + tally increment; unique voter constraint.

---

## 8. Impact Analysis Template

Before changing entity `X`:

```
X → dependent models → APIs → frontend pages → seeds/tests
```

Document in PR / handoff. Update [database.md](../database.md) + this contract.
