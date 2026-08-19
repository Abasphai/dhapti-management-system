# ADR-003: Database Migration Strategy & Baseline

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-04 |
| Deciders | Lead Architect / DevOps |
| Phase | Pre-1B |

---

## Context

Phase 1A left the database managed by `prisma db push` with **no** `prisma/migrations` history. Phase 1B will introduce schema/API work for Admin CRUD and needs a safe migrate workflow:

```
Schema change → Migration → Test → Review → Deploy
```

not `db push` + hope.

The development database (`prisma/dev.db`) already contained live seed/auth data and must not be reset.

---

## Decision

### 1. Providers (unchanged)

| Environment | Provider | URL |
|-------------|----------|-----|
| Development (current) | **SQLite** | `DATABASE_URL=file:./dev.db` |
| Production-style | **PostgreSQL 16** | via `docker-compose.yml` (not default in schema yet) |

Do **not** switch the Prisma `provider` in this ADR. Schema remains `provider = "sqlite"` until an explicit Postgres cutover ADR.

### 2. Baseline strategy (executed safely)

Verified empty diff both ways between `dev.db` and `schema.prisma` (fully synchronized).

Then:

1. Generated SQL: `prisma migrate diff --from-empty --to-schema-datamodel …` →  
   `prisma/migrations/20260804200000_baseline/migration.sql`
2. **Did not** execute that SQL against the live DB (would conflict with existing tables).
3. Marked applied: `prisma migrate resolve --applied 20260804200000_baseline`  
   → only records history in `_prisma_migrations`; **data preserved**.

Result: `prisma migrate status` → **Database schema is up to date!**

### 3. Development workflow (Phase 1B+)

```bash
# After editing prisma/schema.prisma
cd backend
npx prisma migrate dev --name <short_description>
npm test
npx tsc --noEmit
```

Avoid `prisma db push` for shared/feature work unless an emergency hotfix and always follow with a proper migration.

**Forbidden without explicit approval:** `prisma migrate reset`, dropping `dev.db`, manual DROP TABLE.

### 4. Production / PostgreSQL workflow (future)

When switching to Postgres:

1. Set `provider = "postgresql"` and Postgres `DATABASE_URL`.
2. **Do not** assume SQLite baseline SQL applies unchanged.
3. Prefer a **new** Postgres baseline on an empty DB (`migrate deploy` / fresh migrate history), **or** regenerate diffs for Postgres.
4. Deploy with: `npx prisma migrate deploy` (never `migrate dev` in prod).

Document that cutover in a future ADR before production go-live.

### 5. Safety rules

1. Diff schema vs DB before baseline or risky migrate.  
2. Prefer `migrate resolve --applied` only when DB already matches SQL.  
3. Never reset shared databases to “fix” history.  
4. Commit `prisma/migrations/**` and `migration_lock.toml`.  
5. Keep seeds non-destructive in production (current seed wipes — use only in local/dev).

---

## Consequences

### Positive
- Phase 1B can use `migrate dev` on SQLite with history.  
- Auth/seed data retained.  
- Clear Postgres path documented.

### Trade-offs
- Baseline SQL is **SQLite dialect**; not portable to Postgres as-is.  
- Dual-provider local+prod still requires a deliberate cutover step.

---

## References

- `backend/prisma/migrations/20260804200000_baseline/`
- `docs/database.md`
- `docs/development.md`
