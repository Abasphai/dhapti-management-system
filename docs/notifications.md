# Notifications & Communication — Dhapti UMS

**Owner:** Communication & Notification Engineer  
**Phase:** 1I (in-app foundation) — see [ADR-013](./adr/ADR-013-NOTIFICATION-FOUNDATION.md)

---

## 1. Scope

### In-app (implemented)
- Models: `Notification` + `NotificationRecipient`
- Central service: `backend/src/lib/notifications.ts`
- Admin compose + sent list; Student/Teacher/Admin inbox
- Header unread badge + dropdown
- Auto: assignment publish, grade approve, quiz publish (+ quiz grade approve)

### Not in Phase 1I
Email · SMS · Push · Redis queues · Faculty/Department/ClassSection targeting · Attendance spam alerts · Elections/GPA notification modules

---

## 2. Architecture

```
Domain event / Admin compose
  → notificationService.createNotification(...)
  → Notification row
  → NotificationRecipient rows (userId)
  → Inbox API / unread-count / header bell
```

Future channels can attach to the same Notification without rewriting domain callers.

---

## 3. Event → Notification Map (current)

| Event | Recipients | Type | Dedupe key |
|-------|------------|------|------------|
| Admin announcement | Audience roles / userIds | ANNOUNCEMENT (default) | none |
| Assignment published | ACTIVE enrolled students | ASSIGNMENT | `assignment.published:{id}` |
| Grade approved | Affected student | GRADE | `grade.approved:{submissionId}` |
| Quiz published | ACTIVE enrolled students | QUIZ | `quiz.published:{id}` |
| Quiz grade approved | Affected student | GRADE | `quiz.grade.approved:{attemptId}` |

---

## 4. Frontend Binding

| Portal | Route |
|--------|-------|
| Student | `/student/notifications` |
| Teacher | `/teacher/notifications` |
| Admin | `/admin/notifications` (compose / sent / inbox) |

Header bell in `DashboardLayout` → `NotificationBell` (real unread count).

---

## 5. Privacy & Security

- Inbox filtered by JWT `userId` only.
- Mark-read / mark-all update only the caller’s recipient rows.
- `sourceId` does not grant access to the underlying resource.
- Do not put other students’ PII in notification payloads.
