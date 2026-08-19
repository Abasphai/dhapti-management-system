# ADR-002: Authentication & RBAC Foundation (Phase 1A)

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-04 |
| Deciders | Lead Architect |
| Phase | 1A |

---

## Context

Phase 0 identified JWT secret fallback, missing permission layer, and insufficient post-auth status checks. Existing JWT/bcrypt auth worked and must be extended, not rewritten.

## Decision

1. **Keep** Express routes under `/api/auth/*` (no forced `/api/v1` rename).  
2. **Require** `JWT_SECRET` from environment; fail boot if missing; harden production secret rules.  
3. **Introduce** code-based permission catalog (`lib/permissions.ts`) mapped from `Role`, with `requirePermission` middleware — extensible to future roles without a Permission DB table yet.  
4. **Re-validate** user `ACTIVE` status and role from DB on every `requireAuth` call.  
5. **Error body** remains `{ error: string, code?: string }` for frontend compatibility.  
6. **No schema migration** required — existing `User` / `Role` / `UserStatus` sufficient.  
7. **Disable** `register-admin` unless `ALLOW_DEV_ADMIN_REGISTER=true`.

## Consequences

- Teachers no longer have global `students.read` (class-scoped access deferred).  
- Login/me responses include `permissions[]` for future UI (no redesign).  
- Tests cover auth/RBAC foundation via `npm test` in backend.

## Follow-ups

- ADR-003 file storage  
- ADR-004 API versioning when breaking changes needed  
- Class-scoped teacher student listing in later phase  
