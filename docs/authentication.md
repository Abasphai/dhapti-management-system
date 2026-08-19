# Authentication — Dhapti UMS (Phase 1A)

**Owner:** Authentication & Security Engineer  
**ADR:** [ADR-002](./adr/ADR-002-AUTH-RBAC-FOUNDATION.md)

---

## 1. Live endpoints (actual convention: `/api`, not `/api/v1`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Issue JWT |
| POST | `/api/auth/logout` | Yes | Stateless acknowledge (client discards token) |
| GET | `/api/auth/me` | Yes | Current safe user + permissions + profile |
| POST | `/api/auth/register-admin` | Dev flag | Only if `ALLOW_DEV_ADMIN_REGISTER=true` and not production |

---

## 2. Login flow

1. Client posts `{ email, password, expectedRole? }`.  
2. Server finds user; requires `status === ACTIVE`.  
3. bcrypt compare (cost 12).  
4. Optional portal `expectedRole` mismatch → **403 FORBIDDEN**.  
5. JWT signed with `JWT_SECRET` (`sub`, `role`, `email`), expiry `JWT_EXPIRES_IN` (default `7d`).  
6. Response: `{ token, user }` where `user` is a safe DTO (never `passwordHash`).

Inactive / suspended / unknown users all receive the same **401 Invalid credentials** on login (no enumeration).

---

## 3. Token verification

`requireAuth` middleware:

1. Bearer token required → else 401.  
2. Verify JWT signature/expiry.  
3. Load user from DB; must exist and be `ACTIVE`.  
4. Token `role` must match DB role (blocks forged elevation).  
5. Attach `{ id, role, email, status }` to request.

---

## 4. Account status policy

| Status | Login | Protected APIs |
|--------|-------|----------------|
| ACTIVE | Allowed | Allowed |
| INACTIVE | Denied (401) | Denied (401) even with old token |
| SUSPENDED | Denied (401) | Denied (401) even with old token |

---

## 5. Frontend integration (UI preserved)

- `AuthContext` stores token/user in `localStorage`.  
- `ProtectedRoute` enforces portal roles + ACTIVE status.  
- Logout clears client state and best-effort `POST /auth/logout`.  
- `refreshMe` clears session on 401/403 or non-ACTIVE status.

---

## 6. Password rules

- Never stored plaintext; bcrypt only.  
- Never returned in JSON; login/me use `select`/DTO without hash.  
- Never logged.  
- Min length: login ≥6 (Zod); register-admin ≥8 when enabled.

---

## 7. Environment

See `backend/.env.example`: `JWT_SECRET` (required), `JWT_EXPIRES_IN`, `ALLOW_DEV_ADMIN_REGISTER`, `FRONTEND_ORIGIN`, `DATABASE_URL`.
