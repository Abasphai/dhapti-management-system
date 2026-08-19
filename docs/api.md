# API Contracts & Endpoints — Dhapti UMS

**Authority:** API Architect Agent  
**Base URL (dev):** `http://localhost:4000/api`  
**Frontend (dev):** relative `/api` via Vite proxy  

---

## 1. Conventions

| Topic | Standard |
|-------|----------|
| Style | REST JSON |
| Auth | `Authorization: Bearer <jwt>` |
| Success | `200` / `201` + JSON body |
| Errors | `{ "error": "message", "code"?: string }` + 4xx/5xx |
| Dates | ISO-8601 strings |
| IDs | Prisma `cuid` strings |
| Pagination (Phase 1B) | `?page=1&pageSize=20` → `{ data, pagination: { page, pageSize, total, totalPages } }` |
| Search | `?q=` server-side contains on identity fields |
| Versioning (future) | `/api/v1/...` when mobile clients ship — **not** in Phase 1B |

---

## 2. Live Endpoints

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | `{ ok, service, db }` |

### Auth (Phase 1A)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | `{ email, password, expectedRole? }` → `{ token, user }` (+ `permissions`) |
| POST | `/auth/logout` | Yes | Stateless `{ ok: true }` |
| GET | `/auth/me` | Yes | Safe user (no passwordHash) |
| POST | `/auth/register-admin` | Dev flag | Requires `ALLOW_DEV_ADMIN_REGISTER=true` |

Errors: `{ error, code }` — see [contracts/auth-contract.md](./contracts/auth-contract.md).

### Students (Phase 1B — Admin management + student self profile)

| Method | Path | Permission / Role | Description |
|--------|------|-------------------|-------------|
| GET | `/students` | `students.read` (ADMIN) | Paginated list; query: `q`, `status`, `semester`, `faculty`, `page`, `pageSize` |
| GET | `/students/:id` | `students.read` | Single student |
| POST | `/students` | `students.create` | Create User + Student (transaction); optional `password` (default `DHAPTI@2026`) |
| PATCH | `/students/:id` | `students.update` | Update profile / codes / email (syncs User.email) |
| PATCH | `/students/:id/status` | `students.update` | Set User status `ACTIVE` \| `INACTIVE` \| `SUSPENDED` |
| DELETE | `/students/:id` | `students.delete` | **Soft deactivate** → User `INACTIVE` (no hard delete) |
| GET | `/students/me` | STUDENT | Own profile |
| PATCH | `/students/me` | STUDENT | Editable only: `phone`, `address`, `profilePhoto` |

**List response:**
```json
{
  "data": [ { "id", "studentCode", "name", "email", "phone", "faculty", "semester", "status", "accountStatus", ... } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

**Create notes:** Password is hashed with bcrypt; never returned. Duplicate email / `studentCode` → `409 CONFLICT`. Role is always `STUDENT` (not client-assignable).

### Teachers (Phase 1B — Admin management)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/teachers` | `teachers.read` | Paginated list; query: `q`, `status`, `department`, `departmentId`, `page`, `pageSize` |
| GET | `/teachers/:id` | `teachers.read` | Single teacher |
| POST | `/teachers` | `teachers.create` | Create User + Teacher (transaction); optional `password` |
| PATCH | `/teachers/:id` | `teachers.update` | Update profile / codes / email / `departmentId` |
| PATCH | `/teachers/:id/status` | `teachers.update` | Set User status |
| DELETE | `/teachers/:id` | `teachers.delete` | **Soft deactivate** → User `INACTIVE` |

**Search fields:** `facultyCode` (staff ID), name, email, phone, designation, department name.

### Teacher ↔ Course Assignment (Phase 1D-A)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/teachers/me/courses` | TEACHER role | Own assigned courses (JWT identity) |
| GET | `/teachers/:id/courses` | `teacher_courses.read` | Admin list assignments |
| POST | `/teachers/:id/courses` | `teacher_courses.assign` | Body `{ courseId }` — ACTIVE only; duplicate → 409 |
| DELETE | `/teachers/:id/courses/:courseId` | `teacher_courses.remove` | Remove relationship only |
| GET | `/courses/:id/teachers` | `teacher_courses.read` | Teachers assigned to a course |

Join model: `CourseTeacher`. Cross-department teaching allowed (ADR-005).

### Classes / Sections (Phase 1D-B)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/classes` | `classes.read` | Paginated list; filters: `q`, `status`, `courseId`, `teacherId`, `departmentId`, `facultyId`, `academicYear`, `semester` |
| GET | `/classes/:id` | `classes.read` | Single class |
| POST | `/classes` | `classes.create` | Requires CourseTeacher link; ACTIVE course + teacher |
| PATCH | `/classes/:id` | `classes.update` | Edit; teacher/course changes re-validated |
| PATCH | `/classes/:id/status` | `classes.update` | Status |
| DELETE | `/classes/:id` | `classes.delete` | Soft deactivate |
| GET | `/teachers/me/classes` | TEACHER | Own ACTIVE classes only |

Duplicate section/year/semester for a course → `409`. Unassigned teacher → `400`.

### Enrollments (Phase 1E-A)

Student → Enrollment → ClassSection (not direct Student→Course).

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/enrollments` | `enrollments.read` | Admin list; filters: `q`, `status`, `studentId`, `classSectionId`, `courseId`, `teacherId`, `departmentId`, `facultyId`, `academicYear`, `semester` + pagination |
| GET | `/enrollments/:id` | `enrollments.read` | Single enrollment |
| POST | `/enrollments` | `enrollments.create` | `{ studentId, classSectionId }` — ACTIVE student/class/course; duplicate ACTIVE → `409`; DROPPED may reactivate → `200` |
| PATCH | `/enrollments/:id/status` | `enrollments.update` | `ACTIVE` \| `COMPLETED` \| `DROPPED` (reactivate re-validates ACTIVE actors) |
| DELETE | `/enrollments/:id` | `enrollments.delete` | Soft drop → `DROPPED` (history retained) |
| GET | `/enrollments/me` | STUDENT | Own enrollments (JWT → Student) |
| GET | `/students/me/enrollments` | STUDENT | Alias of self-list (preferred) |
| GET | `/classes/:id/students` | Admin `enrollments.read` **or** owning TEACHER | Class roster + `attendancePercent` (1H policy) |

Search `q`: student code/name, course code/title, section. See ADR-007.

Admin UI: `/admin/enrollments` (Phase 1E-B). Student UI: `/student/courses` via `GET /students/me/enrollments`.

### Assignments (Phase 1F-A)

Assignment → ClassSection (not Course). No submissions/uploads in this phase.

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/assignments/me` | TEACHER | Own assignments; `q`, `status`, `classSectionId`, `courseId`, pagination |
| POST | `/assignments` | TEACHER | Create for own ClassSection; JWT teacher; default `DRAFT` |
| GET | `/assignments/:id` | Teacher owner / enrolled student (PUBLISHED) / Admin | Detail |
| PATCH | `/assignments/:id` | TEACHER owner | Edit title/description/instructions/dueAt/maxMarks/status |
| PATCH | `/assignments/:id/status` | TEACHER owner | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| DELETE | `/assignments/:id` | TEACHER owner | Soft archive → `ARCHIVED` |
| GET | `/assignments` | `assignments.read` | Admin global list |
| GET | `/students/me/assignments` | STUDENT | PUBLISHED only for ACTIVE enrollments |

Teacher UI: `/teacher/assignments`. Student UI: `/student/assignments`. See ADR-008.

### Assignment Submissions (Phase 1F-B)

Multipart field name: `file`. Private storage — downloads are authenticated streams.

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| POST | `/assignments/:id/submission` | STUDENT | Create/replace own submission (before `dueAt`) |
| GET | `/assignments/:id/submission` | STUDENT | Own submission + `submissionOpen` |
| GET | `/assignments/:id/submissions` | TEACHER owner | Enrolled students + Submitted/Missing/Late; `q`, `status`, pagination |
| GET | `/submissions/:id/file` | Student owner / Teacher owner / Admin | Download file stream |

Rules: PUBLISHED only; ACTIVE enrollment; server deadline; max `min(maxFileMb, 500)` MB. See ADR-009.

### Grading & Results (Phase 1F-C)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/assignments/:id/grades` | TEACHER + `grades.read` | Enrolled students + grade state; ownership |
| PATCH | `/submissions/:id/grade` | TEACHER + `grades.update` | Save score/feedback → `GRADED` |
| POST | `/assignments/:id/grades/bulk` | TEACHER + `grades.update` | Bulk save (validated per row) |
| POST | `/submissions/:id/grade/submit` | TEACHER + `grades.submit` | `GRADED` → `PENDING_APPROVAL` |
| GET | `/grades` | `grades.read` (ADMIN) | Review list; `q`, `status`, faculty/dept/course/year/semester/teacher filters + pagination |
| GET | `/grades/:id` | `grades.read` | Grade detail |
| POST | `/grades/:id/approve` | `grades.approve` | `PENDING_APPROVAL` → `APPROVED` |
| POST | `/grades/:id/return` | `grades.return` | `PENDING_APPROVAL` → `RETURNED` (+ optional `reason`) |
| GET | `/students/me/results` | STUDENT + `results.read` | Own **APPROVED assessment** results only (assignments/quizzes) |

Percentage is computed server-side. Students never receive unapproved scores. See ADR-010.

### Course finals / GPA / Transcript (Phase 1K)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/students/me/course-results` | STUDENT + `results.read` | Own **APPROVED** ClassSection finals |
| GET | `/students/me/gpa` | STUDENT + `results.read` | GPA summary; `NOT_CONFIGURED` without active grade scale |
| GET | `/students/me/transcript` | STUDENT + `results.read` | Year → Semester → courses (PDF deferred) |
| GET/PUT | `/classes/:id/assessment-weights` | `results.read` / `results.update` | Per-ClassSection weights (must sum to 100) |
| GET | `/teachers/me/results` | TEACHER + `results.read` | Own ClassSection course results |
| GET | `/results` | `results.read` | Admin (or teacher-scoped) list + filters |
| GET | `/results/:id` | `results.read` | Detail; student only if APPROVED + own |
| POST | `/results/calculate` | `results.create` | Calculate one enrollment (server-side) |
| POST | `/results/bulk` | `results.create` | Calculate all ACTIVE enrollments in a class |
| POST | `/results/:id/submit` | `results.submit` | CALCULATED/RETURNED → PENDING_APPROVAL |
| POST | `/results/:id/approve` | `results.approve` | Admin approve (immutable after) |
| POST | `/results/:id/return` | `results.return` | Admin return with reason |

See ADR-015. Does **not** replace `/students/me/results`. No invented letter/GPA policy.

### Quizzes (Phase 1G)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/quizzes/me` | TEACHER | Own quizzes; `q`, `status`, `classSectionId`, pagination |
| POST | `/quizzes` | TEACHER | Create DRAFT for own ClassSection |
| GET | `/quizzes/:id` | Teacher/Admin (keys) · Enrolled student (no keys) | Detail |
| PATCH | `/quizzes/:id` | TEACHER owner | Edit (questions only when DRAFT) |
| DELETE | `/quizzes/:id` | TEACHER owner | Delete DRAFT |
| PATCH | `/quizzes/:id/status` | TEACHER owner | DRAFT→PUBLISHED→CLOSED→ARCHIVED (CLOSED→DRAFT for edits) |
| POST/PATCH/DELETE | `/quizzes/:id/questions[/:questionId]` | TEACHER | DRAFT only; recalculates `totalMarks` |
| GET | `/students/me/quizzes` | STUDENT | PUBLISHED + enrolled + available |
| POST | `/quizzes/:id/attempts` | STUDENT | Start attempt (transaction) |
| GET | `/attempts/:id` | Owner / teacher / admin | Attempt; student score only if APPROVED |
| PATCH | `/attempts/:id/answers` | STUDENT owner | Upsert answers while IN_PROGRESS |
| POST | `/attempts/:id/submit` | STUDENT owner | Auto-grade → PENDING_APPROVAL |
| GET | `/quizzes` | ADMIN | Global quiz list |
| GET | `/quiz-attempts` | `grades.read` | Admin oversight |
| POST | `/quiz-attempts/:id/approve` | `grades.approve` | Approve |
| POST | `/quiz-attempts/:id/return` | `grades.return` | Return |

See ADR-011. No auto-approve; merges into `/students/me/results` when APPROVED.

### Attendance (Phase 1H)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/teachers/me/sessions` | TEACHER | Own classes + session for `date` (UTC YYYY-MM-DD) |
| POST | `/classes/:id/sessions` | TEACHER | Create SCHEDULED session |
| POST | `/classes/:id/sessions/ensure` | TEACHER | Idempotent get-or-create |
| GET | `/sessions/:id` | Owner / Admin / enrolled student | Session detail |
| POST | `/sessions/:id/start` | TEACHER | Server `actualStartTime`; OPEN |
| POST | `/sessions/:id/end` | TEACHER | COMPLETED; locks student marks |
| GET | `/sessions/:id/attendance` | TEACHER | Roster + UNMARKED/PRESENT/… |
| POST | `/sessions/:id/attendance/bulk` | TEACHER | All-or-nothing upsert (OPEN only) |
| GET | `/students/me/attendance` | STUDENT | Per-class summaries + % |
| GET | `/students/me/attendance/:classSectionId` | STUDENT | Session details |
| GET | `/attendance/sessions` | `attendance.read` | Admin sessions |
| GET | `/attendance/teachers` | `attendance.read` | Admin teacher overview |
| GET | `/attendance/students` | `attendance.read` | Admin student summaries |

See ADR-012.

### Notifications (Phase 1I + Phase 7)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | JWT | Own inbox; `unread`, `type`, pagination |
| GET | `/notifications/unread-count` | JWT | `{ count }` for caller only |
| GET | `/notifications/:id` | JWT | Own recipient item |
| PATCH | `/notifications/:id/read` | JWT | Mark own recipient read |
| POST | `/notifications/read-all` | JWT | `{ updated }` own unread → read |
| POST | `/notifications` | `notifications.create` | Admin create; audience + optional `userIds` |
| GET | `/notifications/sent` | `notifications.create` | Admin sent list; `q`, `type`, `priority`, pagination |

Audience: `STUDENTS` \| `TEACHERS` \| `ADMINS` \| `STUDENTS_TEACHERS` \| `EVERYONE` \| `USERS`.  
Auto-triggers: assignment publish → enrolled students; new question → course teachers; question reply → asker; course result approve → enrolled; certificate issue → student.  
See ADR-013. Inbox identity always from JWT.

### Course Q&A (Phase 7)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/questions` | STUDENT | Ask on enrolled course (`courseId`, `body`); notifies assigned teachers |
| GET | `/questions/me` | STUDENT | Own questions + replies |
| GET | `/questions/teacher` | TEACHER/ADMIN | Courses taught; `?status=answered\|unanswered\|all` |
| GET | `/questions/course/:courseId` | JWT | Thread for one course (enrolled / teacher / admin) |
| POST | `/questions/:id/reply` | TEACHER/ADMIN | Reply; notifies student + writes audit |

### Admin Audit Logs (Phase 7)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/audit-logs` | ADMIN + `settings.read` | Paginated `AuditLog`; `module`, `q` (user name), page/pageSize |

### Finance & Fees (Phase 1L)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/payments/me` | STUDENT + `payments.read` | Own ledger + summary (`totalPaid`, `currentDue`, `totalDue`) |
| POST | `/payments/pay` | STUDENT + `payments.pay` | Settle own PENDING/OVERDUE charge → `PAID` + receipt |
| GET | `/admin/finance/summary` | ADMIN + `finance.read` | Revenue, outstanding dues, monthly collections |
| GET | `/admin/finance/transactions` | ADMIN + `finance.read` | Paginated list; `q`, `status` filters |
| POST | `/admin/finance/record-payment` | ADMIN + `finance.manage` | Manual cash/bank PAID or create PENDING charge |

`Payment` statuses: `PAID` \| `PENDING` \| `OVERDUE` (derived when `dueDate` passes). Receipt numbers generated server-side. JWT identity only for student pay.

### System Settings & Live Dashboards (Phase 1N)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/settings/public` | Public | `isAdmissionsOpen`, academic year/semester, `maintenanceMode` |
| GET | `/admin/settings` | ADMIN + `settings.read` | Full settings document |
| PATCH | `/admin/settings` | ADMIN + `settings.manage` | Partial update (booleans/strings) |
| GET | `/admin/dashboard/stats` | ADMIN + `dashboard.read` | Students, faculty, revenue, programs, recent registrations, 5-day finance |
| GET | `/teacher/dashboard/stats` | TEACHER + `dashboard.read` | Active courses, students, pending grading, today's classes |
| GET | `/student/dashboard/stats` | STUDENT + `dashboard.read` | Enrolled courses, attendance %, GPA label, fee dues, finance, schedule |

When `isAdmissionsOpen` is `false`, `POST /admissions/apply` returns **403**.

### Online Admissions (Phase 1M)

| Method | Path | Authz | Description |
|--------|------|-------|-------------|
| GET | `/admissions/options` | Public | ACTIVE faculties + programs (courses) for Apply form |
| POST | `/admissions/apply` | Public | Submit application (`PENDING`); returns `trackingId` |
| GET | `/admin/admissions` | ADMIN + `admissions.read` | Queue; filters `status`, `facultyId`, `search`/`q` |
| GET | `/admin/admissions/:id` | ADMIN + `admissions.read` | Applicant detail |
| POST | `/admin/admissions/:id/approve` | ADMIN + `admissions.manage` | Atomic: User(STUDENT) + Student + PENDING Semester 1 tuition + `APPROVED` |
| POST | `/admin/admissions/:id/reject` | ADMIN + `admissions.manage` | Body `{ reason }` → `REJECTED` |
| POST | `/admin/admissions/:id/interview` | ADMIN + `admissions.manage` | Mark `INTERVIEW_SCHEDULED` |

Statuses: `PENDING` \| `UNDER_REVIEW` \| `INTERVIEW_SCHEDULED` \| `APPROVED` \| `REJECTED`.  
Approve default password `DHAPTI@2026`; tuition amount `ADMISSION_TUITION_AMOUNT` (default 1200 — system placeholder, not Dhapti fee policy).

### Elections (Phase 1J)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/elections` | JWT | Admin all / Student non-DRAFT; Teachers 403 |
| POST | `/elections` | `elections.manage` | Create DRAFT |
| GET | `/elections/:id` | JWT | Detail |
| PATCH | `/elections/:id` | `elections.manage` | Edit while DRAFT/PUBLISHED |
| POST | `/elections/:id/publish\|open\|close\|finalize\|archive` | manage | Lifecycle |
| POST | `/elections/:id/positions` | manage | Add position (pre-OPEN) |
| PATCH/DELETE | `/elections/positions/:id` | manage | Edit/remove (pre-OPEN) |
| POST | `/elections/positions/:id/candidates` | manage | Add ACTIVE student candidate |
| PATCH/DELETE | `/elections/candidates/:id` | manage | Edit/remove (pre-OPEN) |
| PUT | `/elections/:id/eligibility` | manage | SELECTED_STUDENTS userIds |
| GET | `/elections/:id/ballot` | STUDENT | Ballot + eligibility |
| GET | `/elections/:id/my-status` | STUDENT | hasVoted / canVote |
| POST | `/elections/:id/vote` | `elections.vote` | Complete ballot; 409 `ALREADY_VOTED` |
| GET | `/elections/:id/results` | JWT | Visibility-gated aggregates |
| GET | `/elections/:id/statistics` | manage | Admin aggregates |
| GET | `/elections/:id/audit` | `elections.audit.read` | Append-only audit |

See ADR-014. Never trust client `studentId`/`voterUserId` on vote.

### Analytics (Admin Intelligence)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/analytics/overview` | ADMIN + `dashboard.read` | KPIs, revenue trend, department breakdown, grade distribution, at-risk cohort; query `facultyId`, `departmentId`, `academicYear` |

### CMS (Phases 1–6)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/public/cms/settings` | No | Published website settings |
| GET | `/public/cms/nav` | No | Visible nav (`?location=HEADER\|FOOTER`) |
| GET | `/public/cms/pages/:slug` | No | Published page + blocks; `?lang=en\|so\|ar` (fallback EN) |
| GET | `/public/cms/news` | No | Published news; `?lang=` |
| GET | `/public/cms/news/:slug` | No | Single news; `?lang=` |
| GET | `/public/cms/events` | No | Published events; `?lang=` |
| GET | `/public/cms/media/:id/file` | No | Inline media stream |
| GET | `/public/cms/media/:id/download` | No | Attachment + increments `downloadCount` |
| GET | `/public/cms/faculties` | No | Published faculty marketing |
| GET | `/public/cms/programs` | No | Published program marketing (`?facultyKey=`) |
| GET/PATCH | `/admin/cms/settings` | `cms.settings.*` | Website settings |
| GET/POST/PATCH/DELETE | `/admin/cms/pages` | `cms.pages.*` | Pages CRUD; `?scope=custom` excludes home/about |
| PUT | `/admin/cms/pages/:id/blocks` | manage | Atomic block replace (Zod by blockType) |
| POST | `/admin/cms/pages/:id/publish\|unpublish\|archive` | `cms.publish` | Lifecycle |
| GET | `/admin/cms/block-types` | read | Known + `customPageBlockTypes` |
| CRUD | `/admin/cms/news` \| `/events` \| `/nav` \| `/media` \| `/faculties` \| `/programs` | matching `cms.*` | Content managers |

**Custom page blocks (Phase 6):** `RICH_TEXT_BLOCK`, `FAQ_ACCORDION_BLOCK`, `DOWNLOADS_BLOCK`, `CALLOUT_BANNER_BLOCK`. Public UI: `/pages/:slug`. Admin UI: `/admin/cms/custom-pages`.

### Faculties / Departments / Courses (Phase 1C)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/faculties` | `faculties.read` | `q`, `status`, `page`, `pageSize` |
| GET | `/faculties/:id` | `faculties.read` | Single faculty |
| POST | `/faculties` | `faculties.create` | Create faculty |
| PATCH | `/faculties/:id` | `faculties.update` | Update |
| PATCH | `/faculties/:id/status` | `faculties.update` | `ACTIVE` \| `INACTIVE` \| `SUSPENDED` |
| DELETE | `/faculties/:id` | `faculties.delete` | Soft deactivate |
| GET | `/departments` | `departments.read` | `q`, `status`, `facultyId`, pagination |
| GET | `/departments/:id` | `departments.read` | Single department |
| POST | `/departments` | `departments.create` | Requires valid `facultyId` |
| PATCH | `/departments/:id` | `departments.update` | Update |
| PATCH | `/departments/:id/status` | `departments.update` | Status |
| DELETE | `/departments/:id` | `departments.delete` | Soft deactivate |
| GET | `/courses` | `courses.read` | `q`, `status`, `departmentId`, `facultyId`, pagination |
| GET | `/courses/:id` | `courses.read` | Single course |
| POST | `/courses` | `courses.create` | Requires valid `departmentId`; sets `facultyId` from department |
| PATCH | `/courses/:id` | `courses.update` | Update |
| PATCH | `/courses/:id/status` | `courses.update` | Status |
| DELETE | `/courses/:id` | `courses.delete` | Soft deactivate |

List responses use the Phase 1B pagination envelope. Duplicate codes → `409`.

---

## 3. Planned Endpoint Families (later phases — not Phase 1F-A)

| Family | Prefix | Owner agent |
|--------|--------|-------------|
| ~~Faculties / Departments / Courses~~ | **Live in Phase 1C** | — |
| ~~Classes / Sections~~ | **Live in Phase 1D-B** | — |
| ~~Enrollments~~ | **Live in Phase 1E-A** | — |
| ~~Assignment Core~~ | **Live in Phase 1F-A** | — |
| ~~Assignment Submissions / Files~~ | **Live in Phase 1F-B** | — |
| ~~Assignment Grading / Student Results~~ | **Live in Phase 1F-C** | — |
| ~~Quizzes / Online Assessments~~ | **Live in Phase 1G** | — |
| ~~Attendance~~ | **Live in Phase 1H** | — |
| ~~Course-level ResultEntry / GPA / Transcript~~ | **Live in Phase 1K** | — |
| ~~Elections / Vote~~ | **Live in Phase 1J** | — |
| ~~Finance & Fees~~ | **Live in Phase 1L** | — |
| (Q&A + audit logs shipped in Phase 7 — see above) | — | — |
| Files | `/api/files` | File & Storage |
| Admissions | `/api/admissions` | Backend + Academic |

---

## 4. Domain Response Rules (must implement)

1. **Results:** Student list endpoints return only `status === APPROVED`.
2. **Elections:** Public stats from `VoteTally` only; never expose ballot→candidate mapping.
3. **Assignments:** Reject upload if `size > 500MB` or `now > deadline`.
4. **Votes:** `POST /elections/:id/vote` must be transactional; second vote → `409`.
5. **Exam clearance:** Admit card requires attendance ≥ 75% and zero overdue/pending tuition unless Controllers override.

### Exam Control / Admit Card (Step 1)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/student/admit-card` | Student | Clearance + timetable + printable admit payload |
| GET | `/admin/exams` | ADMIN / EXAM_ADMIN | Sessions + overview stats |
| POST | `/admin/exams/schedule` | ADMIN / EXAM_ADMIN | Create session (optional) + schedule row |
| PATCH | `/admin/exams/schedule/:id` | ADMIN / EXAM_ADMIN | Edit schedule |
| GET | `/admin/exams/clearance-roster` | ADMIN / EXAM_ADMIN | Live CLEARED/HELD matrix |
| PATCH | `/admin/exams/clearance/:id/override` | ADMIN / EXAM_ADMIN | Manual Controllers override |
| GET | `/admin/exams/results/pending` | ADMIN / EXAM_ADMIN | Pending results verify list |
| POST | `/admin/exams/results/publish` | ADMIN / EXAM_ADMIN | Publish pending → official transcripts |

See [ADR-016](adr/ADR-016-EXAM-CONTROL-ADMIT-CARD.md).

---

## 5. Error Code Guide

| Status | Use |
|--------|-----|
| 400 | Validation / Zod failure |
| 401 | Missing/invalid token or credentials |
| 403 | Wrong role / missing permission |
| 404 | Resource missing |
| 409 | Conflict (duplicate email, student/staff code) |
| 413 | File too large |
| 500 | Unexpected server error |

Do not expose raw Prisma/SQL errors to clients.

---

## 6. Mobile Readiness

Keep payloads flat, paginated, and versioned. Avoid HTML in API responses. Prefer stable field names over UI-specific naming.
