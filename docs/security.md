# Security Strategy — Dhapti UMS

**Owner:** Authentication & Security Engineer  
**Phase 1A status:** Auth foundation hardened (see ADR-002)

---

## 1. Controls implemented (Phase 1A)

| Control | Status |
|---------|--------|
| bcrypt password hashing (cost 12) | ✅ |
| JWT from `JWT_SECRET` env (no code fallback) | ✅ |
| Production secret strength check | ✅ |
| ACTIVE-only login + request-time status check | ✅ |
| Role-forgery rejected (token role vs DB) | ✅ |
| Permission middleware (`requirePermission`) | ✅ |
| passwordHash never in API responses | ✅ |
| register-admin gated by env flag | ✅ |
| CORS allowlist | ✅ |
| Consistent 401 vs 403 | ✅ |

---

## 2. Remaining risks (accepted for later)

| Risk | Level | Phase |
|------|-------|-------|
| JWT in localStorage (XSS) | MEDIUM | Future ADR |
| No login rate limiting | MEDIUM | 9 / Security |
| No Prisma migrate history yet (still db push) | HIGH (prod) | 1B+ / DevOps |
| AuditLog not written on auth events | MEDIUM | Later |
| Class-scoped teacher data access | — | Later academic phase |

---

## 3. Checklist for new endpoints

- [ ] `requireAuth`  
- [ ] `requireRoles` and/or `requirePermission`  
- [ ] Ownership checks where needed  
- [ ] Zod validation  
- [ ] Safe errors (no secrets/stack to client)  
