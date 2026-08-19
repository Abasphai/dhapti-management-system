# ADR-001: Stack, Architecture & Multi-Agent Governance

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-04 |
| Deciders | Lead Architect (Phase 0 / Directive V2) |
| Supersedes | — |

---

## Context

BIU requires a long-lived UMS. The frontend (Public + Student + Teacher + Admin) is **approved and nearly complete**. A backend foundation (Express + Prisma + JWT) already exists with a rich schema and partial routes. Directive V2 mandates inspect-first governance, shared contracts, modular domains, and multi-agent ownership — without UI destruction.

---

## Decision

### Detected technology stack (retained)

| Layer | Choice |
|-------|--------|
| Frontend | React 19, Vite 6, TypeScript, React Router 7, Tailwind, shadcn/Radix, Framer Motion |
| Backend | Express 5, Prisma 6, Zod, bcryptjs, jsonwebtoken, Multer |
| Dev DB | SQLite |
| Prod DB | PostgreSQL 16 |
| Auth | JWT Bearer + role claims; client AuthContext |
| API style | REST JSON under `/api` (Vite proxy in dev) |

### Chosen architecture

1. **Preserve SPA** — integration-only frontend changes.  
2. **Extend Express/Prisma modular monolith** — do not replace with a new framework without a new ADR.  
3. **Logical modules** — auth, students, teachers, academics, assignments, quizzes, results, attendance, elections, notifications, files, reports.  
4. **Shared contracts** in `/docs/contracts` binding DB ↔ API ↔ Frontend ↔ Files ↔ Auth.  
5. **Multi-agent governance** — Lead Architect + 16 specialists with file ownership and handoff protocol.  
6. **Database strategy** — Prisma as SoT; migrations + impact analysis; SQLite→Postgres path.  
7. **API strategy** — keep current `/api` paths; introduce `/api/v1` only via ADR-004 when breaking changes require it.  
8. **Authentication strategy** — JWT + RBAC (`STUDENT`/`TEACHER`/`ADMIN`) with extensible future roles; server-side enforcement mandatory.  
9. **File storage strategy** — 500MB max; storage provider abstraction; local disk now, S3-compatible later (ADR-003).  
10. **Deployment strategy** — Node API + static SPA; env-based secrets; docker-compose Postgres optional.

### Multi-agent architecture

Documented in [`../agents.md`](../agents.md). Agents are responsibilities inside one system, not independent products.

### Module architecture

Documented in [`../architecture.md`](../architecture.md). Prefer domain isolation over forced folder renames that conflict with the approved frontend tree.

---

## Consequences

### Positive
- Zero UI rewrite risk  
- Extends existing backend investment  
- Clear ownership reduces merge conflicts  
- Contracts prevent FE/BE drift  
- Scale path to 50k+ users articulated  

### Trade-offs
- Schema currently ahead of API surface  
- JWT in `localStorage` (XSS consideration — future ADR-002)  
- Git must be installed/configured on all contributor machines  
- Module folder physicalization deferred to Phase 1 (avoid big-bang move)

### Rejected alternatives
- Next.js rewrite  
- Microservices split now  
- Discarding Prisma schema  
- Redesigning portals  

---

## Follow-up ADRs

| ID | Topic |
|----|--------|
| ADR-002 | Authentication hardening (cookies / refresh) |
| ADR-003 | File storage provider (S3) |
| ADR-004 | API versioning `/api/v1` |

---

## References

- [`../../PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md)  
- [`../architecture.md`](../architecture.md)  
- [`../contracts/`](../contracts/)  
- `backend/prisma/schema.prisma`  
- `src/App.tsx`
