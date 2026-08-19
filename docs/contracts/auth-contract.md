# Auth Contract — Dhapti UMS (Phase 1A)

**Owner:** Authentication & Security Engineer  
**Base:** `/api/auth` (existing convention — not `/api/v1`)

---

## Endpoints

### POST `/auth/login`
**Body:** `{ email, password, expectedRole?: "STUDENT"|"TEACHER"|"ADMIN" }`  
**200:** `{ token, user }`  
**user:** `{ id, email, role, portal, status, permissions[], profile }` — never `passwordHash`  
**400** `BAD_REQUEST` · **401** `UNAUTHORIZED` · **403** `FORBIDDEN` (wrong portal)

### POST `/auth/logout`
**Auth:** Bearer  
**200:** `{ ok: true }` (stateless; client must discard token)

### GET `/auth/me`
**Auth:** Bearer  
**200:** safe user object (same shape as login `user`)  
**401** if missing/invalid/inactive · **404** if user deleted

### POST `/auth/register-admin`
**Enabled only when** `ALLOW_DEV_ADMIN_REGISTER=true` **and** `NODE_ENV !== production`  
Otherwise **404**.

---

## Error shape

```json
{ "error": "Human-readable message", "code": "UNAUTHORIZED" }
```

Codes: `BAD_REQUEST` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `INTERNAL_ERROR`

---

## Token

JWT Bearer · claims `sub`, `role`, `email` · secret `JWT_SECRET` · expiry `JWT_EXPIRES_IN`
