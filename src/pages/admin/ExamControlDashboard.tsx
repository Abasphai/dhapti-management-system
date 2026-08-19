import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Overview = {
  activeExamsScheduled: number;
  totalCandidates: number;
  clearedStudents: number;
  blockedStudents: number;
  clearedPercent: number;
  blockedPercent: number;
  activeSessionId: string | null;
};

type CourseOption = { id: string; code: string; title: string };

type RosterRow = {
  id: string;
  studentId: string;
  fullName: string;
  studentCode: string;
  faculty: string | null;
  semester: string | null;
  status: "CLEARED" | "HELD";
  attendancePercent: number | null;
  pendingDues: number;
  manualOverride: boolean;
  blockers: string[];
};

type PendingResult = {
  id: string;
  studentName: string;
  studentCode: string;
  courseCode: string;
  courseTitle: string;
  marks: number | null;
  letterGrade: string | null;
  status: string;
};

const fieldClass =
  "h-10 rounded-xl border-[#E5EBF3] bg-white text-sm font-semibold text-[#002147] placeholder:text-slate-500";

export function ExamControlDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [pending, setPending] = useState<PendingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    courseId: "",
    examDate: "",
    timeSlot: "08:00 – 11:00",
    room: "Hall A",
    chiefInvigilator: "",
    title: "Midterm Examinations 2026",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [exams, clearance, pendingRes, courseList] = await Promise.all([
        api<{ overview: Overview; sessions: Array<{ id: string }> }>(
          "/admin/exams"
        ),
        api<{ examSessionId: string | null; rows: RosterRow[] }>(
          "/admin/exams/clearance-roster"
        ),
        api<{ rows: PendingResult[] }>("/admin/exams/results/pending").catch(
          () => ({ rows: [] as PendingResult[] })
        ),
        api<{ data?: CourseOption[] }>("/courses?pageSize=100").catch(() => ({
          data: [] as CourseOption[],
        })),
      ]);
      setOverview(exams.overview);
      setSessionId(
        clearance.examSessionId || exams.overview.activeSessionId
      );
      setRoster(clearance.rows);
      setPending(pendingRes.rows);
      setCourses(
        (courseList.data ?? []).map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
        }))
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load exam control"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scheduleExam = async () => {
    if (!form.courseId || !form.examDate) {
      toast.error("Select a course and exam date");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/exams/schedule", {
        method: "POST",
        body: JSON.stringify({
          examSessionId: sessionId || undefined,
          title: form.title,
          courseId: form.courseId,
          examDate: new Date(form.examDate).toISOString(),
          timeSlot: form.timeSlot,
          room: form.room,
          chiefInvigilator: form.chiefInvigilator || null,
          sessionStatus: "ACTIVE",
          publishSession: true,
        }),
      });
      toast.success("Exam session scheduled");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to schedule exam"
      );
    } finally {
      setBusy(false);
    }
  };

  const overrideClearance = async (row: RosterRow) => {
    const reason = window.prompt(
      `Override clearance for ${row.fullName} (dean approval reason):`
    );
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await api(`/admin/exams/clearance/${row.id}/override`, {
        method: "PATCH",
        body: JSON.stringify({ reason: reason.trim(), status: "CLEARED" }),
      });
      toast.success("Manual clearance override applied");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Override failed"
      );
    } finally {
      setBusy(false);
    }
  };

  const publishResults = async () => {
    if (
      !window.confirm(
        `Publish ${pending.length} pending result(s) to official transcripts?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ published: number; message: string }>(
        "/admin/exams/results/publish",
        { method: "POST", body: "{}" }
      );
      toast.success(res.message);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Publish failed"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
          Exam Control
        </p>
        <h1 className="mt-1 text-3xl font-black text-[#002147]">
          Examination Administration Workspace
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-[#334155]">
          Schedule papers, monitor candidate clearance (attendance ≥ 75% and
          zero overdue tuition), and publish verified results to official
          transcripts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarRange}
          label="Active Exams Scheduled"
          value={loading ? "…" : String(overview?.activeExamsScheduled ?? 0)}
        />
        <StatCard
          icon={ClipboardList}
          label="Total Candidates"
          value={loading ? "…" : String(overview?.totalCandidates ?? 0)}
        />
        <StatCard
          icon={CheckCircle2}
          label="Cleared Students %"
          value={loading ? "…" : `${overview?.clearedPercent ?? 0}%`}
          accent="green"
        />
        <StatCard
          icon={Lock}
          label="Blocked Students %"
          value={loading ? "…" : `${overview?.blockedPercent ?? 0}%`}
          accent="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#002147]">
              Exam Timetable Scheduler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-[#002147]">Session title</Label>
              <Input
                className={fieldClass}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-[#002147]">Course</Label>
              <Select
                value={form.courseId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}
              >
                <SelectTrigger className={cn(fieldClass, "w-full")}>
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-bold text-[#002147]">Exam date</Label>
                <Input
                  type="date"
                  className={fieldClass}
                  value={form.examDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, examDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-[#002147]">Time slot</Label>
                <Input
                  className={fieldClass}
                  value={form.timeSlot}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, timeSlot: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-[#002147]">Room</Label>
                <Input
                  className={fieldClass}
                  value={form.room}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, room: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-[#002147]">
                  Chief invigilator
                </Label>
                <Input
                  className={fieldClass}
                  value={form.chiefInvigilator}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      chiefInvigilator: e.target.value,
                    }))
                  }
                  placeholder="Full name"
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void scheduleExam()}
              className="w-full bg-[#16a34a] font-bold text-white hover:bg-[#15803d]"
            >
              Save Exam Schedule
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-[#002147]">
              <ShieldCheck className="h-5 w-5 text-[#ea580c]" />
              Final Results Publish Gate
            </CardTitle>
            <Button
              type="button"
              disabled={busy || pending.length === 0}
              onClick={() => void publishResults()}
              className="bg-[#002147] font-bold text-white hover:bg-[#003366]"
            >
              Publish to Official Transcripts
            </Button>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm font-semibold text-[#334155]">
                No teacher-submitted results awaiting verification.
              </p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-xl border border-[#E5EBF3]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#F4F7FB] text-[#002147]">
                    <tr>
                      <th className="px-3 py-2 font-bold">Student</th>
                      <th className="px-3 py-2 font-bold">Course</th>
                      <th className="px-3 py-2 font-bold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.id} className="border-t border-[#E5EBF3]">
                        <td className="px-3 py-2 font-semibold text-[#002147]">
                          {r.studentName}
                          <span className="block text-xs font-bold text-[#475569]">
                            {r.studentCode}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-[#002147]">
                          {r.courseCode}
                        </td>
                        <td className="px-3 py-2 font-bold text-[#002147]">
                          {r.letterGrade ?? r.marks ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#002147]">
            Candidate Clearance Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-[#E5EBF3]">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-[#F4F7FB] text-[#002147]">
                <tr>
                  <th className="px-3 py-2 font-bold">Student</th>
                  <th className="px-3 py-2 font-bold">Faculty</th>
                  <th className="px-3 py-2 font-bold">Attendance</th>
                  <th className="px-3 py-2 font-bold">Dues</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center font-semibold text-[#334155]"
                    >
                      {loading
                        ? "Loading roster…"
                        : "No candidates / no active exam session yet."}
                    </td>
                  </tr>
                ) : (
                  roster.map((row) => (
                    <tr key={row.id} className="border-t border-[#E5EBF3]">
                      <td className="px-3 py-2 font-semibold text-[#002147]">
                        {row.fullName}
                        <span className="block text-xs font-bold text-[#475569]">
                          {row.studentCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#002147]">
                        {row.faculty || "—"}
                      </td>
                      <td className="px-3 py-2 font-bold text-[#002147]">
                        {row.attendancePercent == null
                          ? "—"
                          : `${row.attendancePercent}%`}
                      </td>
                      <td className="px-3 py-2 font-bold text-[#002147]">
                        ${row.pendingDues.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide",
                            row.status === "CLEARED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          )}
                        >
                          {row.status}
                          {row.manualOverride ? " *" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "HELD" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            className="border-[#002147] font-bold text-[#002147]"
                            onClick={() => void overrideClearance(row)}
                          >
                            Override
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-[#475569]">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs font-semibold text-[#475569]">
            * Manual override = Controllers / dean special approval.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof CalendarRange;
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <Card className="border-[#E5EBF3] shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            accent === "green" && "bg-emerald-100 text-emerald-700",
            accent === "red" && "bg-red-100 text-red-700",
            !accent && "bg-[#002147]/10 text-[#002147]"
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">
            {label}
          </p>
          <p className="text-2xl font-black text-[#002147]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
