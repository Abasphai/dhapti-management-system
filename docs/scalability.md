# Scalability Strategy — Dhapti UMS

**Owner:** Performance & Scalability Engineer  

---

## 1. Capacity Targets

| Scale | Users (order) | Strategy |
|-------|---------------|----------|
| Launch | ~500–2,000 | Single API + Postgres/SQLite; indexed queries |
| Growth | ~5,000–15,000 | Postgres pooling, pagination everywhere, Redis cache |
| Large | 50,000+ | Read replicas, object storage, background jobs, CDN |

Do **not** prematurely optimize without metrics.

---

## 2. Application Patterns

1. **Pagination / filtering / sorting** on all list APIs.  
2. **Indexes** on foreign keys and common filters (`role+status`, `studentCode`, course/enrollment pairs).  
3. **Avoid N+1** — Prisma `include`/`select` deliberately.  
4. **Lazy load** heavy portal sections; keep approved UI structure.  
5. **Chunked / streamed uploads** for large assignment files (≤500MB).  
6. **Aggregate election tallies** — do not scan ballots for public charts.  
7. **Background jobs** later for notifications, report generation, virus scan.

---

## 3. Caching (planned)

| Data | Cache |
|------|--------|
| Public faculty lists | Short TTL Redis/CDN |
| Election live tallies | Short TTL + write-through on vote |
| Session/user profile | Optional Redis |

---

## 4. Database Path

- **Dev:** SQLite for velocity.  
- **Staging/Prod:** PostgreSQL 16 (`docker-compose.yml` ready).  
- Document switch in ADR when Postgres becomes default for all envs.

---

## 5. Metrics to Watch (Phase 9)

- p95 API latency  
- Slow query log  
- Upload failure rate  
- Error rate by endpoint  
- DB connection pool saturation  
