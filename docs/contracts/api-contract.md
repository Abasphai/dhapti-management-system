# API Contract — Dhapti UMS

**Owner:** API Architect  
**Base (dev):** `http://localhost:4000/api` · Frontend uses `/api` via Vite proxy  
**Detail catalog:** [../api.md](../api.md)

---

## 1. Global Conventions

| Item | Contract |
|------|----------|
| Format | JSON UTF-8 |
| Auth header | `Authorization: Bearer <jwt>` |
| Error body | `{ "error": string }` (+ optional `details` for validation) |
| Success list (Phase 1B) | `{ "data": T[], "pagination": { "page", "pageSize", "total", "totalPages" } }` |
| Success item | Resource object (serialized; never includes `passwordHash`) |
| Dates | ISO-8601 |
| IDs | string cuid |

### Versioning decision (Phase 0)

**Current:** unversioned `/api/...` (already live).  
**Future breaking changes:** introduce `/api/v1/...` via **ADR-004**. Do not break existing clients silently.

---

## 2. Live Endpoints (must not diverge)

### Auth (Phase 1A)
| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/auth/login` | No | `{ email, password, expectedRole? }` | `{ token, user }` (user includes `permissions[]`) |
| POST | `/auth/logout` | Yes | — | `{ ok: true }` |
| GET | `/auth/me` | Yes | — | safe `user` (no passwordHash) |
| POST | `/auth/register-admin` | Dev flag | `{ email, password, fullName }` | `{ id, email, role }` or 404 |

Error body: `{ error: string, code?: string }` — see [auth-contract.md](./auth-contract.md).

### Health
| GET | `/health` | No | — | `{ ok, service, db }` |

### Students / Teachers (Phase 1B)
See [../api.md](../api.md).

| Method | Path | Authz |
|--------|------|-------|
| GET | `/students` | `students.read` — `q`, `status`, `semester`, `faculty`, `page`, `pageSize` |
| GET | `/students/:id` | `students.read` |
| POST | `/students` | `students.create` — transaction User+Student |
| PATCH | `/students/:id` | `students.update` |
| PATCH | `/students/:id/status` | `students.update` |
| DELETE | `/students/:id` | `students.delete` — soft deactivate |
| GET/PATCH | `/students/me` | STUDENT — PATCH limited to phone/address/profilePhoto |
| GET | `/teachers` | `teachers.read` — `q`, `status`, `department`, `page`, `pageSize` |
| GET | `/teachers/:id` | `teachers.read` |
| POST | `/teachers` | `teachers.create` — transaction User+Teacher |
| PATCH | `/teachers/:id` | `teachers.update` |
| PATCH | `/teachers/:id/status` | `teachers.update` |
| DELETE | `/teachers/:id` | `teachers.delete` — soft deactivate |

### Academic structure (Phase 1C)
| Method | Path | Authz |
|--------|------|-------|
| GET/POST | `/faculties` | `faculties.read` / `faculties.create` |
| GET/PATCH/DELETE | `/faculties/:id` | read / update / delete (soft) |
| PATCH | `/faculties/:id/status` | `faculties.update` |
| GET/POST | `/departments` | `departments.read` / `departments.create` — `facultyId` required on create |
| GET/PATCH/DELETE | `/departments/:id` | read / update / delete (soft) |
| PATCH | `/departments/:id/status` | `departments.update` |
| GET/POST | `/courses` | `courses.read` / `courses.create` — `departmentId` required on create |
| GET/PATCH/DELETE | `/courses/:id` | read / update / delete (soft) |
| PATCH | `/courses/:id/status` | `courses.update` |

Query: `q`, `status`, `facultyId`, `departmentId`, `page`, `pageSize` as applicable.

### Teacher ↔ Course (Phase 1D-A)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/teachers/me/courses` | TEACHER (self only) |
| GET | `/teachers/:id/courses` | `teacher_courses.read` |
| POST | `/teachers/:id/courses` | `teacher_courses.assign` — `{ courseId }` |
| DELETE | `/teachers/:id/courses/:courseId` | `teacher_courses.remove` |
| GET | `/courses/:id/teachers` | `teacher_courses.read` |

Duplicate assignment → `409 CONFLICT`. Inactive teacher/course → `400`.

### Classes (Phase 1D-B)
| Method | Path | Authz |
|--------|------|-------|
| GET/POST | `/classes` | `classes.read` / `classes.create` |
| GET/PATCH/DELETE | `/classes/:id` | read / update / soft-delete |
| PATCH | `/classes/:id/status` | `classes.update` |
| GET | `/teachers/me/classes` | TEACHER self |

Teacher on create/update must exist in `CourseTeacher` for the course.

### Enrollments (Phase 1E-A)
| Method | Path | Authz |
|--------|------|-------|
| GET/POST | `/enrollments` | `enrollments.read` / `enrollments.create` |
| GET | `/enrollments/:id` | `enrollments.read` |
| PATCH | `/enrollments/:id/status` | `enrollments.update` |
| DELETE | `/enrollments/:id` | `enrollments.delete` — soft → `DROPPED` |
| GET | `/enrollments/me` | STUDENT self |
| GET | `/students/me/enrollments` | STUDENT self (preferred) |
| GET | `/classes/:id/students` | `enrollments.read` |

Body create: `{ studentId, classSectionId }`. Unique Student+ClassSection. See ADR-007.

### Assignments (Phase 1F-A)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/assignments/me` | TEACHER self |
| POST/PATCH/DELETE | `/assignments` / `/:id` | TEACHER owner |
| PATCH | `/assignments/:id/status` | TEACHER owner |
| GET | `/assignments` | `assignments.read` (Admin) |
| GET | `/assignments/:id` | Owner / enrolled student (PUBLISHED) / Admin |
| GET | `/students/me/assignments` | STUDENT self |

Body create: `{ classSectionId, title, dueAt, maxMarks?, description?, instructions?, status? }`. See ADR-008.

### Submissions (Phase 1F-B)
| Method | Path | Authz |
|--------|------|-------|
| POST | `/assignments/:id/submission` | STUDENT (multipart `file`) |
| GET | `/assignments/:id/submission` | STUDENT self |
| GET | `/assignments/:id/submissions` | TEACHER owner |
| GET | `/submissions/:id/file` | Student owner / Teacher owner / Admin |

See ADR-009. Deadline and enrollment enforced server-side.

### Grades / Results (Phase 1F-C)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/assignments/:id/grades` | TEACHER + `grades.read` |
| PATCH | `/submissions/:id/grade` | TEACHER + `grades.update` |
| POST | `/assignments/:id/grades/bulk` | TEACHER + `grades.update` |
| POST | `/submissions/:id/grade/submit` | TEACHER + `grades.submit` |
| GET | `/grades` | `grades.read` (Admin) |
| GET | `/grades/:id` | `grades.read` |
| POST | `/grades/:id/approve` | `grades.approve` |
| POST | `/grades/:id/return` | `grades.return` |
| GET | `/students/me/results` | STUDENT + `results.read` (APPROVED only) |

See ADR-010. Percentage server-computed; APPROVED immutable.

### Quizzes (Phase 1G)
| Method | Path | Authz |
|--------|------|-------|
| GET/POST | `/quizzes/me`, `/quizzes` | TEACHER |
| GET/PATCH/DELETE | `/quizzes/:id` | Owner / rules |
| PATCH | `/quizzes/:id/status` | TEACHER owner |
| CRUD | `/quizzes/:id/questions…` | TEACHER DRAFT |
| GET | `/students/me/quizzes` | STUDENT |
| POST | `/quizzes/:id/attempts` | STUDENT |
| GET/PATCH/POST | `/attempts/:id`, `…/answers`, `…/submit` | Owner |
| GET/POST | `/quiz-attempts…` | Admin grades.* |

See ADR-011. No answer keys in student taking payloads. Submit → PENDING_APPROVAL.

### Attendance (Phase 1H)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/teachers/me/sessions` | TEACHER |
| POST | `/classes/:id/sessions`, `…/ensure` | TEACHER owner |
| POST | `/sessions/:id/start`, `/end` | TEACHER owner |
| GET/POST | `/sessions/:id/attendance`, `…/bulk` | TEACHER owner |
| GET | `/students/me/attendance[/:classSectionId]` | STUDENT |
| GET | `/attendance/sessions|teachers|students` | `attendance.read` |

See ADR-012. Server timestamps; COMPLETED locks marks.

### Notifications (Phase 1I)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/notifications` | JWT (own inbox) |
| GET | `/notifications/unread-count` | JWT |
| GET | `/notifications/:id` | JWT own recipient |
| PATCH | `/notifications/:id/read` | JWT own recipient |
| POST | `/notifications/read-all` | JWT |
| POST | `/notifications` | `notifications.create` |
| GET | `/notifications/sent` | `notifications.create` |

See ADR-013. Audience targeting + `dedupeKey` for auto-events.

### Elections (Phase 1J)
| Method | Path | Authz |
|--------|------|-------|
| GET/POST | `/elections` | Admin manage / Student read list |
| POST | `/elections/:id/publish\|open\|close\|finalize\|archive` | `elections.manage` |
| POST | `/elections/:id/vote` | `elections.vote` (JWT identity) |
| GET | `/elections/:id/results\|statistics\|audit\|ballot` | role/visibility gated |

See ADR-014. Duplicate vote → `409 ALREADY_VOTED`.

### Course finals / GPA / Transcript (Phase 1K)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/students/me/course-results` | STUDENT + `results.read` |
| GET | `/students/me/gpa` | STUDENT + `results.read` |
| GET | `/students/me/transcript` | STUDENT + `results.read` |
| GET/PUT | `/classes/:id/assessment-weights` | `results.read` / `results.update` |
| GET | `/teachers/me/results` | TEACHER + `results.read` |
| GET | `/results`, `/results/:id` | `results.read` |
| POST | `/results/calculate`, `/results/bulk` | `results.create` |
| POST | `/results/:id/submit` | `results.submit` |
| POST | `/results/:id/approve` | `results.approve` |
| POST | `/results/:id/return` | `results.return` |

See ADR-015. Assessment `/students/me/results` unchanged. GPA may return `NOT_CONFIGURED`.

### Finance & Fees (Phase 1L)
| Method | Path | Authz |
|--------|------|-------|
| GET | `/payments/me` | STUDENT + `payments.read` |
| POST | `/payments/pay` | STUDENT + `payments.pay` |
| GET | `/admin/finance/summary` | ADMIN + `finance.read` |
| GET | `/admin/finance/transactions` | ADMIN + `finance.read` |
| POST | `/admin/finance/record-payment` | ADMIN + `finance.manage` |
| GET | `/settings/public` | Public |
| GET | `/admin/settings` | ADMIN + `settings.read` |
| PATCH | `/admin/settings` | ADMIN + `settings.manage` |
| GET | `/admin/dashboard/stats` | ADMIN + `dashboard.read` |
| GET | `/teacher/dashboard/stats` | TEACHER + `dashboard.read` |
| GET | `/student/dashboard/stats` | STUDENT + `dashboard.read` |
| GET | `/admissions/options` | Public |
| POST | `/admissions/apply` | Public |
| GET | `/admin/admissions` | ADMIN + `admissions.read` |
| GET | `/admin/admissions/:id` | ADMIN + `admissions.read` |
| POST | `/admin/admissions/:id/approve` | ADMIN + `admissions.manage` |
| POST | `/admin/admissions/:id/reject` | ADMIN + `admissions.manage` |
| POST | `/admin/admissions/:id/interview` | ADMIN + `admissions.manage` |

---

## 3. Standard Error Codes

`400` validation · `401` unauthenticated · `403` forbidden · `404` not found · `409` conflict · `413` payload too large · `500` internal

---

## 4. Planned Families (do not invent alternate paths)

| Module | Prefix |
|--------|--------|
| Academics (live) | `/faculties`, `/departments`, `/courses`, `/classes`, `/enrollments` |
| Assignments (core live) | `/assignments` |
| Submissions / files | `/submissions`, `/files` — Phase 1F-B |
| Grades / assessment results | `/grades`, `/submissions/:id/grade`, `/students/me/results` — Phase 1F-C |
| Quizzes | `/quizzes` |
| Course ResultEntry / GPA / Transcript | `/results`, `/students/me/course-results\|gpa\|transcript` — Phase 1K |
| Attendance | `/attendance` |
| Notifications (live) | `/notifications` — Phase 1I |
| Elections (live) | `/elections` — Phase 1J |
| Files | `/files` |

---

## 5. Change Rules

1. Update this contract **before** or **with** backend implementation.  
2. Frontend Integration consumes only documented fields.  
3. Breaking changes require ADR + consumer impact note.
