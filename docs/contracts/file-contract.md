# File Contract — Dhapti UMS

**Owner:** File & Storage Engineer  
**Related:** [../file-storage.md](../file-storage.md)

---

## 1. Hard Limits

| Rule | Value |
|------|--------|
| Max file size | **500 MB** (`MAX_FILE_SIZE_MB`) |
| Enforcement | Frontend pre-check + Multer/API + storage adapter |

HTTP on violation: **`413`** with `{ "error": "File exceeds 500MB limit" }` (or equivalent message).

---

## 2. Upload Request (target shape)

`POST /api/files` (multipart) — Phase 4+

| Field | Type | Notes |
|-------|------|-------|
| `file` | binary | Required |
| `purpose` | enum string | `PROFILE_PHOTO` \| `ASSIGNMENT_MATERIAL` \| `SUBMISSION` \| `CANDIDATE_PHOTO` \| `COURSE_MATERIAL` |
| `entityId` | string | Optional parent id (assignmentId, electionCandidateId, …) |

**Auth:** Required. Authorization by purpose + ownership.

**Response 201 (target):**

```json
{
  "id": "...",
  "key": "submissions/...",
  "url": "/uploads/...",
  "originalName": "report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 12345,
  "purpose": "SUBMISSION"
}
```

---

## 3. Assignment Submission Pattern (Phase 1F-B)

| Item | Contract |
|------|----------|
| Upload | `POST /api/assignments/:id/submission` multipart `file` |
| Read meta | `GET /api/assignments/:id/submission` |
| Teacher list | `GET /api/assignments/:id/submissions` |
| Download | `GET /api/submissions/:id/file` (auth stream) |
| Storage key | Relative key in private root — never absolute path |
| Public `/uploads` | Not used for private submissions |

---

## 4. Download

- Authenticated stream by `submissionId` only.  
- Never `?path=` filesystem access.  
- Future: signed URL for cloud adapters without changing DB metadata.

---

## 5. Assignment Deadline Interaction

If purpose is `SUBMISSION` and assignment deadline passed → **`400`** with submission-closed message; do not store the file.
