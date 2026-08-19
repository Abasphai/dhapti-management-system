# File & Storage Strategy — Dhapti UMS

**Owner:** File & Storage Engineer  
**Contract:** [contracts/file-contract.md](./contracts/file-contract.md)

---

## 1. Goals

- Support profile images, assignment materials, student submissions, candidate photos, course materials.
- Enforce **500MB** maximum on client, API, and storage adapter.
- Abstract storage so local disk (dev) can become S3-compatible / CDN without rewriting business logic.

---

## 2. Current State (Phase 1F-B)

| Item | Status |
|------|--------|
| Multer dependency | Present (disk-backed temp → storage adapter) |
| `MAX_FILE_SIZE_MB=500` | In `backend/.env.example` |
| Private storage | `FILE_STORAGE_PATH` (default `storage/private`) — **not** public |
| Static `/uploads` | Legacy public mount only — **not** used for submissions |
| Submission metadata | On `Submission.storageKey` (+ mime/size/name) |
| Upload API | `POST /api/assignments/:id/submission` |
| Download API | `GET /api/submissions/:id/file` (auth stream) |

---

## 3. Abstraction (live)

```
Route → FileStorage.saveFromPath / openReadStream / delete
                ↑
     LocalDiskStorage (dev) | future S3CompatibleProvider
```

Implementation: `backend/src/lib/storage/`.  
Keys look like: `assignments/{assignmentId}/submissions/{studentId}/{uuid}.ext`  
Database stores **metadata only** — never absolute OS paths or BLOBs.

---

## 4. Validation Rules

| Rule | Enforcement |
|------|-------------|
| Max size 500MB | Multer limits + frontend check |
| MIME/extension allowlist | Per purpose (images vs documents/archives) |
| Auth required | Except public marketing assets |
| Virus scan | Optional Phase 9 |

---

## 5. Purpose Allowlists (planned)

| Purpose | Examples |
|---------|----------|
| `PROFILE_PHOTO` | jpg, png, webp |
| `ASSIGNMENT_MATERIAL` | pdf, docx, zip, pptx… |
| `SUBMISSION` | pdf, docx, zip, code archives… |
| `CANDIDATE_PHOTO` | jpg, png, webp |
| `COURSE_MATERIAL` | pdf, video links metadata |

---

## 6. Security Notes

- Do not trust client-provided MIME alone.
- Prefer non-guessable object keys.
- Authorize download by enrollment/role.
- Never commit uploaded binaries to git.
