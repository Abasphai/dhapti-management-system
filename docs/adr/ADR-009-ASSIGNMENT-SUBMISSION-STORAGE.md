# ADR-009: Assignment Submission & Private File Storage

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Date | 2026-08-05 |
| Deciders | Lead Architect / File & Storage / API |
| Phase | 1F-B |

---

## Context

Phase 1F-A delivered ClassSection-scoped Assignments. Students need to upload files (up to 500MB) privately. Baseline `Submission` existed but was unused. Public `/uploads` static mounting is unsuitable for private academic files.

## Decision

1. **Reuse** Prisma `Submission` with unique `(assignmentId, studentId)`.  
2. Store **metadata only** (`fileName`, `storageKey`, `mimeType`, `fileSize`); never BLOB.  
3. Introduce `FileStorage` abstraction (`saveFromPath`, `delete`, `exists`, `openReadStream`) with **local disk** adapter under `FILE_STORAGE_PATH` (default `storage/private`) — **not** publicly mounted.  
4. Hard system max **500MB**; effective max = `min(assignment.maxFileMb, 500)`.  
5. Deadline: server `now > dueAt` → reject create/replace.  
6. Authorization: JWT Student + ACTIVE Enrollment + PUBLISHED Assignment; Teacher only for own ClassSection.  
7. Downloads via authenticated `GET /api/submissions/:id/file` (stream), never path query params.

## Consequences

- Migration: `20260804224500_submission_storage`.  
- Future S3 adapter can replace local disk without API contract changes.  
- Grading fields (`score`, `feedback`) remain unused until a later phase.
