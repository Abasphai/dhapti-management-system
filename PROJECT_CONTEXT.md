# Dhapti University Management System — PROJECT_CONTEXT

> **Single Source of Truth** (Master Directive V2)  
> Every agent MUST read this file before significant work.  
> Every major architectural change MUST update this file.  
> **Last updated:** 2026-08-16 · **Phase:** Step 1 Exam Control Admin + Admit Card Clearance **COMPLETE** — prior: Analytics Dashboard + CMS Phase 6 + EN/SO/AR

---

## 1. Project Purpose

Production-grade, modular, scalable **University Management System** for **Dhapti University (Dhapti)** connecting an **approved frontend** to a secure backend, database, API, authentication, and domain business logic — without rewriting the UI.

---

## 2. Absolute Frontend Rule

**Preserve** UI/UX, layouts, colors, typography, navigation, routes, components, responsiveness, pages, design system.  
**Do not** redesign, rewrite, replace framework, or delete pages.  
**Only modify** frontend for API integration, authz, real data, forms/validation, loading/error/empty, notifications, or net-new capability using the existing design system.

Brand: Navy `#002147` · Orange `#ea580c` / `#E85D04` · Green `#16a34a` · Surfaces `#F4F7FB` / `#E5EBF3`

---

## 3. Detected Technology Stack (verified 2026-08-09)

### Frontend
| Layer | Actual |
|-------|--------|
| App | React 19 + TypeScript |
| Build | Vite 6 |
| Router | react-router-dom 7 |
| Style | Tailwind 3 + shadcn/Radix + Framer Motion + Recharts |
| State | Context (`Auth`, `Theme`, `Layout`, `Avatar`) — no Redux/Zustand |
| API client | `src/lib/api.ts` → `VITE_API_URL` default `/api` |
| Proxy | Vite `/api` → `127.0.0.1:4000` |
| Lockfile | `package-lock.json` present |

### Backend (exists — extend, do not replace)
| Layer | Actual |
|-------|--------|
| API | Express 5 + TypeScript (`tsx`) |
| ORM | Prisma 6 |
| DB local | SQLite `file:./dev.db` (`backend/prisma/dev.db`) |
| DB prod target | PostgreSQL 16 (`docker-compose.yml`) |
| Auth | JWT + bcryptjs + Zod |
| Uploads | Multer + private `FileStorage`; max 500MB |
| Port | 4000 |
| App phase marker | `GET /` reports phase `"1N"` |
| Lockfile | `backend/package-lock.json` present |

### Database / migrations
| Item | Status |
|------|--------|
| Provider | SQLite (do not change without ADR) |
| Migrations | **14** applied; latest `20260809100000_finance_payments` |
| Schema sync | **Up to date** (`prisma migrate status`) |
| Models | ~37 (identity, academics, assignments, quizzes, attendance, results/GPA, elections, notifications + stub domains) |
| Env | `backend/.env` present with `DATABASE_URL`, `JWT_SECRET`, etc. |

---

## 4. Architecture Summary

**Modular monolith API + approved SPA.**  
Logical modules: auth, students, teachers, academics, assignments, quizzes, assessment grades, course results/GPA, attendance, elections, notifications, files.  
Shared contracts under `/docs/contracts`.  
Governance: Lead Architect + specialized agents ([docs/agents.md](docs/agents.md)).

**Permission distinction (critical):**
- `grades.*` → assignment/quiz assessment grading (Phase 1F-C / 1G)
- `results.*` → ClassSection course-final `ResultEntry` (Phase 1K)

Details: [docs/architecture.md](docs/architecture.md) · [docs/adr/ADR-001-STACK-AND-ARCHITECTURE.md](docs/adr/ADR-001-STACK-AND-ARCHITECTURE.md)

---

## 5. Folder Structure

```
/
├── PROJECT_CONTEXT.md
├── docs/
│   ├── architecture.md | database.md | api.md | authentication.md
│   ├── permissions.md | agents.md | development.md | testing.md
│   ├── security.md | deployment.md | scalability.md
│   ├── file-storage.md | notifications.md
│   ├── contracts/   (database, api, auth, frontend, file)
│   └── adr/         (ADR-001 … ADR-015)
├── src/             # APPROVED frontend
├── backend/         # Express + Prisma (extend)
├── public/
├── docker-compose.yml
├── package.json
└── vite.config.ts
```

---

## 6. Frontend Mapping (exact current state)

### Portals
Public website · Student (green accent) · Teacher · Admin

### Wired routes (`src/App.tsx`)
| Portal | Routes |
|--------|--------|
| Public | `/`, `/about`, `/authority`, `/programs`, `/academics`, `/faculties`, `/campus-life`, `/news`, `/contact`, `/admissions` |
| Student | login, dashboard, profile, id-card, courses, evaluate-teacher, attendance, assignments, quizzes, notifications, exam-results, results, improvement-result, eligible-subjects, admit-card, fees, account-details, hostel-fees, routine/schedule, education-materials, download-forms, mail, support(-ticket), blood-bank, elections |
| Teacher | login, dashboard, courses, materials, classes, students, my-attendance (2h locked timer), student-attendance, assignments, quizzes, grading, course-results, performance, id-card, profile, notifications |
| Admin | login, dashboard, **users**, students, teachers, faculties, classes, enrollments, attendance, **teacher-attendance** (live class monitor), grades, course-results, notifications, admissions, finance, settings, elections, teacher-performance |

### API-bound vs mock (audit 2026-08-11)

**API-bound (real JWT + `/api`):**
| Portal | Pages |
|--------|-------|
| Auth | Student / Teacher / Admin login |
| Public | **`/admissions` Apply form** (live); other public pages are static content (routed, populated) |
| Student | **Dashboard**, Profile (contact), Courses, Evaluate Teacher, Attendance, Assignments, Quizzes, Results, Elections, Notifications, Fees & Payments, Education Materials |
| Teacher | **Dashboard**, My Courses, Materials, Student List, Classes, Attendance (split), Assignments, Quizzes, Grading, Course Results, Performance, Notifications |
| Admin | **Dashboard**, **User Management**, Students, Teachers, Faculties/Departments/Courses, Classes, Enrollments, Attendance, Grade Review, Course Results, Notifications, Elections, Finance & Fees, Admissions Queue, **System Settings**, Teacher Performance |

**Still mock / local-only (handlers polished with toasts/print/download — no backend yet):**
| Portal | Pages |
|--------|-------|
| Student | Exam Results, Account Details, Hostel Fees, Improvement Result, Eligible Subjects, Admit Card, Routine, Download Forms, Mail, Support Ticket, Blood Bank; Profile password tab |
| Public | Contact form + Admission Help Desk (client success feedback only) |

**Removed (2026-08-10/11):** AI Campus Assistant widget + `POST /api/ai/chat` + related tests.

**Orphaned exports (exist, not in `App.tsx`):**  
`StudentGradesPage`, `StudentSchedulePage`, `AdminUsersPage`, `AdminFacultyPage`, `AdminDepartmentsPage` (alias).

**Nav (current):** `DashboardLayout.tsx` is source of truth — Student includes My Courses + Evaluate Teacher; Teacher includes Materials, Performance, ID Card, Profile, attendance split.

### Shell
`DashboardLayout.tsx` nav items are the navigation source of truth. Approved Dhapti shell (navy sidebar, portal surfaces) remains intact — no unintended redesign of the design system.

---

## 7. Backend / Database / API / Auth Status

| Area | Status |
|------|--------|
| Auth login/me/logout + JWT | **Live** — real endpoints; DB role re-check; no client role bypass |
| Students/Teachers Admin CRUD | **Live (1B)** |
| Faculties/Departments/Courses | **Live (1C)** |
| Teacher↔Course (`CourseTeacher`) | **Live (1D-A)** |
| ClassSection offerings | **Live (1D-B)** |
| Enrollment | **Live (1E)** |
| Assignments + Submissions/Files | **Live (1F-A/B)** |
| Assessment grading (`grades.*`) | **Live (1F-C)** |
| Quizzes | **Live (1G)** |
| Attendance | **Live (1H)** |
| Notifications (in-app) | **Live (1I)** |
| Elections | **Live (1J)** |
| Course finals / GPA / Transcript (`results.*`) | **Live (1K)** — GPA `NOT_CONFIGURED` until active `GradeScale` |
| Finance & Fees (`payments.*` / `finance.*`) | **Live (1L)** — Payment ledger; student pay; admin record/summary |
| Online Admissions (`admissions.*`) | **Live (1M)** — Public apply; admin queue; approve→User+Student+PENDING tuition; reject |
| System Settings (`settings.*`) | **Live (1N)** — `SystemSetting` KV; admissions open gate; academic year/semester; maintenance |
| Live Dashboards (`dashboard.read`) | **Live (1N)** — Admin/Teacher/Student stats endpoints bound to portal home pages |
| System User Management (`users.read` / `users.manage`) | **Live** — `GET/POST /api/admin/users`, reset-password, status toggle; UI `/admin/users` |
| Schema stubs **without** dedicated APIs yet | `CourseQuestion` (+ replies) — materials/ratings/settings audit are live or partially live |

Seed password `DHAPTI@2026`:  
Student `mohamudcade143@gmail.com` · Teacher `mohamed.ali@dhapti.edu.so` · Admin `admin@dhapti.edu.so` · Certificate Admin `cert.admin@dhapti.edu.so` · Exam Control `exam.control@dhapti.edu.so` · Dept Admin `dept.cs@dhapti.edu.so`  

Dev boot auto-repairs these accounts via `ensureDemoAccounts()` (non-production).

**Tests:** backend `npm test` · last full run (2026-08-16 credentials fix): **135/135 pass**. Frontend `tsc` + `vite build`: **0 errors**.

---

## 8. Roles & Permissions

Current: `STUDENT` · `TEACHER` · `ADMIN` · `DEPARTMENT_ADMIN` · `EXAM_ADMIN` · `CERTIFICATE_ADMIN`  
`EXAM_ADMIN`: Exam Control workspace only (no finance / CMS / global settings).  
`CERTIFICATE_ADMIN`: Certificates + students read + notifications (no finance / CMS / global settings).  
Future-ready: REGISTRAR, FINANCE_OFFICER, DEAN, LIBRARIAN, HR, SUPER_ADMIN  

Full matrix: [docs/permissions.md](docs/permissions.md)

---

## 9. Domain Business Rules (enforce in implementation)

1. Student editable: photo, phone, address only (name/mother/email/blood = Admin).  
2. Assignments max **500MB**; reject after deadline.  
3. Students see **APPROVED** assessment grades and **APPROVED** course finals only.  
4. Teacher attendance check-in/out timestamps; marks lock after session COMPLETED.  
5. Elections: one vote per position per student (atomic); secret ballot (no public choice mapping).  
6. Course-final calculation requires ClassSection assessment weights (sum 100); no silent defaults.  
7. Letter grade / grade point / GPA require configured active `GradeScale` — never invent Dhapti cutoffs.  
8. Exam admit card clearance: overall attendance ≥ **75%** and **zero** pending/overdue tuition unless Controllers override (`ExamAdmitCard.manualOverride`).  
8. APPROVED assessment grades and APPROVED course finals are immutable (amendments deferred).

---

## 10. Agent Responsibilities & Ownership

See [docs/agents.md](docs/agents.md).

**Protocol:** Lead inspects → decompose → DB contract → API contract → implement → security → QA → docs → Lead review → completion report.

**No** silent scope expansion, duplicate implementations, or inventing Dhapti institutional academic policy.

---

## 11. Development Rules

- Inspect before changing  
- Extend existing backend/stack  
- Shared contracts mandatory  
- Impact analysis for schema/API/auth/permission changes  
- Migrations for DB changes — **never** `migrate reset` / wipe `dev.db` without explicit approval  
- Backend authorization always; JWT identity is source of truth  
- Git feature branches; no secrets in git  
- Quality gate before “done” ([docs/architecture.md](docs/architecture.md) §7)

---

## 12. Current Implementation Status

| Phase | Status |
|-------|--------|
| **0 Architecture foundation (V2)** | **Complete** |
| **1A Auth / RBAC** | **Complete** |
| **Pre-1B DB migration baseline** | **Complete** |
| **1B Admin Students & Teachers** | **Complete** |
| **1C Faculties / Departments / Courses** | **Complete** |
| **1D-A Teacher ↔ Course** | **Complete** |
| **1D-B Classes & Sections** | **Complete** |
| **1E Enrollment** | **Complete** |
| **1F Assignments / Submissions / Assessment grading** | **Complete** |
| **1G Quizzes** | **Complete** |
| **1H Attendance** | **Complete** (+ 2-hour locked teacher class timer / live admin monitor) |
| **1I Notifications** | **Complete** |
| **1J Elections** | **Complete** |
| **1K Course Results / GPA / Transcript foundation** | **Complete** (numeric finals live; GPA disabled until Dhapti grade scale configured) |
| **1L Finance & Fees Engine** | **Complete** (`Payment` ledger; Student Fees + Admin Finance API-bound) |
| **1M Online Admissions** | **Complete** (public apply → admin queue → atomic enroll + Semester 1 tuition charge) |
| **1N Settings & Live Dashboards** | **Complete** (`SystemSetting` + role dashboard aggregations API-bound) |
| **Step 1 Exam Control** | **Complete** (`EXAM_ADMIN`, ExamSession/Schedule/AdmitCard, clearance ≥75% attendance + zero dues, `/admin/exam-control`, `/student/admit-card`) |
| **Demo credentials + admin UI polish** | **Complete** (`CERTIFICATE_ADMIN`, `ensureDemoAccounts` for all demos, Finance/Certificates/Admissions/Settings/Analytics table & modal polish) |
| **Faculty QR Attendance Phase A** | **Complete** (schema/locations/settings/permissions/admin CRUD; ADR-017) |
| **Faculty QR Attendance Phase B** | **Complete** (dynamic display, START/END tokens, faculty scan → shared timer, live monitor method) |
| **CMS Phase 1 foundation** | **Complete** (permissions, Cms* models, public/admin CMS APIs, admin shell; public site unchanged) |
| **CMS Phase 2** | **Complete** (site settings UI, nav manager, Navbar/Footer CMS + safe fallbacks) |
| **CMS Phase 3** | **Complete** (homepage + About block editors; public Home/About consume published blocks + fallbacks) |
| **CMS Phase 4** | **Complete** (News/Events editors, Media Library, public News + homepage widgets with fallbacks) |
| **CMS Phase 5** | **Complete** (TipTap WYSIWYG, faculty/program marketing CMS, public Faculties/Programs with catalog fallbacks) |
| **CMS Phase 6** | **Complete** (Custom page builder `/pages/:slug`, modular blocks, EN/SO/AR i18n + language switcher) |
| **Analytics Dashboard** | **Complete** (`/admin/analytics` + `GET /api/admin/analytics/overview`; Recharts KPIs/charts/export) |
| **Phase 6** | **Complete** (DEPARTMENT_ADMIN + UserDepartmentScope; certificates issue/verify) |
| **Phase 7** | **Complete** (Course Q&A, notification engine hooks, admin audit log viewer) |
| **Next domain candidates** | CMS polish (media crop); GradeScale; Production readiness |
| **Production readiness** | Not started (rate limit, refresh tokens, Postgres cutover, etc.) |

### Analytics & Intelligence notes
- Admin UI: `/admin/analytics` — KPI cards, revenue area chart, department bar chart, grade donut, at-risk cohort, department matrix; CSV + print/PDF export.
- API: `GET /api/admin/analytics/overview?facultyId&departmentId&academicYear` (ADMIN + `dashboard.read`).
- Aggregates real Payment, Enrollment/Student, ResultEntry, StudentAttendance data; at-risk = attendance &lt; 75% or GPA &lt; 2.0.
- Tests: `backend/tests/analytics-overview.test.ts`.

### CMS Phase 6 notes
- Admin: `/admin/cms/custom-pages` — create custom pages (title, slug, meta, DRAFT/PUBLISHED), block builder with reorder.
- Block types: `RICH_TEXT_BLOCK`, `FAQ_ACCORDION_BLOCK`, `DOWNLOADS_BLOCK`, `CALLOUT_BANNER_BLOCK` (Zod + optional `i18n.so` / `i18n.ar` payload overrides).
- Public: `/pages/:slug` renders published CMS pages; missing translation → English/default (never blank).
- Trilingual: Navbar `[EN | SO | AR]` → `localStorage` `biu.cms.locale`; public APIs accept `?lang=en|so|ar`.
- Schema: `CmsPage` meta + locale titles; `CmsNewsPost` / `CmsEvent` locale fields; `CmsMediaAsset.downloadCount` + `GET /api/public/cms/media/:id/download`.
- Reserved slugs blocked for custom pages (`home`, `about`, public route names). System pages excluded via `?scope=custom`.
- Tests: `backend/tests/cms-phase6-pages-i18n.test.ts`. Migration: `20260816010000_cms_phase6_pages_i18n`.

### Phase 7 notes
- Q&A: `POST/GET /api/questions*` — enrolled students ask; teachers reply at `/teacher/questions`; reply notifies student (`MESSAGE`).
- Student UI: **Ask Lecturer** on each My Courses card → `AskQuestionModal` (submit + answered history accordion).
- Notifications: existing engine + hooks for question asked (teachers), question reply, certificate issued (assignment publish / result approve already existed). Topbar bell: unread poll + Mark as read.
- Audit: `GET /api/admin/audit-logs` + UI `/admin/audit-logs` (filter by module / search user). `writeAudit` helper for Q&A + certificates.
- Tests: `backend/tests/phase7-notifications-qa.test.ts`.
- CMS seed: `prisma/seedCms.ts` — 3 published news, 3 events, header/footer nav, 6 faculty + 12 program marketing rows ($1,200/sem).

### Phase 6 notes
- Role: `DEPARTMENT_ADMIN` + `UserDepartmentScope` (one department per user). Backend `assertDepartmentScope` / `resolveDepartmentFilter` on students, teachers, courses, classes, certificates.
- Finance, settings, users, CMS remain `requireRoles("ADMIN")` / permission-denied for dept admins.
- Admin UI: `/admin/department-dashboard` (scoped stats), `/admin/certificates` (issue + print QR URL). Sidebar filtered for dept admins.
- Public: `/verify/certificate/:code` + `GET /api/public/certificates/verify/:code` (name, degree, faculty, dates only).
- Seed: `dept.cs@dhapti.edu.so` / `DHAPTI@2026` (CS scope); sample code `BIUVERIFY001A`.
- Tests: `backend/tests/phase6-dept-certificates.test.ts`.
- Migration: `20260815250000_phase6_dept_admin_certificates`.

### CMS Phase 5 notes
- TipTap WYSIWYG on News body, Rector message, About mission/vision/history; public `SafeHtml`/`CmsText` with DOMPurify allowlist (no raw HTML admin UX).
- Backend: `sanitizeCmsHtml` on news body + faculty/program HTML fields + rich block payloads; models `CmsFacultyMarketing`, `CmsProgramMarketing` (migration `20260815240000_cms_faculty_program_marketing`).
- Admin: `/admin/cms/faculties`, `/admin/cms/programs` → `/api/admin/cms/faculties|programs` (+ publish). Permissions: `cms.faculties.*`, `cms.programs.*`.
- Public: `/faculties` and `/programs` load published CMS marketing; empty/draft → approved hardcoded `facultyDetails` (layout preserved).
- Tests: `backend/tests/cms-phase5.test.ts`.

### CMS Phase 4 notes
- Admin: `/admin/cms/news` — CRUD + category + cover picker + publish.
- Admin: `/admin/cms/events` — CRUD + date/time + location + registration URL + publish.
- Admin: `/admin/cms/media` — upload dropzone, grid, copy URL, delete.
- Schema: `CmsNewsPost.category`, `CmsEvent.registrationUrl` (migration `20260815230000_cms_news_events_fields`).
- Public: `NewsPage` + homepage `NewsEventsSection` fetch published CMS news/events; empty → approved hardcoded Dhapti samples (UI unchanged).
- Tests: `backend/tests/cms-phase4.test.ts`.

### CMS Phase 3 notes
- Admin: `/admin/cms/home` — Hero Slider, Why Choose Dhapti, Rector message; Save Draft / Publish / Preview.
- Admin: `/admin/cms/pages` — About Dhapti Mission/Vision, History timeline, Leadership cards.
- Block types: `HERO_SLIDER`, `WHY_CHOOSE`, `RECTOR_MESSAGE`, `ABOUT_MISSION_VISION`, `ABOUT_HISTORY`, `ABOUT_LEADERSHIP` (Zod-validated).
- API: `GET /api/admin/cms/pages/slug/:slug`, `PUT /api/admin/cms/pages/:id/blocks` (atomic replace).
- Public: `HomePage` / `AboutPage` load `/api/public/cms/pages/home|about` when **PUBLISHED**; otherwise approved hardcoded Dhapti content.
- Tests: `backend/tests/cms-phase3.test.ts`.

### CMS Phase 2 notes
- Admin UI: `/admin/cms/settings` (branding, contact, social, legal, theme) → `GET/PATCH /api/admin/cms/settings`.
- Admin UI: `/admin/cms/navigation` (HEADER/FOOTER CRUD, parent, order, visibility) → `/api/admin/cms/nav`.
- Extended `SystemSetting` website keys: logo/favicon URLs, emergency phone, admissions/support emails, office hours, Instagram, privacy/terms URLs (still `cms.settings.*` only).
- Public `Navbar` / `Footer` load `/api/public/cms/settings` + `/api/public/cms/nav` with approved hardcoded Dhapti fallbacks when loading, failed, or empty nav.
- Mega menu / mobile drawer layout preserved. Portals links remain hardcoded.
- Tests: `backend/tests/cms-phase2.test.ts`.

### CMS Phase 1 notes
- Additive only: public Home/About/News/Navbar/Footer unchanged at Phase 1; Phase 2 wires Navbar/Footer only.
- Website brand/theme keys live in existing `SystemSetting` via `cmsWebsiteSettings.ts` (no `CmsSiteSettings`). Permission surfaces stay separate: `settings.*` (UMS ops) vs `cms.settings.*` (website keys only).
- Models: `CmsPage`, `CmsPageBlock`, `CmsNewsPost`, `CmsEvent`, `CmsNavItem`, `CmsMediaAsset`; migration `20260815220000_cms_foundation`.
- Publish statuses: `DRAFT` / `PUBLISHED` / `ARCHIVED`. Public `/api/public/cms/*` returns published only. Draft preview requires JWT + CMS perms on `/api/admin/cms/*/preview` (never `?preview=1`).
- Block payloads validated with Zod by `blockType` + `schemaVersion` (no raw JSON admin UI). No per-block status — visibility follows parent page.
- Media: `CmsMediaAsset` + local storage adapter under `storage/.../cms`; cloud adapter deferred.
- Admin shell: `/admin/cms/*` foundation pages + Website CMS sidebar group.
- **Future Department Admin (not implemented):** authorize as **ROLE + PERMISSION + DATA SCOPE**. Example: role `DEPARTMENT_ADMIN` + cms/academic permissions + `UserDepartmentScope.departmentId = X`. Backend must filter/reject out-of-scope rows; never rely on frontend hiding alone. Phase 1 does not add roles or scope tables.

### Phase 1N notes
- `SystemSetting` key-value store; migration `20260809120000_system_settings`.  
- Admin: `GET/PATCH /admin/settings`; UI `/admin/settings` (toggles + save).  
- Public: `GET /settings/public`; `POST /admissions/apply` returns 403 when `isAdmissionsOpen=false`.  
- Dashboards: `GET /admin|teacher|student/dashboard/stats` → live counts; UIs bound.  
- Permissions: `settings.read|manage`, `dashboard.read`.

### Phase 1M notes
- Evolved `AdmissionApplication` (`PENDING`/`UNDER_REVIEW`/`INTERVIEW_SCHEDULED`/`APPROVED`/`REJECTED`); migration `20260809110000_admissions_workflow`.  
- Public: `POST /admissions/apply`, `GET /admissions/options`; UI `/admissions` + Navbar/Hero “Apply Now”.  
- Admin: `/admin/admissions` list/detail; `approve` creates User+Student+PENDING Semester 1 `Payment` atomically; `reject` with reason; UI `/admin/admissions`.  
- Permissions: `admissions.read|manage`. Default student password `DHAPTI@2026`; tuition amount via `ADMISSION_TUITION_AMOUNT` (system default 1200 — not a Dhapti fee schedule).

### Phase 1L notes
- Evolved stub `Payment` into fee ledger (`PAID`/`PENDING`/`OVERDUE`); migration `20260809100000_finance_payments`.  
- Student: `GET /payments/me`, `POST /payments/pay`; UI `/student/fees` (receipt print view).  
- Admin: `/admin/finance/summary|transactions`, `POST /admin/finance/record-payment`; UI `/admin/finance`.  
- Permissions: `payments.read|pay`, `finance.read|manage`.

### Phase 1K notes
- Evolved `ResultEntry` → Enrollment/ClassSection finals (`UNIQUE(enrollmentId)`). See ADR-015.  
- Assessment `/students/me/results` unchanged; additive course-results / gpa / transcript.  
- No invented letter bands, weights, or GPA scale.  
- Teacher `/teacher/course-results`; Admin `/admin/course-results`; Student tabs on `/student/results`.  
- Retake / standing / amendments / transcript PDF deferred.

### Earlier phase notes
Retain ADRs 001–014 for detail. Notable correction vs older context: Phase 1F-C left `ResultEntry` unused; **Phase 1K evolved it** (do not treat ResultEntry as unused).

---

## 13. Known Limitations

1. Root `README.md` still describes early frontend-only scaffold — **outdated**.  
2. Public marketing pages are **routed and populated** (static content); CMS-backed editing not built. Footer Privacy/Terms alias to `/contact`.  
3. Some student portal extras (hostel, admit card, mail, blood bank, exam-results, routine, download forms, support) remain **demo data** — UX handlers (toast/print/download) work; no dedicated APIs yet.  
4. Password-change remains local demo (no change-password API).  
5. GPA letter/point values unavailable until Dhapti configures `GradeScale`.  
6. Frontend component tests sparse (backend has broad integration coverage).  
7. Rate limiting / refresh-token hardening pending.  
8. Dedicated `File` metadata model pending (paths on entities today).  
9. Some docs leftovers: `database.md` ERD/enums partially stale; `api.md` header lag in places.

### Audit resolution (2026-08-11)
| Item | Status |
|------|--------|
| Global contrast (portal shell, inputs, labels, dialogs, login placeholders) | **Fixed** via `index.css` + UI primitives |
| Typography weights on headings / labels | **Normalized** (`font-bold` base headings + form labels) |
| Navbar/Footer public links → real pages | **Verified** — no 404 routes; social links open external profiles |
| Dead mock buttons (Apply / Print / Webmail / Save form / Contact / Help Desk) | **Polished** with toast / print / download feedback |
| AI Campus Assistant | **Removed** (prior pass) |
| `tsc` frontend + backend | **0 errors** |
| Backend `npm test` | **All pass** |

---

## 14. Recommended resume points (priority order)

1. Admin GradeScale configuration UI (so 1K GPA can become operational once Dhapti supplies bands).  
2. Public CMS-lite content management (pages already routed).  
3. Enforce maintenanceMode / portal toggles on login if Dhapti requires.  
4. Password-change API + wire student extras that Dhapti wants live (hostel, support tickets).  
5. Production hardening (Postgres, rate limits, refresh tokens, README rewrite).

---

## 15. Major Architectural Decisions

| ADR | Decision |
|-----|----------|
| ADR-001 | React/Vite SPA + Express/Prisma modular monolith; JWT; SQLite→Postgres; multi-agent governance |
| ADR-002 | Auth / RBAC foundation |
| ADR-003 | Database migration strategy & baseline |
| ADR-004 | Academic structure Faculty → Department → Course |
| ADR-005 | Teacher ↔ Course assignment (`CourseTeacher`) |
| ADR-006 | Classes & Sections (`ClassSection`) |
| ADR-007 | Student Enrollment Core |
| ADR-008 | Assignment Core |
| ADR-009 | Assignment Submission & private file storage |
| ADR-010 | Assessment grading on Submission (`grades.*`) |
| ADR-011 | Quizzes / online assessments |
| ADR-012 | Attendance management |
| ADR-013 | Notification foundation |
| ADR-014 | University election system |
| ADR-015 | Course finals / GPA / transcript foundation (no invented Dhapti policy) |

Future ADRs: temporary-password / forced change, S3 storage provider, API versioning (`/api/v1`), admissions, finance.

---

## 16. Future Expansion (without rewrite)

Mobile app · Parent / Finance / Registrar portals · Library · Hostel · Transport · HR/Payroll · Payment gateway · SMS/Email · LMS · AI assistant · Advanced analytics · Degree audit · Transcript PDF

---

## 17. Documentation Index

| Doc | Purpose |
|-----|---------|
| [docs/architecture.md](docs/architecture.md) | System + modules + impact + quality gate |
| [docs/database.md](docs/database.md) | Schema |
| [docs/api.md](docs/api.md) | Endpoints |
| [docs/authentication.md](docs/authentication.md) | Auth design |
| [docs/permissions.md](docs/permissions.md) | RBAC matrix |
| [docs/agents.md](docs/agents.md) | Agents & ownership |
| [docs/development.md](docs/development.md) | Dev + Git strategy |
| [docs/testing.md](docs/testing.md) | Test strategy |
| [docs/security.md](docs/security.md) | Security strategy |
| [docs/deployment.md](docs/deployment.md) | Environments |
| [docs/scalability.md](docs/scalability.md) | Scale plan |
| [docs/file-storage.md](docs/file-storage.md) | Files |
| [docs/notifications.md](docs/notifications.md) | Comms |
| [docs/contracts/*](docs/contracts/) | Shared contracts |
| [docs/adr/](docs/adr/) | ADRs 001–015 |

**Docs health:** Core live sections (api permissions testing ADR-015) match 1K. Residual stale spots listed in §13. This file is the authoritative phase banner.
