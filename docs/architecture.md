# System Architecture — Dhapti UMS

**Owner:** Lead Architect  
**Related:** [ADR-001](./adr/ADR-001-STACK-AND-ARCHITECTURE.md), [agents.md](./agents.md)

---

## 1. Style

**Modular monolith API + approved React SPA.**  
Extend what exists. Do not rewrite the frontend or invent a second backend.

```
Browser (Vite SPA: Public · Student · Teacher · Admin)
        │  /api  (Vite proxy → :4000)
Express API (JWT · Zod · Multer · domain routers)
        │
Prisma ── SQLite (dev) / PostgreSQL (prod)
Uploads ── Local disk → S3-compatible later
```

---

## 2. Absolute Frontend Rule

Preserve layouts, colors, typography, navigation, routes, components, responsiveness.  
Modify UI only for API binding, auth, validation, loading/error/empty, or net-new capability using the existing design system.

---

## 3. Module Architecture

### Principle

Each business domain is isolated, reusable, and independently maintainable.  
Exact folder names may follow Express conventions; the **boundary** matters more than path cosmetics.

### Logical modules

| Module | Domain | Primary agents |
|--------|--------|----------------|
| `auth` | Login, JWT, RBAC | Security, Backend, API |
| `students` | Student profiles/CRUD | Backend, Academic, Frontend |
| `teachers` | Teacher profiles/CRUD | Backend, Academic, Frontend |
| `academics` | Faculty, dept, program, course, class, enrollment | Academic |
| `assignments` | Assignments + submissions (500MB) | Assessment, File |
| `quizzes` | Quizzes/attempts | Assessment |
| `results` | Marks + approval pipeline | Results |
| `attendance` | Teacher + student attendance | Attendance |
| `elections` | Elections, votes, tallies | Election |
| `notifications` | In-app + Q&A | Communication |
| `files` | Storage abstraction | File |
| `reports` | Analytics/exports (future) | Backend, Performance |

### Physical mapping (current + target)

**Today:** `backend/src/routes/{auth,students,teachers}.js` + rich Prisma schema.  
**Target:** grow `backend/src/modules/<name>/{routes,service,validators}.ts` **or** keep `routes/` + `services/` per module — choose one pattern in Phase 1 and document in ADR if restructuring.

**Frontend:** keep `src/pages/{public,student,teacher,admin}` — do not force `/modules` onto the SPA if it conflicts with the approved structure.

### Future modules (add without rewrite)

Library · Hostel · Transport · HR · Finance portal · Parent portal · LMS · AI assistant

---

## 4. Shared Contracts

All agents obey `/docs/contracts/*`:

- `database-contract.md`
- `api-contract.md`
- `auth-contract.md`
- `frontend-contract.md`
- `file-contract.md`

Contract changes require impact analysis.

---

## 5. Change Impact Analysis

Before changing schema, API, auth, permissions, or core entities:

1. Identify direct dependents (models → APIs → pages → seeds/tests).  
2. List agents that must coordinate.  
3. Document impact in handoff / ADR if architectural.  
4. Implement smallest safe change set.  
5. Update contracts + `PROJECT_CONTEXT.md`.

**Example — Course entity change:**

```
Course → Enrollment → Assignment → Quiz → Attendance → ResultEntry
      → API /courses → Student/Teacher/Admin pages
```

---

## 6. Error Handling Standard

- Structured `{ error }` responses  
- Safe user messages; detailed server logs without secrets  
- Consistent HTTP codes (see API contract)

---

## 7. Quality Gate (major features)

Modular · migrated DB · secured API · documented contracts · UI preserved · RBAC enforced · tests for critical rules · docs updated.

---

## 8. Related Docs

[database](./database.md) · [api](./api.md) · [authentication](./authentication.md) · [permissions](./permissions.md) · [security](./security.md) · [testing](./testing.md) · [scalability](./scalability.md) · [file-storage](./file-storage.md) · [notifications](./notifications.md) · [deployment](./deployment.md) · [development](./development.md)
