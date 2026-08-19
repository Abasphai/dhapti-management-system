import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Vote } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { CardGridSkeleton } from "@/components/common/TableSkeleton";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import {
  electionStatusBadge,
  formatElectionDate,
  type ElectionCandidate,
  type ElectionPosition,
  type ElectionSummary,
  type ResultsPayload,
} from "@/lib/elections";
import { cn } from "@/lib/utils";

const PROFILE_PLACEHOLDER = "/images/profile-user.jpg";

export function StudentElectionsPage() {
  const [rows, setRows] = useState<ElectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ElectionSummary | null>(null);
  const [ballotOpen, setBallotOpen] = useState(false);
  const [canVote, setCanVote] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: ElectionSummary[] }>("/elections?pageSize=50");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load elections");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailError(null);
    setVoteSuccess(false);
    setResults(null);
    try {
      const election = await api<ElectionSummary>(`/elections/${id}`);
      setDetail(election);
      const ballot = await api<{
        canVote: boolean;
        hasVoted: boolean;
        eligible: boolean;
        election: ElectionSummary;
      }>(`/elections/${id}/ballot`);
      setDetail(ballot.election);
      setCanVote(ballot.canVote);
      setSelections({});
      if (ballot.election.resultsVisible) {
        const r = await api<ResultsPayload>(`/elections/${id}/results`);
        setResults(r);
      }
    } catch (err) {
      setDetailError(
        err instanceof ApiError ? err.message : "Failed to load election"
      );
    }
  };

  const positions: ElectionPosition[] = useMemo(
    () => detail?.positions ?? [],
    [detail?.positions]
  );

  const selectedCandidates = useMemo(() => {
    const list: Array<{ position: string; candidate: ElectionCandidate }> = [];
    for (const pos of positions) {
      const cid = selections[pos.id];
      const cand = pos.candidates.find((c) => c.id === cid);
      if (cand) list.push({ position: pos.name, candidate: cand });
    }
    return list;
  }, [positions, selections]);

  const allSelected =
    positions.length > 0 &&
    positions.every((p) => Boolean(selections[p.id]));

  async function submitVote() {
    if (!selectedId || !allSelected) return;
    setSubmitting(true);
    setDetailError(null);
    try {
      await api<{ success: boolean }>(`/elections/${selectedId}/vote`, {
        method: "POST",
        body: JSON.stringify({
          selections: Object.entries(selections).map(([positionId, candidateId]) => ({
            positionId,
            candidateId,
          })),
        }),
      });
      setVoteSuccess(true);
      toast.success("Your secret ballot vote has been cast!");
      setConfirmOpen(false);
      setBallotOpen(false);
      setCanVote(false);
      await openDetail(selectedId);
      await load();
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
    } catch (err) {
      setDetailError(
        err instanceof ApiError ? err.message : "Failed to submit vote"
      );
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Elections"
        description="View university elections, cast your ballot, and see results when available."
      />

      {loading && <CardGridSkeleton count={2} />}

      {!loading && error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={Vote}
          title="No Active Elections"
          description="There are no open ballots right now. Check back when the university announces the next election cycle."
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="border-[#E5EBF3]">
              <CardHeader className="space-y-2 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-[#002147]">{row.title}</h3>
                  <Badge variant={electionStatusBadge(row.status)}>{row.status}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {row.description || "University election"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  <p>Opens: {formatElectionDate(row.startsAt)}</p>
                  <p>Closes: {formatElectionDate(row.endsAt)}</p>
                </div>
                {row.hasVoted && (
                  <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Vote submitted
                  </p>
                )}
                {row.eligible === false && (
                  <p className="text-xs text-amber-700">
                    You are not eligible to vote in this election.
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openDetail(row.id)}
                  className="w-full"
                >
                  {row.votingOpen && row.eligible && !row.hasVoted
                    ? "Vote Now"
                    : "View details"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
            setBallotOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? "Election"}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${formatElectionDate(detail.startsAt)} – ${formatElectionDate(detail.endsAt)}`
                : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {detailError && (
            <p className="text-sm text-red-600">{detailError}</p>
          )}

          {voteSuccess && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Your vote has been recorded successfully.
            </p>
          )}

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={electionStatusBadge(detail.status)}>
                  {detail.status}
                </Badge>
                {detail.hasVoted && (
                  <Badge variant="success">Vote Submitted</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {detail.description || "No description provided."}
              </p>

              {!ballotOpen && (
                <div className="space-y-3">
                  {positions.map((pos) => (
                    <div key={pos.id}>
                      <p className="mb-2 text-sm font-semibold text-[#002147]">
                        {pos.name}
                      </p>
                      <div className="space-y-2">
                        {pos.candidates.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No candidates have been added yet.
                          </p>
                        )}
                        {pos.candidates.map((c) => (
                          <CandidateRow key={c.id} candidate={c} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {ballotOpen && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-[#002147]">
                    Select exactly one candidate for each position.
                  </p>
                  {positions.map((pos) => (
                    <div key={pos.id} className="space-y-2">
                      <p className="text-sm font-semibold">{pos.name}</p>
                      {pos.candidates.map((c) => (
                        <label
                          key={c.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                            selections[pos.id] === c.id
                              ? "border-[color:var(--portal-accent)] bg-[#F4F7FB]"
                              : "border-[#E5EBF3]"
                          )}
                        >
                          <input
                            type="radio"
                            name={pos.id}
                            className="mt-1"
                            checked={selections[pos.id] === c.id}
                            onChange={() =>
                              setSelections((prev) => ({
                                ...prev,
                                [pos.id]: c.id,
                              }))
                            }
                          />
                          <CandidateRow candidate={c} compact />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {results?.visible && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-bold text-[#002147]">Results</p>
                  <p className="text-xs text-muted-foreground">
                    Participation: {results.participationPercentage}% (
                    {results.totalVoters}/{results.eligibleVoters})
                  </p>
                  {results.positions.map((pos) => (
                    <div key={pos.positionId} className="space-y-2">
                      <p className="text-sm font-semibold">
                        {pos.positionName}
                        {pos.tied ? " — Tie" : ""}
                      </p>
                      {pos.candidates.map((c) => (
                        <div key={c.candidateId} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{c.displayName}</span>
                            <span>
                              {c.voteCount} ({c.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#E5EBF3]">
                            <div
                              className="h-2 rounded-full bg-[#002147]"
                              style={{ width: `${Math.min(100, c.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {detail.resultsVisible === false && detail.status === "OPEN" && (
                <p className="text-xs text-muted-foreground">
                  Results will be available after the election closes.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {canVote && !ballotOpen && (
              <Button type="button" onClick={() => setBallotOpen(true)}>
                <Vote className="mr-2 h-4 w-4" />
                Vote Now
              </Button>
            )}
            {ballotOpen && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBallotOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!allSelected}
                  onClick={() => setConfirmOpen(true)}
                >
                  Review & submit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your vote</DialogTitle>
            <DialogDescription>
              You are about to submit your vote. Votes cannot be changed after
              submission.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {selectedCandidates.map(({ position, candidate }) => (
              <li key={position}>
                <span className="font-semibold">{position}:</span>{" "}
                {candidate.displayName}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void submitVote()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CandidateRow({
  candidate,
  compact,
}: {
  candidate: ElectionCandidate;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex gap-3", compact && "flex-1")}>
      <img
        src={candidate.photoUrl || PROFILE_PLACEHOLDER}
        alt=""
        className="h-12 w-12 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#002147]">
          {candidate.displayName}
        </p>
        {(candidate.faculty || candidate.department) && (
          <p className="text-[11px] text-muted-foreground">
            {[candidate.faculty?.name, candidate.department?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {!compact && candidate.manifesto && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {candidate.manifesto}
          </p>
        )}
      </div>
    </div>
  );
}

/** Backward-compatible export name */
export { StudentElectionsPage as StudentElectionPage };
