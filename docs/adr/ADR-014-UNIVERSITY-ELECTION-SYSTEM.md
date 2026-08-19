# ADR-014 — University Election System (Phase 1J)

**Status:** Accepted  
**Date:** 2026-08-05  
**Phase:** 1J  

## Context

Stub models existed (`Election`, flat `ElectionCandidate`, `VoteBallot` with HMAC `choiceHash`, `VoteTally`). They lacked positions, student-linked candidates, lifecycle states, result visibility, eligibility, and audit. Phase 1J replaces the stub with a production-ready election domain while reusing Phase 1I notifications.

## Decisions

### 1. Domain shape
`Election` → `ElectionPosition` → `ElectionCandidate` (→ `Student`)  
`ElectionVoterEligibility` (for SELECTED_STUDENTS)  
`ElectionVote` (one row per position per voter)  
`ElectionAuditLog` (append-only)

Removed stub `VoteBallot` / `VoteTally`. Tallies are aggregated from `ElectionVote` at read time.

### 2. Lifecycle
`DRAFT → PUBLISHED → OPEN → CLOSED → FINALIZED → ARCHIVED`  
Server validates transitions. Ballot structure (positions, candidates, eligibility) locks at OPEN.

### 3. One person, one vote
Unique `(electionId, voterUserId, positionId)`. Complete ballot required (every position exactly one selection). JWT `userId` is the only voter identity; client `studentId`/`voterUserId` ignored.

### 4. Secret-ballot policy
`ElectionVote` stores `candidateId` + `voterUserId` for uniqueness and aggregation. Ordinary serializers and Admin UI expose **aggregates only** — never “Student X voted for Candidate Y”. `VOTE_CAST` audit logs omit candidate IDs. Stronger cryptographic anonymity deferred.

### 5. Result visibility
Enum: `HIDDEN | LIVE | AFTER_CLOSED | AFTER_FINALIZED`. Enforced server-side for students; Admin always sees statistics.

### 6. Time authority
Server clock gates voting (`startsAt`/`endsAt`). OPEN past `endsAt` auto-closes on access. Client countdown is UX-only.

### 7. Eligibility
`ALL_ACTIVE_STUDENTS` (default) or `SELECTED_STUDENTS` via eligibility table. Teachers do not vote.

### 8. Notifications
Reuse `backend/src/lib/notifications.ts` with `dedupeKey` e.g. `election.opened:{id}`. No second notification system.

### 9. Immutability
No student PATCH/DELETE vote. No admin vote correction in 1J. Ties reported, not auto-broken.

## Consequences
- Portals: `/admin/elections`, `/student/elections`  
- Permissions: `elections.manage`, `elections.vote`, `elections.read`, `elections.results.read`, `elections.audit.read`

## Non-goals
Ranked-choice, teacher voting, vote correction, blockchain, GPA/transcript, email/SMS/push, Faculty/Department targeting beyond future eligibility hooks.
