import type {
  Election,
  ElectionCandidate,
  ElectionCandidateStatus,
  ElectionEligibilityMode,
  ElectionPosition,
  ElectionResultVisibility,
  ElectionStatus,
} from "@prisma/client";

import {
  effectiveElectionStatus,
  studentsCanSeeResults,
  type PositionResults,
} from "./elections.js";

type CandidateStudent = {
  id: string;
  studentCode: string;
  fullName: string;
  profilePhoto: string | null;
  faculty: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  user: { status: string };
};

export function serializeCandidate(
  c: ElectionCandidate & { student?: CandidateStudent },
  opts?: { includeVotes?: boolean; voteCount?: number }
) {
  return {
    id: c.id,
    positionId: c.positionId,
    studentId: c.studentId,
    displayName: c.displayName,
    photoUrl: c.photoUrl ?? c.student?.profilePhoto ?? null,
    manifesto: c.manifesto,
    biography: c.biography,
    status: c.status as ElectionCandidateStatus,
    sortOrder: c.sortOrder,
    studentCode: c.student?.studentCode ?? null,
    faculty: c.student?.faculty ?? null,
    department: c.student?.department ?? null,
    createdAt: c.createdAt.toISOString(),
    ...(opts?.includeVotes ? { voteCount: opts.voteCount ?? 0 } : {}),
  };
}

export function serializePosition(
  p: ElectionPosition & {
    candidates?: (ElectionCandidate & { student?: CandidateStudent })[];
  }
) {
  return {
    id: p.id,
    electionId: p.electionId,
    name: p.name,
    description: p.description,
    maxSelections: p.maxSelections,
    sortOrder: p.sortOrder,
    candidates: (p.candidates ?? []).map((c) => serializeCandidate(c)),
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeElectionSummary(
  e: Election & {
    _count?: { positions?: number; votes?: number; eligibility?: number };
  },
  extras?: {
    eligibleVoters?: number;
    totalVoters?: number;
    participationPercentage?: number;
    hasVoted?: boolean;
    eligible?: boolean;
  }
) {
  const status = effectiveElectionStatus(e);
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    status,
    storedStatus: e.status as ElectionStatus,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    resultVisibility: e.resultVisibility as ElectionResultVisibility,
    eligibilityMode: e.eligibilityMode as ElectionEligibilityMode,
    positionCount: e._count?.positions ?? undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    resultsVisible: studentsCanSeeResults(e),
    votingOpen: status === "OPEN" && e.endsAt.getTime() > Date.now(),
    ...extras,
  };
}

export function serializeElectionDetail(
  e: Election & {
    positions: (ElectionPosition & {
      candidates: (ElectionCandidate & { student?: CandidateStudent })[];
    })[];
    _count?: { votes?: number; eligibility?: number };
  },
  extras?: {
    eligibleVoters?: number;
    totalVoters?: number;
    participationPercentage?: number;
    hasVoted?: boolean;
    eligible?: boolean;
  }
) {
  return {
    ...serializeElectionSummary(e, extras),
    positions: e.positions.map((p) => serializePosition(p)),
  };
}

export function serializeResultsPayload(
  stats: {
    positions: PositionResults[];
    eligibleVoters: number;
    totalVoters: number;
    participationPercentage: number;
    totalVotes: number;
  },
  opts: { includeCounts: boolean }
) {
  if (!opts.includeCounts) {
    return {
      visible: false,
      message: "Results are not available yet.",
      eligibleVoters: null,
      totalVoters: null,
      participationPercentage: null,
      totalVotes: null,
      positions: [],
    };
  }
  return {
    visible: true,
    message: null,
    eligibleVoters: stats.eligibleVoters,
    totalVoters: stats.totalVoters,
    participationPercentage: stats.participationPercentage,
    totalVotes: stats.totalVotes,
    positions: stats.positions.map((p) => ({
      positionId: p.positionId,
      positionName: p.positionName,
      totalVotes: p.totalVotes,
      tied: p.tied,
      candidates: p.candidates.map((c) => ({
        candidateId: c.candidateId,
        displayName: c.displayName,
        photoUrl: c.photoUrl,
        studentCode: c.studentCode,
        voteCount: c.voteCount,
        percentage: c.percentage,
        rank: c.rank,
      })),
    })),
  };
}

/** Audit log — never includes candidate choices. */
export function serializeAuditLog(row: {
  id: string;
  electionId: string;
  actorUserId: string | null;
  action: string;
  metadataJson: string | null;
  createdAt: Date;
}) {
  let metadata: unknown = null;
  if (row.metadataJson) {
    try {
      metadata = JSON.parse(row.metadataJson);
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    electionId: row.electionId,
    actorUserId: row.actorUserId,
    action: row.action,
    metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
