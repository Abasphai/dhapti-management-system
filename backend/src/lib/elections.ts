import type {
  Election,
  ElectionEligibilityMode,
  ElectionResultVisibility,
  ElectionStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "./prisma.js";
import { createNotification } from "./notifications.js";

export const ELECTION_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["OPEN", "DRAFT"],
  OPEN: ["CLOSED"],
  CLOSED: ["FINALIZED"],
  FINALIZED: ["ARCHIVED"],
  ARCHIVED: [],
};

/** Ballot structure locked once voting has started. */
export function isBallotLocked(status: ElectionStatus) {
  return (
    status === "OPEN" ||
    status === "CLOSED" ||
    status === "FINALIZED" ||
    status === "ARCHIVED"
  );
}

export function canEditElectionMeta(status: ElectionStatus) {
  return status === "DRAFT" || status === "PUBLISHED";
}

export async function writeElectionAudit(input: {
  electionId: string;
  actorUserId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.electionAuditLog.create({
    data: {
      electionId: input.electionId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function resolveEligibleUserIds(
  election: Pick<Election, "id" | "eligibilityMode">
): Promise<string[]> {
  if (election.eligibilityMode === "SELECTED_STUDENTS") {
    const rows = await prisma.electionVoterEligibility.findMany({
      where: {
        electionId: election.id,
        user: { role: "STUDENT", status: "ACTIVE" },
      },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  const users = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function isUserEligibleToVote(
  election: Pick<Election, "id" | "eligibilityMode">,
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.role !== "STUDENT" || user.status !== "ACTIVE") {
    return false;
  }

  if (election.eligibilityMode === "ALL_ACTIVE_STUDENTS") {
    return true;
  }

  const row = await prisma.electionVoterEligibility.findUnique({
    where: {
      electionId_userId: { electionId: election.id, userId },
    },
  });
  return !!row;
}

/** Effective status: OPEN past endsAt is treated as CLOSED for API decisions. */
export function effectiveElectionStatus(
  election: Pick<Election, "status" | "endsAt">,
  now = new Date()
): ElectionStatus {
  if (election.status === "OPEN" && election.endsAt.getTime() <= now.getTime()) {
    return "CLOSED";
  }
  return election.status;
}

export function votingWindowOpen(
  election: Pick<Election, "status" | "startsAt" | "endsAt">,
  now = new Date()
) {
  if (election.status !== "OPEN") return false;
  const t = now.getTime();
  return t >= election.startsAt.getTime() && t < election.endsAt.getTime();
}

export function studentsCanSeeResults(
  election: Pick<Election, "status" | "resultVisibility" | "endsAt">,
  now = new Date()
) {
  const status = effectiveElectionStatus(election, now);
  switch (election.resultVisibility) {
    case "HIDDEN":
      return false;
    case "LIVE":
      return (
        status === "OPEN" ||
        status === "CLOSED" ||
        status === "FINALIZED" ||
        status === "ARCHIVED"
      );
    case "AFTER_CLOSED":
      return (
        status === "CLOSED" ||
        status === "FINALIZED" ||
        status === "ARCHIVED"
      );
    case "AFTER_FINALIZED":
      return status === "FINALIZED" || status === "ARCHIVED";
    default:
      return false;
  }
}

export type PositionResults = {
  positionId: string;
  positionName: string;
  totalVotes: number;
  tied: boolean;
  candidates: Array<{
    candidateId: string;
    displayName: string;
    photoUrl: string | null;
    studentCode: string;
    voteCount: number;
    percentage: number;
    rank: number;
  }>;
};

export async function calculateElectionResults(electionId: string): Promise<{
  positions: PositionResults[];
  eligibleVoters: number;
  totalVoters: number;
  participationPercentage: number;
  totalVotes: number;
}> {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
  });

  const eligibleVoters = (await resolveEligibleUserIds(election)).length;

  const positions = await prisma.electionPosition.findMany({
    where: { electionId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      candidates: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
        include: {
          student: { select: { studentCode: true } },
          _count: { select: { votes: true } },
        },
      },
    },
  });

  const voterGroups = await prisma.electionVote.groupBy({
    by: ["voterUserId"],
    where: { electionId },
  });
  const totalVoters = voterGroups.length;

  let totalVotes = 0;
  const positionResults: PositionResults[] = positions.map((pos) => {
    const counts = pos.candidates.map((c) => ({
      candidateId: c.id,
      displayName: c.displayName,
      photoUrl: c.photoUrl,
      studentCode: c.student.studentCode,
      voteCount: c._count.votes,
    }));
    const positionTotal = counts.reduce((s, c) => s + c.voteCount, 0);
    totalVotes += positionTotal;

    const sorted = [...counts].sort((a, b) => b.voteCount - a.voteCount);
    let rank = 0;
    let prev = -1;
    const ranked = sorted.map((c, idx) => {
      if (c.voteCount !== prev) {
        rank = idx + 1;
        prev = c.voteCount;
      }
      const percentage =
        positionTotal === 0
          ? 0
          : Math.round((c.voteCount / positionTotal) * 1000) / 10;
      return { ...c, percentage, rank };
    });

    const top = ranked[0]?.voteCount ?? 0;
    const tied =
      top > 0 && ranked.filter((c) => c.voteCount === top).length > 1;

    return {
      positionId: pos.id,
      positionName: pos.name,
      totalVotes: positionTotal,
      tied,
      candidates: ranked,
    };
  });

  const participationPercentage =
    eligibleVoters === 0
      ? 0
      : Math.round((totalVoters / eligibleVoters) * 1000) / 10;

  return {
    positions: positionResults,
    eligibleVoters,
    totalVoters,
    participationPercentage,
    totalVotes,
  };
}

export async function validateElectionReadyToOpen(electionId: string) {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      positions: {
        include: {
          candidates: { where: { status: "ACTIVE" } },
        },
      },
      _count: { select: { eligibility: true } },
    },
  });
  if (!election) return { ok: false as const, message: "Election not found" };
  if (election.positions.length < 1) {
    return { ok: false as const, message: "At least one position is required" };
  }
  for (const pos of election.positions) {
    if (pos.candidates.length < 1) {
      return {
        ok: false as const,
        message: `Position "${pos.name}" needs at least one active candidate`,
      };
    }
  }
  if (
    election.eligibilityMode === "SELECTED_STUDENTS" &&
    election._count.eligibility < 1
  ) {
    return {
      ok: false as const,
      message: "SELECTED_STUDENTS requires at least one eligible voter",
    };
  }
  if (election.endsAt.getTime() <= Date.now()) {
    return {
      ok: false as const,
      message: "endsAt must be in the future to open voting",
    };
  }
  return { ok: true as const, election };
}

export async function maybeAutoCloseElection(electionId: string) {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.status !== "OPEN") return election;
  if (election.endsAt.getTime() > Date.now()) return election;

  const closed = await prisma.election.update({
    where: { id: electionId },
    data: { status: "CLOSED" },
  });
  await writeElectionAudit({
    electionId,
    action: "ELECTION_AUTO_CLOSED",
    metadata: { reason: "endsAt reached" },
  });
  await notifyElectionLifecycle(closed, "closed").catch(() => {});
  return closed;
}

export async function notifyElectionLifecycle(
  election: Pick<Election, "id" | "title">,
  event: "published" | "opened" | "closed" | "finalized" | "results"
) {
  const titles: Record<typeof event, string> = {
    published: "Election published",
    opened: "Election is open for voting",
    closed: "Election closed",
    finalized: "Election results finalized",
    results: "Election results available",
  };
  const messages: Record<typeof event, string> = {
    published: `"${election.title}" is now visible. Voting has not started yet.`,
    opened: `"${election.title}" is open. Cast your vote before it closes.`,
    closed: `"${election.title}" is closed. Thank you for participating.`,
    finalized: `Official results for "${election.title}" are available.`,
    results: `Results for "${election.title}" are now available.`,
  };

  const full = await prisma.election.findUnique({ where: { id: election.id } });
  if (!full) return;

  const userIds = await resolveEligibleUserIds(full);
  return createNotification({
    type: "ELECTION",
    title: titles[event],
    message: messages[event],
    priority: event === "opened" ? "HIGH" : "NORMAL",
    sourceType: "ELECTION",
    sourceId: election.id,
    dedupeKey: `election.${event}:${election.id}`,
    link: "/student/elections",
    userIds,
  });
}

export type ElectionCreateInput = {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  resultVisibility?: ElectionResultVisibility;
  eligibilityMode?: ElectionEligibilityMode;
  createdById?: string | null;
};

export async function assertDatesValid(startsAt: Date, endsAt: Date) {
  if (!(startsAt.getTime() < endsAt.getTime())) {
    return "startsAt must be before endsAt";
  }
  return null;
}

export const electionListInclude = {
  _count: {
    select: {
      positions: true,
      votes: true,
      eligibility: true,
    },
  },
} satisfies Prisma.ElectionInclude;

export const electionDetailInclude = {
  positions: {
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
    include: {
      candidates: {
        orderBy: [{ sortOrder: "asc" as const }, { displayName: "asc" as const }],
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              profilePhoto: true,
              faculty: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
              user: { select: { status: true } },
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      votes: true,
      eligibility: true,
    },
  },
} satisfies Prisma.ElectionInclude;
