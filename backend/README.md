# Dhapti Backend API

Express + Prisma + PostgreSQL REST API for the Dhapti University Management System.

## Quick start (SQLite — works without Docker)

```bash
cd backend
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API: http://localhost:4000

### Optional PostgreSQL (production)

1. Set `provider = "postgresql"` in `prisma/schema.prisma`
2. Set `DATABASE_URL` in `.env` to your Postgres connection string
3. `docker compose up -d db` (from repo root) then `npx prisma db push && npm run db:seed`


## Demo credentials (password: `DHAPTI@2026`)

| Role    | Email                     |
|---------|---------------------------|
| Student | mohamudcade143@gmail.com  |
| Teacher | mohamed.ali@dhapti.edu.so    |
| Admin   | admin@dhapti.edu.so          |
| Certificate Admin | cert.admin@dhapti.edu.so |
| Exam Control | exam.control@dhapti.edu.so |
| Dept Admin | dept.cs@dhapti.edu.so     |

## Core endpoints (Phase 1)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Bearer JWT |
| GET/POST `/api/students` | Admin/Teacher / Admin |
| PATCH | `/api/students/me` | Student (phone/address/photo only) |
| GET/POST `/api/teachers` | Admin |

Frontend expects `VITE_API_URL=http://localhost:4000/api`.
