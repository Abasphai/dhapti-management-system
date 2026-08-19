# Development Guidelines & Git Strategy — Dhapti UMS

**Owners:** Lead Architect · DevOps · Documentation  

---

## 1. Prerequisites

- Node.js 20+  
- npm  
- Git (install and ensure on PATH)  
- Optional: Docker Desktop for Postgres  

---

## 2. Local Startup

```bash
# API
cd backend
npm install
npx prisma db push
npm run db:seed
npm run dev
# http://localhost:4000

# Frontend (repo root)
npm install
npm run dev
# http://localhost:5173 (or 5174)
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite SPA |
| `npm run dev:api` | Backend |
| `npm run build` | Frontend typecheck + build |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed demo users (destructive wipe — local/dev only) |

### Database migrations (SQLite local)

```bash
cd backend
npx prisma migrate status          # should be up to date
npx prisma migrate dev --name <change>   # after schema edits
npm test
```

**Do not:** `prisma migrate reset`, delete `prisma/dev.db`, or `db push` for shared feature work.  
Baseline details: [ADR-003](./adr/ADR-003-DATABASE-MIGRATION-STRATEGY.md).

---

## 3. Environment

Root `.env.example` and `backend/.env.example` — copy to `.env`, never commit secrets.

Frontend: `VITE_API_URL=/api`  
Backend: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_ORIGIN`, `MAX_FILE_SIZE_MB=500`

Restart Vite after env/proxy changes.

---

## 4. Git / Branch Strategy

### Rules

1. Working tree is not disposable — check status before large changes.  
2. Do not overwrite user work.  
3. Prefer feature branches for substantial work.  
4. Never merge blindly.  
5. Never commit secrets.  
6. Commits only when the user requests (Cursor agent policy).

### Branch naming

```
feature/authentication
feature/student-management
feature/teacher-management
feature/assignments
feature/results-approval
feature/attendance
feature/elections
fix/<short-description>
docs/phase-0-governance
```

### Before starting work

```bash
git status
git branch --show-current
# understand uncommitted changes
```

### Before merge (checklist)

1. Tests / manual critical cases  
2. `npm run lint` + `npm run build`  
3. Architecture & contract review  
4. Migrations reviewed  
5. Security (RBAC) review  
6. No unrelated file churn  
7. Docs updated  

### Parallel agents

When the environment supports it, use **isolated git worktrees** per agent/feature to avoid simultaneous conflicting edits to the same owned files.

### Note (Phase 0 validation host)

On the inspection host, `git` was **not available on PATH**. Install Git for Windows and re-enable source control before Phase 1 feature branches.

---

## 5. Coding Standards

1. TypeScript, modular, SOLID-friendly.  
2. Search for existing utils/services before adding duplicates.  
3. Frontend Integration: no redesign.  
4. Backend: authorize every protected route.  
5. Use shared contracts in `/docs/contracts`.  
6. No silent scope expansion — escalate to Lead Architect.

---

## 6. Demo Accounts

Password: `DHAPTI@2026`

| Role | Email |
|------|-------|
| Student | `mohamudcade143@gmail.com` |
| Teacher | `mohamed.ali@dhapti.edu.so` |
| Admin | `admin@dhapti.edu.so` |

---

## 7. Agent Protocol Reminder

Read `PROJECT_CONTEXT.md` → check contracts → implement in ownership boundary → security/QA → update docs → completion report.
