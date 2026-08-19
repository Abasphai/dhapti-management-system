import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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

interface ResultRow {
  id: string;
  studentCode: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  academicYear: string;
  semester: string;
  marks: number | null;
  creditHours: number;
  letterGradeDisplay: string;
  gradePointDisplay: string;
  status: string;
  teacherName: string;
  returnReason: string | null;
  componentDisplay?: {
    midterm: string;
    finalExam: string;
    assignment: string;
    quiz: string;
    presentation: string;
    attendance: string;
  } | null;
}

export function AdminCourseResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);
      const res = await api<{
        data: ResultRow[];
        pagination: { totalPages: number };
      }>(`/results?${params}`);
      setRows(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/results/${id}/approve`, { method: "POST" });
      await load();
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function returnResult() {
    if (!returnId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/results/${returnId}/return`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReturnId(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Return failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002147]">Course Results</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve ClassSection final results. Assessment grading remains
          under Grade Review.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search student or course…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="RETURNED">Returned</SelectItem>
            <SelectItem value="CALCULATED">Calculated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="flex justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#E5EBF3]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Components</TableHead>
                <TableHead>Letter / GP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No course results found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4">
                      <p className="font-semibold">{row.studentName}</p>
                      <p className="text-xs text-muted-foreground">{row.studentCode}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {row.courseCode} · Sec {row.section}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.academicYear} S{row.semester} · {row.teacherName}
                      </p>
                    </TableCell>
                    <TableCell>
                      {row.marks != null ? `${row.marks}` : "—"} ({row.creditHours} cr)
                    </TableCell>
                    <TableCell className="max-w-[180px] text-[11px] text-muted-foreground">
                      {row.componentDisplay ? (
                        <>
                          {row.componentDisplay.midterm} ·{" "}
                          {row.componentDisplay.finalExam} ·{" "}
                          {row.componentDisplay.assignment} ·{" "}
                          {row.componentDisplay.quiz} ·{" "}
                          {row.componentDisplay.presentation} ·{" "}
                          {row.componentDisplay.attendance}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.letterGradeDisplay} / {row.gradePointDisplay}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      {row.status === "PENDING_APPROVAL" && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void approve(row.id)}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setReturnId(row.id)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
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
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={!!returnId} onOpenChange={(o) => !o && setReturnId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject course result</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Reason for teacher correction"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReturnId(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void returnResult()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
