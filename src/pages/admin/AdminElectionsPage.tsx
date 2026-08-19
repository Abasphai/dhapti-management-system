import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  CheckCircle2,
  Eye,
  Loader2,
  Lock,
  Plus,
  Send,
  Trophy,
  Vote,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import {
  electionStatusBadge,
  formatElectionDate,
  type ElectionSummary,
  type ResultsPayload,
} from "@/lib/elections";

interface StudentOption {
  id: string;
  fullName: string;
  studentCode: string;
  status: string;
}

export function AdminElectionsPage() {
  const [rows, setRows] = useState<ElectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ElectionSummary | null>(null);
  const [stats, setStats] = useState<ResultsPayload | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [visibility, setVisibility] = useState("AFTER_CLOSED");
  const [creating, setCreating] = useState(false);

  const [positionName, setPositionName] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [candidateStudentId, setCandidateStudentId] = useState("");
  const [candidatePositionId, setCandidatePositionId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "15",
      });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);
      const res = await api<{
        data: ElectionSummary[];
        pagination: { totalPages: number };
      }>(`/elections?${params}`);
      setRows(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load elections");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api<{ data: StudentOption[] }>("/students?pageSize=100&status=ACTIVE")
      .then((res) => setStudents(res.data))
      .catch(() => setStudents([]));
  }, []);

  async function openDetail(id: string) {
    setDetailId(id);
    setDetailError(null);
    try {
      const election = await api<ElectionSummary>(`/elections/${id}`);
      setDetail(election);
      const st = await api<ResultsPayload & { election?: ElectionSummary }>(
        `/elections/${id}/statistics`
      );
      setStats(st);
      if (st.election) setDetail(st.election);
    } catch (err) {
      setDetailError(
        err instanceof ApiError ? err.message : "Failed to load election"
      );
    }
  }

  async function createElection(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await api<ElectionSummary>("/elections", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          resultVisibility: visibility,
        }),
      });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      await load();
      await openDetail(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(path: string) {
    if (!detailId) return;
    setActionLoading(true);
    setDetailError(null);
    try {
      await api(`/elections/${detailId}/${path}`, { method: "POST" });
      await openDetail(detailId);
      await load();
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function addPosition() {
    if (!detailId || !positionName.trim()) return;
    setActionLoading(true);
    setDetailError(null);
    try {
      await api(`/elections/${detailId}/positions`, {
        method: "POST",
        body: JSON.stringify({ name: positionName.trim() }),
      });
      setPositionName("");
      await openDetail(detailId);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to add position");
    } finally {
      setActionLoading(false);
    }
  }

  async function addCandidate() {
    if (!candidatePositionId || !candidateStudentId) return;
    setActionLoading(true);
    setDetailError(null);
    try {
      await api(`/elections/positions/${candidatePositionId}/candidates`, {
        method: "POST",
        body: JSON.stringify({ studentId: candidateStudentId }),
      });
      setCandidateStudentId("");
      if (detailId) await openDetail(detailId);
    } catch (err) {
      setDetailError(
        err instanceof ApiError ? err.message : "Failed to add candidate"
      );
    } finally {
      setActionLoading(false);
    }
  }

  const locked =
    detail?.status === "OPEN" ||
    detail?.status === "CLOSED" ||
    detail?.status === "FINALIZED" ||
    detail?.status === "ARCHIVED";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#002147]">Elections</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage university student elections.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Election
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search elections…"
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="FINALIZED">Finalized</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      )}

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

      {!loading && !error && (
        <Card className="border-[#E5EBF3]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Participation</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No elections found.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-[#002147]">
                      {row.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={electionStatusBadge(row.status)}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatElectionDate(row.startsAt)}
                      <br />
                      {formatElectionDate(row.endsAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.totalVoters ?? 0}/{row.eligibleVoters ?? 0} (
                      {row.participationPercentage ?? 0}%)
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openDetail(row.id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create election</DialogTitle>
            <DialogDescription>
              Configure the election window and result visibility.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void createElection(e)} className="space-y-3">
            <Input
              required
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold">Starts at</label>
                <Input
                  required
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Ends at</label>
                <Input
                  required
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue placeholder="Result visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIDDEN">Hidden</SelectItem>
                <SelectItem value="LIVE">Live</SelectItem>
                <SelectItem value="AFTER_CLOSED">After closed</SelectItem>
                <SelectItem value="AFTER_FINALIZED">After finalized</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailId}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetail(null);
            setStats(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? "Election"}</DialogTitle>
            <DialogDescription>
              Lifecycle, ballot structure, and aggregate statistics.
            </DialogDescription>
          </DialogHeader>

          {detailError && <p className="text-sm text-red-600">{detailError}</p>}

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={electionStatusBadge(detail.status)}>
                  {detail.status}
                </Badge>
                <Badge variant="secondary">{detail.resultVisibility}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  icon={Vote}
                  label="Eligible"
                  value={String(detail.eligibleVoters ?? 0)}
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Voters"
                  value={String(detail.totalVoters ?? 0)}
                />
                <StatCard
                  icon={Trophy}
                  label="Participation"
                  value={`${detail.participationPercentage ?? 0}%`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {detail.status === "DRAFT" && (
                  <Button
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => void runAction("publish")}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    Publish
                  </Button>
                )}
                {detail.status === "PUBLISHED" && (
                  <Button
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => void runAction("open")}
                  >
                    Open voting
                  </Button>
                )}
                {detail.status === "OPEN" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => void runAction("close")}
                  >
                    <Lock className="mr-1 h-3.5 w-3.5" />
                    Close
                  </Button>
                )}
                {detail.status === "CLOSED" && (
                  <Button
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => void runAction("finalize")}
                  >
                    Finalize
                  </Button>
                )}
                {detail.status === "FINALIZED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => void runAction("archive")}
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" />
                    Archive
                  </Button>
                )}
              </div>

              {!locked && (
                <Card className="border-[#E5EBF3]">
                  <CardHeader className="pb-2 text-sm font-bold">
                    Ballot setup
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Position name (e.g. President)"
                        value={positionName}
                        onChange={(e) => setPositionName(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void addPosition()}
                      >
                        Add position
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={candidatePositionId}
                        onValueChange={setCandidatePositionId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Position" />
                        </SelectTrigger>
                        <SelectContent>
                          {(detail.positions ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={candidateStudentId}
                        onValueChange={setCandidateStudentId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Student" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.fullName} ({s.studentCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" onClick={() => void addCandidate()}>
                        Add candidate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {(detail.positions ?? []).map((pos) => (
                  <div key={pos.id} className="rounded-xl border border-[#E5EBF3] p-3">
                    <p className="font-semibold text-[#002147]">{pos.name}</p>
                    {pos.candidates.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No candidates have been added yet.
                      </p>
                    )}
                    <ul className="mt-2 space-y-1 text-sm">
                      {pos.candidates.map((c) => (
                        <li key={c.id}>
                          {c.displayName}
                          {c.studentCode ? ` · ${c.studentCode}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {stats?.visible && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-sm font-bold">Aggregate results</p>
                  {stats.positions.map((pos) => (
                    <div key={pos.positionId}>
                      <p className="text-sm font-semibold">
                        {pos.positionName}
                        {pos.tied ? " — Tie (admin resolution required)" : ""}
                      </p>
                      {pos.candidates.map((c) => (
                        <p key={c.candidateId} className="text-xs text-muted-foreground">
                          #{c.rank} {c.displayName}: {c.voteCount} ({c.percentage}%)
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Vote;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5EBF3] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-bold text-[#002147]">{value}</p>
    </div>
  );
}
