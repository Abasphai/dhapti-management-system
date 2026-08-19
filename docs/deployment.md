# DevOps & Environment Specs — Dhapti UMS

**Authority:** DevOps & Infrastructure Agent  

---

## 1. Environments

| Env | Frontend | API | Database |
|-----|----------|-----|----------|
| Local | Vite `:5173/5174` | Express `:4000` | SQLite `backend/prisma/dev.db` |
| Staging (target) | Static build / CDN | Node process | PostgreSQL |
| Production (target) | Static build / CDN | Node behind reverse proxy | PostgreSQL 16 |

---

## 2. Docker (optional Postgres)

`docker-compose.yml` defines Postgres 16 service (`dhapti-postgres`, port `5432`).

Switch Prisma datasource to `postgresql` and set:

```
DATABASE_URL="postgresql://USER:PASS@HOST:5432/biu_university?schema=public"
```

Then:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

---

## 3. Required Secrets (never commit real values)

| Variable | Where | Purpose |
|----------|-------|---------|
| `JWT_SECRET` | backend | Sign tokens |
| `DATABASE_URL` | backend | DB connection |
| `FRONTEND_ORIGIN` | backend | CORS allowlist |
| `VITE_API_URL` | frontend | API base (`/api` or absolute URL) |

Templates: root `.env.example` and `backend/.env.example`. Never commit real `.env` files.

---

## 4. Build & Run (production sketch)

```bash
# API
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start

# Frontend
cd ..
npm ci
npm run build
# serve dist/ behind nginx / CDN; proxy /api → API host
```

---

## 5. Uploads

- Local path: `backend/uploads` (or `UPLOAD_DIR`)
- Max size: `MAX_FILE_SIZE_MB=500`
- Serve via `/uploads` today; migrate to S3-compatible storage via File & Storage Agent later

---

## 6. CI/CD Readiness (Phase 9)

Planned pipeline stages:

1. Lint + typecheck (`npm run lint`, `tsc`)
2. Unit/integration tests (QA Agent)
3. Prisma migrate deploy (staging/prod)
4. Build frontend + backend artifacts
5. Deploy + health check `GET /api/health`

---

## 7. Operational Checks

| Check | Command / URL |
|-------|----------------|
| API up | `GET /api/health` → `ok: true`, `db: up` |
| CORS | Origins match deployed frontend host |
| Seeds | Only non-prod unless explicitly required |
| Logs | No secrets in log output |

---

## 8. Rollback Basics

- **DB:** Keep migration history; restore snapshot before risky migrate.
- **App:** Redeploy previous artifact; keep `JWT_SECRET` stable across rolling deploys unless forced rotation with session invalidation plan.
