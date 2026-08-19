# Testing Strategy — Dhapti UMS

**Owner:** QA & Testing Engineer  

---

## 1. Phase 1A coverage (implemented)

Backend (`cd backend && npm test`):

- Valid / invalid / missing login  
- Portal expectedRole 403  
- `/auth/me` auth + no passwordHash  
- Student blocked from `/teachers`  
- Teacher blocked from global `/students`  
- Admin allowed `/students`  
- Unauthenticated 401  
- Forged ADMIN JWT rejected  
- register-admin disabled by default  
- Permission catalog unit tests  

---

## 2. Phase 1B coverage (Students & Teachers Admin)

Suite: `backend/tests/admin-students-teachers.test.ts`

**Students**
- Unauthenticated list → 401  
- Student / Teacher blocked from admin list → 403  
- Admin create, read, update, search (`q`), paginate, deactivate  
- Duplicate email / student ID → 409  

**Teachers**
- Student blocked from teachers list → 403  
- Teacher blocked from create → 403  
- Admin create, read, update, search, paginate, deactivate  
- Duplicate email / staff ID → 409  

**Auth regression:** Phase 1A suite still expects admin student list shape `{ data, pagination }`.

---

## 3. Phase 1C coverage (Academic Structure)

Suite: `backend/tests/admin-academic-structure.test.ts`

- Unauthenticated faculties → 401  
- Student/Teacher blocked from faculty/department/course **create** → 403  
- Admin Faculty create/read/update/search/paginate/deactivate; duplicate code → 409  
- Admin Department create with `facultyId`; invalid faculty → 400; filter by faculty; search  
- Admin Course create with `departmentId`; invalid department → 400; filter by department/faculty; search; soft delete  
- Pagination metadata consistency  

Permission catalog asserts Admin-only academic create permissions.

---

## 4. Phase 1D-A coverage (Teacher ↔ Course)

Suite: `backend/tests/teacher-course-assignment.test.ts`

- Unauthenticated assign → 401  
- Student/Teacher blocked from assign/remove/list-other → 403  
- Admin assign, list, duplicate 409, remove  
- Inactive teacher / inactive course rejected  
- Invalid teacher/course → 404  
- Teacher `/me/courses` returns only own assignments  

---

## 5. Phase 1D-B coverage (Classes & Sections)

Suite: `backend/tests/admin-classes.test.ts`

- Unauthenticated → 401  
- Student/Teacher blocked from class management → 403  
- Admin create with CourseTeacher link; unassigned teacher → 400  
- Duplicate section/year/semester → 409  
- Filter by course/department/faculty; search; soft deactivate  
- Teacher `/me/classes` ownership  

---

## 6. Phase 1E-A coverage (Student Enrollment)

Suite: `backend/tests/admin-enrollments.test.ts` (+ permission matrix updates)

- Unauthenticated → 401  
- Student/Teacher blocked from Admin enrollment create/modify → 403  
- Admin enrolls ACTIVE student into ACTIVE ClassSection (ACTIVE Course)  
- Duplicate ACTIVE enrollment → 409  
- Inactive student / class / course rejected  
- Invalid student/class → 404  
- Student `/students/me/enrollments` returns only own rows  
- Admin `/classes/:id/students` lists enrolled students  
- Soft drop → `DROPPED` retains row; reactivation re-validates ACTIVE actors  

---

## 7. Phase 1E-B coverage (Enrollment UX)

Frontend-focused phase on Phase 1E-A APIs:

- Admin `/admin/enrollments` — list/search/filter/paginate/enroll/drop/reactivate  
- Admin Classes → enrolled students dialog (confirm drop, reactivate)  
- Student My Courses — real enrollments, statuses, retry on error  
- No schema migration; backend suite remains the Phase 1E-A tests  

---

## 8. Phase 1F-A coverage (Assignment Core)

Suite: `backend/tests/assignments-core.test.ts`

- Unauthenticated → 401  
- Student cannot create → 403  
- Teacher cannot create for another teacher’s class → 403  
- Teacher creates DRAFT; student cannot see draft  
- Publish → student with ACTIVE enrollment can see  
- Student cannot see other class / archived  
- Teacher cannot edit another teacher’s assignment → 403  
- Invalid classSection / dueAt / maxMarks validation  

---

## 9. Phase 1F-B coverage (Submissions & Files)

Suites: `backend/tests/assignment-submissions.test.ts`, `storage-path.test.ts`

- Unauthenticated submission access → 401  
- Student upload when enrolled + published + before deadline  
- Not enrolled → 403  
- Invalid extension → 400  
- Replace before deadline → 200  
- After deadline → 400  
- Student cannot download another’s file → 403  
- Teacher list/download own assignment; other teacher → 403  
- Path traversal keys rejected  

---

## 10. Phase 1F-C coverage (Grading & Results)

Suite: `backend/tests/grading-results.test.ts` (+ permissions catalog asserts)

- Unauthenticated grade/approve/results → 401  
- Teacher grades own submission; cannot grade another teacher’s → 403  
- Teacher cannot approve → 403  
- Negative / over-max score → 400  
- Save → GRADED; student cannot see score; results empty  
- Submit → PENDING_APPROVAL; edit while pending → 409  
- Admin return with reason → RETURNED; still hidden from student  
- Teacher correct + resubmit; Admin approve → student sees own result  
- Other student results empty; APPROVED immutable → 409  

---

## 11. Phase 1G coverage (Quizzes)

Suite: `backend/tests/quizzes.test.ts`

- Unauthenticated quiz/attempt → 401  
- Teacher creates for own class; cannot for other teacher’s class → 403  
- Empty/invalid quiz cannot publish; MC requires exactly one correct  
- Student not enrolled cannot start; enrolled sees quiz without answer keys  
- Max concurrent attempts; attempt ownership; forge score ignored  
- Auto-grade MC/TF/short-answer; submit → PENDING_APPROVAL  
- Admin approve → student results; other student cannot see  

---

## 12. Phase 1H coverage (Attendance)

Suite: `backend/tests/attendance.test.ts`

- Unauthenticated → 401  
- Teacher ensure/start own class; cannot start other teacher’s → 403  
- Duplicate start/end rejected; end before start rejected  
- Roster enrolled-only; UNMARKED default; bulk rejects non-enrolled  
- Upsert (no duplicate rows); locked after COMPLETED  
- Student own summary/%; cannot see other class; cannot mark  
- Admin sessions/teachers lists + pagination  

---

## 13. Phase 1I coverage (Notifications)

Suite: `backend/tests/notifications.test.ts`

- Unauthenticated → 401  
- Student/teacher cannot create → 403; Admin can create for role audiences and specific users  
- Inbox ownership: student cannot read/mark teacher-only notification → 404  
- Per-user readAt: one student reads, other remains unread  
- Mark-all and unread-count affect caller only  
- Duplicate recipients collapsed; auto-notify dedupe via `dedupeKey`  
- Assignment publish / quiz publish / grade approve create notifications for enrolled/affected users  
- Pagination envelope; unread + type filters  

---

## 14. Phase 1J coverage (Elections)

Suite: `backend/tests/elections.test.ts`

- Unauthenticated → 401; Teacher/Student cannot manage → 403  
- Lifecycle transitions; invalid jumps → 409  
- Ballot locked after OPEN; inactive/nonexistent candidates rejected  
- Complete ballot required; cross-position candidate rejected  
- Client studentId ignored; duplicate → 409 `ALREADY_VOTED`  
- Concurrent duplicate protected by unique constraint  
- Result visibility AFTER_CLOSED; aggregates hide voter identities  
- Audit VOTE_CAST without candidateId; students cannot read audit  
- Election notifications use Phase 1I service + dedupeKey  

---

## 15. Phase 1K coverage (Course Results / GPA / Transcript)

Suite: `backend/tests/course-results.test.ts`

- Teacher ownership; Admin approve/return; student APPROVED-only visibility  
- Approved immutability; retake-safe `enrollmentId` uniqueness  
- Credit-hour snapshot; numeric calculation with configured weights  
- Missing weights → clear error (no silent defaults)  
- Missing grade scale → letter/GP unavailable; GPA `NOT_CONFIGURED`  
- Transcript includes APPROVED only  
- Assessment `/students/me/results` regression  
- Permissions: `grades.*` vs `results.*`

---

## 16. Portal gap-close coverage

- `backend/tests/student-profile.test.ts` — PATCH `/students/me` strips identity fields; phone/address/photo allowed  
- `admin-enrollments.test.ts` — owning Teacher can list `/classes/:id/students` with `attendancePercent`; non-owner Teacher → 403  

---

## 17. Phase 1L coverage (Finance & Fees)

Suite: `backend/tests/finance.test.ts`

- Permissions: `payments.*` / `finance.*`  
- Student ledger + pay PENDING → PAID with receipt; repay → 409  
- Admin summary/transactions/record-payment  
- Teacher/Student blocked from admin finance  

---

## 18. Phase 1N coverage (Settings & Dashboards)

Suite: `backend/tests/settings-dashboard.test.ts`

- Permissions: `settings.*` / `dashboard.read`  
- Public settings; admin GET/PATCH  
- `isAdmissionsOpen=false` → apply 403; reopen → apply 201  
- Admin/Teacher/Student dashboard stats; cross-role 403  

---

## 19. Phase 1M coverage (Online Admissions)

Suite: `backend/tests/admissions.test.ts`

- Permissions: `admissions.read` / `admissions.manage`  
- Public apply + options; duplicate open application → 409  
- Admin queue/detail; Teacher blocked  
- Approve → User+Student+PENDING tuition; student can login  
- Reject with reason; re-decide → 409  

---

## 20. Commands

```bash
# Backend
cd backend
npm test
npx tsc --noEmit

# Frontend
cd ..
npm run build
npm run lint
```

Do **not** run destructive seed/`migrate reset` against the shared `dev.db` for tests. Tests create unique emails/codes.

---

## 21. Critical cases (roadmap)

Still required before production (later phases): Dhapti letter/GPA scale values, retake policy, academic standing, grade amendments, transcript PDF, etc.
