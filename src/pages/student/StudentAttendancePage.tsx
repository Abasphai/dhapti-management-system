import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AttendanceSummary {
  classSectionId: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  academicYear: string;
  semester: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  totalMarked: number;
  totalSessions: number;
  percentage: number | null;
  status: string;
}

interface SessionDetail {
  sessionId: string;
  date: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  status: string;
  attendanceStatus: string;
}

function pctTone(percentage: number | null) {
  if (percentage == null) return "text-muted-foreground";
  return percentage >= 75 ? "text-[#16a34a]" : "text-red-600";
}

function statusBadgeVariant(
  status: string
): "success" | "warning" | "danger" | "secondary" | "info" {
  if (status === "PRESENT") return "success";
  if (status === "LATE") return "warning";
  if (status === "ABSENT") return "danger";
  if (status === "EXCUSED") return "info";
  return "secondary";
}

function labelStatus(status: string) {
  if (!status) return "—";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function StudentAttendancePage() {
  const [rows, setRows] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<AttendanceSummary | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: AttendanceSummary[] }>(
        "/students/me/attendance"
      );
      setRows(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load attendance"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overall = useMemo(() => {
    const present = rows.reduce((s, r) => s + r.present, 0);
    const late = rows.reduce((s, r) => s + r.late, 0);
    const absent = rows.reduce((s, r) => s + r.absent, 0);
    const excused = rows.reduce((s, r) => s + r.excused, 0);
    const totalSessions = rows.reduce((s, r) => s + r.totalSessions, 0);
    const withPct = rows.filter((r) => r.percentage != null);
    const avg =
      withPct.length === 0
        ? null
        : Math.round(
            withPct.reduce((s, r) => s + (r.percentage ?? 0), 0) / withPct.length
          );
    return { present, late, absent, excused, totalSessions, avg };
  }, [rows]);

  const openDetail = async (row: AttendanceSummary) => {
    setSelected(row);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setSessions([]);
    try {
      const res = await api<{
        classSection: AttendanceSummary;
        data: SessionDetail[];
      }>(`/students/me/attendance/${row.classSectionId}`);
      setSelected(res.classSection);
      setSessions(res.data);
    } catch (err) {
      setDetailError(
        err instanceof ApiError
          ? err.message
          : "Failed to load session details"
      );
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Attendance"
        description="Course-wise attendance summary for your active enrollments."
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Attendance
            </p>
            <p className={cn("mt-2 text-3xl font-bold", pctTone(overall.avg))}>
              {loading ? "…" : overall.avg == null ? "—" : `${overall.avg}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Present / Late
            </p>
            <p className="mt-2 text-3xl font-bold text-[#002147]">
              {loading ? "…" : overall.present + overall.late}
              <span className="text-base font-medium text-muted-foreground">
                /{overall.totalSessions}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#002147]/10 text-[#002147]">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Absences
              </p>
              <p className="mt-1 text-2xl font-bold text-[#E85D04]">
                {loading ? "…" : overall.absent}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="border-b border-[#E5EBF3] pb-4">
          <h2 className="text-lg font-bold text-[#002147]">
            Course-wise Summary
          </h2>
          <p className="text-sm text-muted-foreground">
            Click a row for session-level detail. Green ≥75%; red below threshold.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="px-6 text-[11px] font-bold uppercase tracking-wider">
                  Course
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Sessions
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Present
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Late
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Absent
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Excused
                </TableHead>
                <TableHead className="px-6 text-right text-[11px] font-bold uppercase tracking-wider">
                  Percentage
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading attendance…
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No attendance records yet for your active courses.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((row) => {
                  const ok =
                    row.percentage == null ? true : row.percentage >= 75;
                  return (
                    <TableRow
                      key={row.classSectionId}
                      className="cursor-pointer hover:bg-[#F4F7FB]/60"
                      onClick={() => void openDetail(row)}
                    >
                      <TableCell className="px-6">
                        <p className="font-semibold text-[#002147]">
                          {row.courseTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.courseCode} · Sec {row.section}
                          {row.teacherName ? ` · ${row.teacherName}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="font-medium text-[#002147]">
                        {row.totalSessions}
                      </TableCell>
                      <TableCell className="font-semibold text-[#16a34a]">
                        {row.present}
                      </TableCell>
                      <TableCell className="font-semibold text-[#E85D04]">
                        {row.late}
                      </TableCell>
                      <TableCell className="font-semibold text-red-600">
                        {row.absent}
                      </TableCell>
                      <TableCell className="font-medium text-[#002147]">
                        {row.excused}
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Badge
                          className={cn(
                            "min-w-[3.5rem] justify-center font-bold",
                            row.percentage == null
                              ? "border-transparent bg-[#F4F7FB] text-muted-foreground"
                              : ok
                                ? "border-transparent bg-[#16a34a]/15 text-[#16a34a]"
                                : "border-transparent bg-red-500/15 text-red-600"
                          )}
                        >
                          {row.percentage == null ? "—" : `${row.percentage}%`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session attendance</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.courseCode} — ${selected.courseTitle} · Sec ${selected.section}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success">{selected.present} Present</Badge>
              <Badge variant="warning">{selected.late} Late</Badge>
              <Badge variant="danger">{selected.absent} Absent</Badge>
              <Badge variant="secondary">{selected.excused} Excused</Badge>
              <Badge variant="info">
                {selected.percentage == null
                  ? "—"
                  : `${selected.percentage}%`}
              </Badge>
            </div>
          )}

          {detailError && (
            <p className="text-sm text-red-600">
              {detailError}{" "}
              {selected && (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => void openDetail(selected)}
                >
                  Retry
                </Button>
              )}
            </p>
          )}

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Your mark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No sessions recorded for this class yet.
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((s) => (
                  <TableRow key={s.sessionId}>
                    <TableCell className="font-medium text-[#002147]">
                      {s.date}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.scheduledStartTime && s.scheduledEndTime
                        ? `${s.scheduledStartTime}–${s.scheduledEndTime}`
                        : s.scheduledStartTime || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={statusBadgeVariant(s.attendanceStatus)}>
                        {labelStatus(s.attendanceStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
