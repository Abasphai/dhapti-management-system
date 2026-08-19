import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
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

type SessionAccountStatus =
  | "SCHEDULED"
  | "OPEN"
  | "COMPLETED"
  | "CANCELLED";

type MarkStatus = "UNMARKED" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
type WritableMark = Exclude<MarkStatus, "UNMARKED">;

interface ClassSectionBrief {
  id: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  room: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string;
  semester: string;
}

interface Session {
  id: string;
  accountStatus: SessionAccountStatus;
  actualStartTime: string | null;
  actualEndTime: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  date: string;
  teacherAttendanceStatus?: string;
  teacherAttendance?: {
    startedAt: string;
    endedAt: string | null;
  } | null;
  markedCount?: number;
}

interface SessionRow {
  classSection: ClassSectionBrief;
  session: Session | null;
}

interface AttendanceRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  status: MarkStatus;
  attendanceId: string | null;
  markedAt: string | null;
}

const MARK_OPTIONS: WritableMark[] = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
];

const statusStyles: Record<WritableMark, string> = {
  PRESENT:
    "border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a] data-[active=true]:bg-[#16a34a] data-[active=true]:text-white",
  LATE: "border-[#E85D04]/30 bg-[#E85D04]/10 text-[#E85D04] data-[active=true]:bg-[#E85D04] data-[active=true]:text-white",
  ABSENT:
    "border-red-200 bg-red-50 text-red-600 data-[active=true]:bg-red-600 data-[active=true]:text-white",
  EXCUSED:
    "border-[#002147]/20 bg-[#002147]/5 text-[#002147] data-[active=true]:bg-[#002147] data-[active=true]:text-white",
};

function todayISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSchedule(cs: ClassSectionBrief) {
  const day = cs.dayOfWeek || "";
  const range =
    cs.startTime && cs.endTime
      ? `${cs.startTime}–${cs.endTime}`
      : cs.startTime || cs.endTime || "";
  if (day && range) return `${day} · ${range}`;
  return day || range || "Schedule not set";
}

function sessionBadgeVariant(
  status: SessionAccountStatus | null
): "secondary" | "warning" | "success" | "danger" | "info" {
  if (status === "OPEN") return "success";
  if (status === "COMPLETED") return "info";
  if (status === "CANCELLED") return "danger";
  if (status === "SCHEDULED") return "warning";
  return "secondary";
}

function markLabel(status: MarkStatus) {
  if (status === "UNMARKED") return "Unmarked";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export type TeacherAttendanceMode = "self" | "students" | "all";

export function TeacherAttendancePage({
  mode = "all",
}: {
  mode?: TeacherAttendanceMode;
}) {
  const isSelf = mode === "self";
  const isStudents = mode === "students";
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReadOnly, setDialogReadOnly] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeClass, setActiveClass] = useState<ClassSectionBrief | null>(null);
  const [roster, setRoster] = useState<AttendanceRow[]>([]);
  const [draft, setDraft] = useState<Record<string, MarkStatus>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyTarget, setEarlyTarget] = useState<{
    sessionId: string;
    classSectionId: string;
    completedMinutes: number;
    requiredMinutes: number;
  } | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: SessionRow[]; date: string }>(
        `/teachers/me/sessions?date=${encodeURIComponent(date)}`
      );
      setRows(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load sessions"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const openAttendance = async (
    classSection: ClassSectionBrief,
    session: Session,
    readOnly: boolean
  ) => {
    setActiveClass(classSection);
    setActiveSession(session);
    setDialogReadOnly(readOnly);
    setDialogOpen(true);
    setRosterLoading(true);
    setRosterError(null);
    setSuccessMessage(null);
    try {
      const res = await api<{ session: Session; data: AttendanceRow[] }>(
        `/sessions/${session.id}/attendance`
      );
      setActiveSession(res.session);
      setRoster(res.data);
      setDraft(
        Object.fromEntries(res.data.map((r) => [r.studentId, r.status]))
      );
    } catch (err) {
      setRosterError(
        err instanceof ApiError ? err.message : "Failed to load attendance"
      );
      setRoster([]);
      setDraft({});
    } finally {
      setRosterLoading(false);
    }
  };

  const ensureAndStart = async (classSection: ClassSectionBrief) => {
    setActingId(classSection.id);
    setSuccessMessage(null);
    setError(null);
    try {
      const ensured = await api<Session>(
        `/classes/${classSection.id}/sessions/ensure`,
        {
          method: "POST",
          body: JSON.stringify({ date }),
        }
      );
      let session = ensured;
      if (session.accountStatus === "SCHEDULED") {
        session = await api<Session>(`/sessions/${session.id}/start`, {
          method: "POST",
        });
      }
      setSuccessMessage("Class started. You can take attendance now.");
      await loadSessions();
      if (session.accountStatus === "OPEN") {
        await openAttendance(classSection, session, false);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to start class"
      );
    } finally {
      setActingId(null);
    }
  };

  const startSession = async (sessionId: string, classSectionId: string) => {
    setActingId(classSectionId);
    setSuccessMessage(null);
    setError(null);
    try {
      await api<Session>(`/sessions/${sessionId}/start`, { method: "POST" });
      setSuccessMessage("Class started.");
      await loadSessions();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to start class"
      );
    } finally {
      setActingId(null);
    }
  };

  const endSession = async (
    sessionId: string,
    classSectionId: string,
    confirmEarlyExit = false
  ) => {
    setActingId(classSectionId);
    setSuccessMessage(null);
    setError(null);
    try {
      const res = await api<Session & { timerStatus?: string }>(
        `/sessions/${sessionId}/end`,
        {
          method: "POST",
          body: JSON.stringify({ confirmEarlyExit }),
        }
      );
      setEarlyOpen(false);
      setEarlyTarget(null);
      setSuccessMessage(
        res.timerStatus === "EARLY_EXIT"
          ? "Class ended early (EARLY EXIT flagged). Attendance is locked."
          : "Class ended. Attendance is now locked."
      );
      if (activeSession?.id === sessionId) {
        setDialogOpen(false);
      }
      await loadSessions();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "EARLY_EXIT_CONFIRMATION_REQUIRED"
      ) {
        setEarlyTarget({
          sessionId,
          classSectionId,
          completedMinutes: Number(err.details?.completedMinutes ?? 0),
          requiredMinutes: Number(err.details?.requiredMinutes ?? 120),
        });
        setEarlyOpen(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to end class");
      }
    } finally {
      setActingId(null);
    }
  };

  const setStatus = (studentId: string, status: WritableMark) => {
    if (dialogReadOnly) return;
    setDraft((prev) => ({ ...prev, [studentId]: status }));
  };

  const summary = useMemo(() => {
    const values = Object.values(draft);
    return {
      present: values.filter((v) => v === "PRESENT").length,
      late: values.filter((v) => v === "LATE").length,
      absent: values.filter((v) => v === "ABSENT").length,
      excused: values.filter((v) => v === "EXCUSED").length,
      unmarked: values.filter((v) => v === "UNMARKED").length,
    };
  }, [draft]);

  const saveAttendance = async () => {
    if (!activeSession || dialogReadOnly) return;
    if (activeSession.accountStatus !== "OPEN") {
      setRosterError("Attendance can only be saved while the session is OPEN.");
      return;
    }
    const records = roster
      .map((r) => ({
        studentId: r.studentId,
        status: draft[r.studentId] ?? r.status,
      }))
      .filter(
        (r): r is { studentId: string; status: WritableMark } =>
          r.status !== "UNMARKED"
      );
    if (records.length === 0) {
      setRosterError("Mark at least one student before saving.");
      return;
    }
    setSaving(true);
    setRosterError(null);
    try {
      const res = await api<{ session: Session; data: AttendanceRow[] }>(
        `/sessions/${activeSession.id}/attendance/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ records }),
        }
      );
      setActiveSession(res.session);
      setRoster((prev) =>
        prev.map((row) => {
          const updated = res.data.find((d) => d.studentId === row.studentId);
          return updated ?? row;
        })
      );
      setDraft((prev) => {
        const next = { ...prev };
        for (const d of res.data) next[d.studentId] = d.status;
        return next;
      });
      setSuccessMessage(
        `Saved attendance for ${records.length} student${records.length === 1 ? "" : "s"}.`
      );
    } catch (err) {
      setRosterError(
        err instanceof ApiError ? err.message : "Failed to save attendance"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={
          isSelf
            ? "My Attendance (Check-in / Out)"
            : isStudents
              ? "Student Class Attendance"
              : "Mark Attendance"
        }
        description={
          isSelf
            ? "Log your class entry and exit timestamps for today’s assigned sessions."
            : isStudents
              ? "Mark Present, Late, Absent, or Excused for enrolled students (start class first if needed)."
              : "Start class for the selected date, then mark each student Present, Late, Absent, or Excused."
        }
      />

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-[#E5EBF3] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="space-y-1.5 sm:w-64">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date
            </span>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9"
              />
            </div>
          </label>
          <Button
            variant="outline"
            onClick={() => void loadSessions()}
            disabled={loading}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {successMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-[#16a34a]/20 bg-[#16a34a]/10 px-4 py-3 text-sm text-[#16a34a]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMessage}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => void loadSessions()}
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No active classes assigned to you.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rows.map(({ classSection, session }) => {
                const status = session?.accountStatus ?? null;
                const busy = actingId === classSection.id;
                return (
                  <Card
                    key={classSection.id}
                    className="border-[#E5EBF3] shadow-sm"
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#E85D04]">
                            {classSection.courseCode}
                            {classSection.section
                              ? `-${classSection.section}`
                              : ""}
                          </p>
                          <h3 className="mt-1 font-semibold text-[#002147]">
                            {classSection.courseTitle}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Section {classSection.section}
                          </p>
                        </div>
                        <Badge variant={sessionBadgeVariant(status)}>
                          {status ?? "No session"}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {formatSchedule(classSection)}
                        </p>
                        {classSection.room && (
                          <p className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            Room {classSection.room}
                          </p>
                        )}
                        {session?.accountStatus === "OPEN" && (
                          <p className="text-[#16a34a]">
                            Started {formatTime(session.actualStartTime)}
                          </p>
                        )}
                        {session?.accountStatus === "COMPLETED" && (
                          <p>
                            {formatTime(session.actualStartTime)} –{" "}
                            {formatTime(session.actualEndTime)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!session && (
                          <Button
                            disabled={busy}
                            className="bg-[#002147] text-white hover:bg-[#003366]"
                            onClick={() => void ensureAndStart(classSection)}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ClipboardCheck className="h-4 w-4" />
                            )}
                            {isSelf
                              ? "Check In / Start Class"
                              : isStudents
                                ? "Start Session to Mark Students"
                                : "Ensure / Start Class"}
                          </Button>
                        )}
                        {session?.accountStatus === "SCHEDULED" && (
                          <Button
                            disabled={busy}
                            className="bg-[#002147] text-white hover:bg-[#003366]"
                            onClick={() =>
                              void startSession(session.id, classSection.id)
                            }
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {isSelf ? "Check In" : "Start Class"}
                          </Button>
                        )}
                        {session?.accountStatus === "OPEN" && (
                          <>
                            {!isSelf && (
                              <Button
                                className="bg-[#E85D04] text-white hover:bg-[#d45303]"
                                onClick={() =>
                                  void openAttendance(
                                    classSection,
                                    session,
                                    false
                                  )
                                }
                              >
                                <ClipboardCheck className="h-4 w-4" />
                                Mark Students
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void endSession(session.id, classSection.id)
                              }
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              {isSelf ? "Check Out / End Class" : "End Class"}
                            </Button>
                          </>
                        )}
                        {session?.accountStatus === "COMPLETED" && !isSelf && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              void openAttendance(classSection, session, true)
                            }
                          >
                            View Student Attendance
                          </Button>
                        )}
                        {session?.accountStatus === "COMPLETED" && isSelf && (
                          <Badge variant="success">Checked out</Badge>
                        )}
                        {session?.accountStatus === "CANCELLED" && (
                          <p className="text-sm text-muted-foreground">
                            This session was cancelled.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setRosterError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogReadOnly ? "Attendance (view only)" : "Take Attendance"}
            </DialogTitle>
            <DialogDescription>
              {activeClass
                ? `${activeClass.courseCode} — ${activeClass.courseTitle} · Sec ${activeClass.section}`
                : ""}
              {activeSession ? ` · ${activeSession.date}` : ""}
            </DialogDescription>
          </DialogHeader>

          {!rosterLoading && !rosterError && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{summary.present} Present</Badge>
              <Badge variant="warning">{summary.late} Late</Badge>
              <Badge variant="danger">{summary.absent} Absent</Badge>
              <Badge variant="secondary">{summary.excused} Excused</Badge>
              <Badge variant="info">{summary.unmarked} Unmarked</Badge>
            </div>
          )}

          {rosterError && (
            <p className="text-sm text-red-600">{rosterError}</p>
          )}

          {rosterLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading roster…
            </div>
          ) : roster.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No enrolled students for this class.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-2 text-[#002147] dark:text-slate-200">Student</TableHead>
                  <TableHead className="pr-2 text-[#002147] dark:text-slate-200">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((student) => {
                  const status = draft[student.studentId] ?? "UNMARKED";
                  return (
                    <TableRow key={student.studentId}>
                      <TableCell className="pl-2">
                        <p className="font-semibold text-[#002147]">
                          {student.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.studentCode}
                        </p>
                      </TableCell>
                      <TableCell className="pr-2">
                        {dialogReadOnly ? (
                          <Badge
                            variant={
                              status === "PRESENT"
                                ? "success"
                                : status === "LATE"
                                  ? "warning"
                                  : status === "ABSENT"
                                    ? "danger"
                                    : "secondary"
                            }
                          >
                            {markLabel(status)}
                          </Badge>
                        ) : (
                          <div
                            className="flex flex-wrap gap-1.5"
                            role="radiogroup"
                            aria-label={`Attendance for ${student.studentName}`}
                          >
                            {MARK_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={status === option}
                                data-active={status === option}
                                onClick={() =>
                                  setStatus(student.studentId, option)
                                }
                                className={cn(
                                  "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                                  statusStyles[option]
                                )}
                              >
                                {markLabel(option)}
                              </button>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            {!dialogReadOnly && (
              <Button
                disabled={saving || rosterLoading || roster.length === 0}
                className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                onClick={() => void saveAttendance()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                {saving ? "Saving…" : "Save Attendance"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={earlyOpen} onOpenChange={setEarlyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Early Exit Warning</DialogTitle>
            <DialogDescription>
              You have only completed{" "}
              <strong>{earlyTarget?.completedMinutes ?? 0}</strong> of{" "}
              <strong>{earlyTarget?.requiredMinutes ?? 120}</strong> minutes.
              Checking out early will flag this class session as{" "}
              <strong>EARLY EXIT</strong> in the Admin Audit Logs. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEarlyOpen(false)}>
              Stay in class
            </Button>
            <Button
              className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
              disabled={!earlyTarget || actingId === earlyTarget.classSectionId}
              onClick={() => {
                if (!earlyTarget) return;
                void endSession(
                  earlyTarget.sessionId,
                  earlyTarget.classSectionId,
                  true
                );
              }}
            >
              Confirm Early Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
