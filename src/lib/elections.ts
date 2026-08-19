export type ElectionStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "OPEN"
  | "CLOSED"
  | "FINALIZED"
  | "ARCHIVED";

export type ResultVisibility =
  | "HIDDEN"
  | "LIVE"
  | "AFTER_CLOSED"
  | "AFTER_FINALIZED";

export interface ElectionCandidate {
  id: string;
  positionId: string;
  studentId: string;
  displayName: string;
  photoUrl: string | null;
  manifesto: string | null;
  biography: string | null;
  status: string;
  studentCode: string | null;
  faculty: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
}

export interface ElectionPosition {
  id: string;
  electionId: string;
  name: string;
  description: string | null;
  maxSelections: number;
  candidates: ElectionCandidate[];
}

export interface ElectionSummary {
  id: string;
  title: string;
  description: string | null;
  status: ElectionStatus;
  startsAt: string;
  endsAt: string;
  resultVisibility: ResultVisibility;
  eligibilityMode: string;
  eligibleVoters?: number;
  totalVoters?: number;
  participationPercentage?: number;
  hasVoted?: boolean;
  eligible?: boolean;
  resultsVisible?: boolean;
  votingOpen?: boolean;
  positionCount?: number;
  positions?: ElectionPosition[];
}

export interface ResultsPayload {
  visible: boolean;
  message: string | null;
  eligibleVoters: number | null;
  totalVoters: number | null;
  participationPercentage: number | null;
  totalVotes: number | null;
  positions: Array<{
    positionId: string;
    positionName: string;
    totalVotes: number;
    tied: boolean;
    candidates: Array<{
      candidateId: string;
      displayName: string;
      photoUrl: string | null;
      voteCount: number;
      percentage: number;
      rank: number;
    }>;
  }>;
}

export function electionStatusBadge(
  status: ElectionStatus
): "success" | "warning" | "secondary" | "info" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "PUBLISHED") return "info";
  if (status === "CLOSED") return "warning";
  if (status === "FINALIZED") return "secondary";
  if (status === "ARCHIVED") return "secondary";
  return "secondary";
}

export function formatElectionDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
