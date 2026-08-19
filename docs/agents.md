# Multi-Agent Governance — Dhapti UMS

**Coordinator:** Lead Architect / Orchestrator  
**Directive:** Master System Directive V2  

These are specialized engineering **responsibilities** within one architecture — not independent systems.

---

## 1. Org Chart

```
                    LEAD ARCHITECT / ORCHESTRATOR
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   CORE ENGINE             ACADEMIC & LOGIC            INFRA & SUPPORT
   Database                Academic                    File & Storage
   Backend                 Assessment                  Performance
   API                     Results & Approval          QA & Testing
   Security                Attendance                  DevOps
   Frontend Integration    Election                    Documentation
                           Communication
```

---

## 2. Roster & Ownership

| Agent | Owns | Must not casually modify |
|-------|------|--------------------------|
| **Lead Architect** | Global architecture, tasking, contracts integrity, reviews | Isolated feature code when a specialist owns it |
| **Database Architect** | `prisma/schema.prisma`, migrations, seeds, `docs/database.md`, DB contract | API routes, UI pages |
| **Backend Engineer** | `backend/src` services/controllers/business rules | Frontend styling; schema without DB agent |
| **API Architect** | Route shapes, `docs/api.md`, API contract | UI components |
| **Frontend Integration** | `src/**` binding, AuthContext client usage, loading/error/empty | Visual redesign; new themes |
| **Auth & Security** | JWT/RBAC middleware, `docs/authentication.md`, `permissions.md`, auth contract | Unrelated UI |
| **Academic Management** | Faculties→courses→enrollment domain | Elections UI redesign |
| **Assessment & Learning** | Assignments/quizzes/500MB rules | Results approval policy alone |
| **Results & Approval** | Marks pipeline visibility rules | Election tallies |
| **Attendance** | Teacher check-in/out + student marking | File storage internals |
| **University Election** | Voting, secret ballot, analytics | Auth core rewrite |
| **Communication** | Q&A + notifications | DB schema without coordination |
| **File & Storage** | Upload pipeline, file contract | Portal layouts |
| **Performance** | Indexes advice, caching, pagination enforcement | Feature scope expansion |
| **QA & Testing** | Test plans, critical cases in `testing.md` | Production secrets |
| **DevOps** | Env, docker, deploy docs, CI readiness | App business rules |
| **Documentation** | `PROJECT_CONTEXT.md`, `/docs`, ADRs | Feature implementation |

---

## 3. File Ownership (primary)

| Path | Primary owner |
|------|----------------|
| `src/pages/**`, `src/components/**`, `src/layouts/**` | Frontend Integration |
| `src/lib/api.ts`, `src/context/AuthContext.tsx` | Frontend + Security (coord.) |
| `backend/prisma/**` | Database |
| `backend/src/routes/**` | API + Backend |
| `backend/src/middleware/**` | Security |
| `docs/contracts/**` | Lead + owning agent |
| `PROJECT_CONTEXT.md` | Documentation / Lead |

Before editing another owner's file: coordinate via Lead Architect; smallest change; update contracts.

---

## 4. Workflow Protocol

```
User Request
  → Lead Architect (inspect PROJECT_CONTEXT + code)
  → Task decomposition + dependency analysis
  → Database contract check
  → API contract check
  → Implementation (owner agent)
  → Security review
  → QA
  → Documentation
  → Lead Architect review
  → Completion report
```

---

## 5. Handoff Format

```
Agent:
Task:
Purpose:
Files changed:
Database changes:
API changes:
Contracts changed:
Dependencies:
Security considerations:
Tests performed:
Known limitations:
Next agent:
Required action:
```

---

## 6. Completion Report Format

```
- Agent Operating:
- Task:
- Files Created:
- Files Modified:
- Database Changes:
- API Changes:
- Authentication Changes:
- UI Changes:
- Tests:
- Security Checks:
- Documentation Updated:
- Known Issues:
- Next Recommended Step:
```

---

## 7. Anti-Patterns (forbidden)

- Silent scope expansion  
- Duplicate services/models/routes  
- Frontend-only “security”  
- Schema change without migration + impact analysis  
- Broad unrelated refactor during a feature  
- Parallel conflicting edits to the same owned file  
