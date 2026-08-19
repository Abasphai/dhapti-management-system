# Permissions & Authorization — Dhapti UMS

**Owner:** Authentication & Security Engineer  
**Implementation:** `backend/src/lib/permissions.ts` + `requirePermission` / `requireRoles`

---

## 1. Principle

Frontend route guards are UX only. Every protected API uses `requireAuth` plus `requireRoles` and/or `requirePermission`.

---

## 2. Roles (live)

`ADMIN` · `TEACHER` · `STUDENT` · `DEPARTMENT_ADMIN` · `EXAM_ADMIN` · `CERTIFICATE_ADMIN`

`DEPARTMENT_ADMIN` is authorized as **ROLE + PERMISSION + DATA SCOPE** (`UserDepartmentScope.departmentId`). Backend `assertDepartmentScope` / `resolveDepartmentFilter` enforce department isolation on students, teachers, courses, classes, and certificates. Finance, global settings, user management, and CMS remain ADMIN-only.

`EXAM_ADMIN` is authorized for Exam Control only: `exams.read`, `exams.manage`, `admitcards.generate`, `results.verify`, `results.publish` (+ limited academic read / results approve for the publish gate). Finance, global settings, and CMS return **403**. See [ADR-016](adr/ADR-016-EXAM-CONTROL-ADMIT-CARD.md).

`CERTIFICATE_ADMIN` may issue/revoke/list certificates (`certificates.read`, `certificates.manage`) plus limited student/notification read. Finance, global settings, and CMS return **403**. Admin portal login (`expectedRole: ADMIN`) accepts all specialized admin roles.

**Faculty QR Attendance (Phase A):** `attendance.locations.manage` (ADMIN). Location list is `attendance.read` with department scope for `DEPARTMENT_ADMIN`. See [ADR-017](adr/ADR-017-FACULTY-QR-ATTENDANCE.md).

Future roles (not implemented): REGISTRAR, FINANCE_OFFICER, DEAN, LIBRARIAN, HR, SUPER_ADMIN — add by extending `Role` enum + `ROLE_PERMISSIONS` map (no middleware rewrite).

---

## 3. Permission catalog

| Permission | ADMIN | TEACHER | STUDENT |
|------------|-------|---------|---------|
| portal.admin | ✅ | ❌ | ❌ |
| portal.teacher | ❌ | ✅ | ❌ |
| portal.student | ❌ | ❌ | ✅ |
| students.read/create/update/delete | ✅ | ❌* | ❌ |
| teachers.read/create/update/delete | ✅ | ❌ | ❌ |
| faculties.read/create/update/delete | ✅ | ❌ | ❌ |
| departments.read/create/update/delete | ✅ | ❌ | ❌ |
| courses.read/create/update/delete | ✅ | read | read |
| teacher_courses.read/assign/remove | ✅ | ❌ | ❌ |
| classes.read/create/update/delete | ✅ | ❌ | ❌ |
| enrollments.read/create/update/delete | ✅ | ❌ | ❌ |
| assignments.read | ✅ | ❌ | ❌ |
| assignments.create/update/delete | ❌ | ✅* | ❌ |
| submissions.read | ✅ | ✅* | ❌ |
| submissions.create/update | ❌ | ❌ | ✅* |
| grades.read | ✅ | ✅* | ❌ |
| grades.update / grades.submit | ❌ | ✅* | ❌ |
| grades.approve / grades.return | ✅ | ❌ | ❌ |
| quizzes.read | ✅ | ✅* | ❌ |
| quizzes.create/update/delete | ❌ | ✅* | ❌ |
| results.read | ✅ | ✅* | ✅ (own approved) |
| results.create / update / submit | ✅ | ✅* | ❌ |
| results.approve / results.return | ✅ | ❌ | ❌ |
| attendance.read / manage | ✅ | ✅ | read |
| notifications.read | ✅ | ✅ | ✅ |
| notifications.create / manage | ✅ | ❌ | ❌ |
| elections.read / results.read | ✅ | ❌ | ✅ |
| elections.manage / audit.read | ✅ | ❌ | ❌ |
| elections.vote | ❌ | ❌ | ✅ |
| payments.read / payments.pay | read | ❌ | ✅ |
| finance.read / finance.manage | ✅ | ❌ | ❌ |
| admissions.read / admissions.manage | ✅ | ❌ | ❌ |
| settings.read / settings.manage | ✅ | ❌ | ❌ |
| dashboard.read | ✅ | ✅ | ✅ |

\* Teacher global student directory intentionally denied; class-scoped access comes later.  
\* Teacher assignment mutations require TEACHER role + ClassSection ownership (not global Admin list).

### Phase 1B / 1C enforcement

| Action | Permission | Notes |
|--------|------------|-------|
| List/get students | `students.read` | ADMIN only |
| Create student | `students.create` | Sets role `STUDENT` server-side |
| Update student / status | `students.update` | Protected identity fields Admin-managed |
| Soft-delete student | `students.delete` | Deactivates User → `INACTIVE` |
| List/get teachers | `teachers.read` | ADMIN only |
| Create teacher | `teachers.create` | Sets role `TEACHER` server-side |
| Update teacher / status | `teachers.update` | |
| Soft-delete teacher | `teachers.delete` | Deactivates User → `INACTIVE` |
| Student self profile | `requireRoles("STUDENT")` on `/students/me` | Phone/address/photo only |
| Faculty / Department CRUD | `faculties.*` / `departments.*` | ADMIN only |
| Course create/update/delete | `courses.create/update/delete` | ADMIN only |
| Course read | `courses.read` | Admin + Teacher + Student (portal prep) |
| Teacher-course assign/remove/list | `teacher_courses.*` | ADMIN only |
| Teacher own courses | `requireRoles("TEACHER")` on `/teachers/me/courses` | JWT identity only |
| Class CRUD | `classes.*` | ADMIN only |
| Teacher own classes | `requireRoles("TEACHER")` on `/teachers/me/classes` | JWT identity only |
| Enrollment CRUD | `enrollments.*` | ADMIN only |
| Class enrolled students | `enrollments.read` on `/classes/:id/students` | ADMIN only |
| Student own enrollments | `requireRoles("STUDENT")` on `/students/me/enrollments` | JWT identity only — no global `enrollments.read` |
| Admin assignment list | `assignments.read` | ADMIN only |
| Teacher assignment CRUD | `assignments.create/update/delete` + TEACHER role | Ownership on ClassSection |
| Teacher own assignments | `requireRoles("TEACHER")` on `/assignments/me` | JWT identity only |
| Student own assignments | `requireRoles("STUDENT")` on `/students/me/assignments` | PUBLISHED + ACTIVE enrollment |
| Student submit/replace | TEACHER role routes + enrollment/deadline checks | Own file only |
| Teacher submission list/download | Own ClassSection assignments only | Ownership enforced |
| Teacher save/submit grade | `grades.update` / `grades.submit` | Own assignment submissions only; cannot approve |
| Admin grade review / approve / return | `grades.read` / `grades.approve` / `grades.return` | Global review |
| Student own assessment results | `results.read` on `/students/me/results` | APPROVED assignments/quizzes; JWT identity |
| Course-final calculate/submit | `results.create` / `results.submit` | Teacher own ClassSection; server-side calc |
| Course-final approve/return | `results.approve` / `results.return` | Admin only; APPROVED immutable |
| Student course results / GPA / transcript | `results.read` on `/students/me/course-results\|gpa\|transcript` | APPROVED finals; GPA may be `NOT_CONFIGURED` |
| **Distinction** | `grades.*` = assessment grading; `results.*` = ClassSection course finals | Do not conflate |
| Teacher quiz CRUD | `quizzes.*` + ownership | ClassSection owner; questions only in DRAFT |
| Student take quiz | `requireRoles("STUDENT")` | ACTIVE enrollment + PUBLISHED + availability |
| Admin quiz-attempt approve | `grades.approve` / `grades.return` | Same policy as assignment grades |
| Teacher attendance manage | `attendance.manage` + ClassSection owner | Start/end/bulk marks |
| Student own attendance | `attendance.read` on `/students/me/attendance` | JWT identity |
| Admin attendance oversight | `attendance.read` | Global lists; no silent rewrite |
| Own notification inbox | JWT + `notifications.read` | Filter by recipient userId |
| Mark read / read-all | JWT | Own `NotificationRecipient` only |
| Admin create / sent list | `notifications.create` | Role/user audiences; ACTIVE users |
| Admin election manage | `elections.manage` | Lifecycle, ballot, statistics |
| Student vote | `elections.vote` + JWT | Own ballot only; no teacher vote |
| Election audit | `elections.audit.read` | Admin; students forbidden |

Clients cannot escalate role via create/update payloads.

---

## 4. Middleware

- `requireAuth` → 401 if missing/invalid/inactive  
- `requireRoles(...roles)` → 403 if wrong role  
- `requirePermission(...perms)` → 403 if none of the listed permissions match  

HTTP: **401 Unauthorized** vs **403 Forbidden** are distinct.

---

## 5. Safe user payload

Login and `/me` include `permissions: string[]` derived from role. Password hashes never appear in student/teacher serializers.
