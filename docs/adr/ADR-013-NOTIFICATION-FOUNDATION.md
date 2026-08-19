# ADR-013 — Notification Foundation (Phase 1I)

**Status:** Accepted  
**Date:** 2026-08-05  
**Phase:** 1I  

## Context

The UMS needed a reusable in-app notification system for Admin announcements and automatic alerts from completed academic modules (assignments, grades, quizzes). Prior schema had a stub per-user `Notification` row (title/body/userId) which could not scale to fan-out announcements without duplicating content.

## Decisions

### 1. Notification vs NotificationRecipient
- **Notification** = content (type, title, message, priority, source, creator).  
- **NotificationRecipient** = per-user delivery/read state (`userId`, `readAt`).  
One announcement → one Notification + N recipients. Read state is per recipient.

### 2. User ownership
Recipients always reference `User.id` (not studentId/teacherId/adminId). Portals are role views over the same User identity.

### 3. Source references (no hard FKs)
`sourceType` + `sourceId` are loose strings (e.g. `ASSIGNMENT` + assignmentId). No foreign keys to every domain table — future modules can deep-link without schema churn. Documented in API serializers as optional `link` for known routes.

### 4. Central service
All writers call `backend/src/lib/notifications.ts` (`createNotification`, role/user helpers, mark read, unread count, auto helpers). Domain routes must not insert recipient rows directly.

### 5. Transaction + dedupe
Create notification + recipients in a Prisma transaction. Auto-events use unique `dedupeKey` (e.g. `assignment.published:{id}`) so republish/retry does not spam. Concurrent races on `dedupeKey` are treated as skip.

### 6. Audience targeting (Phase 1I)
Role audiences: STUDENTS, TEACHERS, ADMINS, STUDENTS_TEACHERS, EVERYONE, USERS (explicit userIds, ACTIVE only). Faculty/Department/ClassSection targeting deferred — service boundary supports adding resolvers later.

### 7. Automatic triggers (limited)
| Event | Type | Dedupe |
|-------|------|--------|
| Assignment published | ASSIGNMENT | `assignment.published:{id}` |
| Grade approved | GRADE | `grade.approved:{submissionId}` |
| Quiz published | QUIZ | `quiz.published:{id}` |
| Quiz grade approved | GRADE | `quiz.grade.approved:{attemptId}` |

Attendance auto-notifications deferred (spam risk).

### 8. Channels & queue
Phase 1I = **IN_APP** only (DB rows). EMAIL/SMS/PUSH and Redis/BullMQ deferred; synchronous create is acceptable. Future queue can wrap the same service API.

### 9. Permissions
- `notifications.read` — ADMIN, TEACHER, STUDENT (own inbox)  
- `notifications.create` / `notifications.manage` — ADMIN  

Inbox/read endpoints derive identity from JWT; never trust client userId.

## Consequences
- Portals: `/student/notifications`, `/teacher/notifications`, `/admin/notifications`  
- Header bell: unread count + preview dropdown  
- Extensible for Elections, GPA warnings, attendance alerts without redesign

## Non-goals
Elections, GPA, Transcript, Grade Amendments, QR/biometric attendance, SMS, Email, Push, advanced queues.
