import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Timer,
  UserX,
} from "lucide-react";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface MonitorRow {
  sessionId: string;
  teacherName: string;
  facultyCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  room: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  checkInTime?: string;
  checkOutTime?: string | null;
  expectedCheckOutTime?: string;
  elapsedMinutes?: number;
  remainingMs?: number;
  countdown?: string;
  completedMinutes?: number | null;
  requiredMinutes?: number;
  locationVerified?: boolean;
  checkInMethod?: string | null;
  checkOutMethod?: string | null;
  lateByMinutes?: number | null;
  departmentName?: string | null;
  status: string;
}

interface PayrollRow {
  teacherId: string;
  teacherName: string;
  facultyCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  checkInTime: string;
  checkOutTime: string | null;
  completedMinutes: number | null;
  requiredMinutes: number;
  status: string;
  locationVerified: boolean;
}

interface LiveMonitor {
  date: string;
  generatedAt: string;
  summary: {
    active: number;
    missed: number;
    earlyExits: number;
    completed: number;
  };
  activeClasses: MonitorRow[];
  missedClasses: MonitorRow[];
  earlyExits: MonitorRow[];
  completedClasses: MonitorRow[];
  monthlyPayrollRows: PayrollRow[];
}

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

function csvEscape(value: string | number | boolean | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadMonthlyCsv(rows: PayrollRow[], month: string) {
  const header = [
    "Teacher",
    "Faculty Code",
    "Course",
    "Section",
    "Check-In",
    "Check-Out",
    "Completed Minutes",
    "Required Minutes",
    "Status",
    "Location Verified",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.teacherName,
        r.facultyCode,
        `${r.courseCode} ${r.courseTitle}`,
        r.section,
        r.checkInTime,
        r.checkOutTime ?? "",
        r.completedMinutes ?? "",
        r.requiredMinutes,
        r.status,
        r.locationVerified ? "Yes" : "No",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biu-teacher-attendance-payroll-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminTeacherAttendancePage() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<LiveMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<LiveMonitor>(
        `/admin/teacher-attendance/live-monitor?date=${encodeURIComponent(date)}`
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load live monitor"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      void load();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeWithLive = useMemo(() => {
    void tick;
    return (data?.activeClasses ?? []).map((row) => {
      if (!row.checkInTime) return row;
      const required = row.requiredMinutes ?? 120;
      const expected =
        new Date(row.checkInTime).getTime() + required * 60_000;
      const remaining = Math.max(0, expected - Date.now());
      const totalSec = Math.floor(remaining / 1000);
      const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const s = String(totalSec % 60).padStart(2, "0");
      return {
        ...row,
        remainingMs: remaining,
        countdown: `${h}h : ${m}m : ${s}s`,
        elapsedMinutes: Math.floor(
          Math.max(0, Date.now() - new Date(row.checkInTime).getTime()) /
            60_000
        ),
      };
    });
  }, [data?.activeClasses, tick]);

  const month = date.slice(0, 7);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Teacher Class Session Monitor"
        description="Live 2-hour class timers, missed check-ins, early-exit audit flags, and monthly payroll export."
      />

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-[#E5EBF3] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="space-y-1.5 sm:w-64">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monitor date
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              className="bg-[#002147] text-white hover:bg-[#003366]"
              disabled={!data?.monthlyPayrollRows?.length}
              onClick={() =>
                data &&
                downloadMonthlyCsv(data.monthlyPayrollRows, month)
              }
            >
              <Download className="h-4 w-4" />
              Export Monthly Teacher Attendance & Payroll Report
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4 sm:p-6">
          {[
            {
              label: "Active now",
              value: data?.summary.active ?? 0,
              icon: Timer,
              color: "text-[#16a34a]",
            },
            {
              label: "Missed today",
              value: data?.summary.missed ?? 0,
              icon: UserX,
              color: "text-red-600",
            },
            {
              label: "Early exits",
              value: data?.summary.earlyExits ?? 0,
              icon: AlertTriangle,
              color: "text-[#ea580c]",
            },
            {
              label: "Completed",
              value: data?.summary.completed ?? 0,
              icon: Clock,
              color: "text-[#002147]",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] px-4 py-3"
            >
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                {item.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Active Classes Right Now
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : activeWithLive.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No active teacher class sessions.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#002147] hover:bg-[#002147]">
                  <TableHead className="text-white">Teacher</TableHead>
                  <TableHead className="text-white">Course</TableHead>
                  <TableHead className="text-white">Check-in</TableHead>
                  <TableHead className="text-white">Live timer</TableHead>
                  <TableHead className="text-white">Method</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeWithLive.map((row) => (
                  <TableRow key={row.sessionId}>
                    <TableCell>
                      <div className="font-medium text-[#002147]">
                        {row.teacherName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.facultyCode}
                        {row.departmentName ? ` · ${row.departmentName}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {row.courseCode}-{row.section}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.courseTitle}
                        {row.room ? ` · Room ${row.room}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(row.checkInTime)}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-[#ea580c]">
                      {row.countdown ?? "—"}
                      <div className="text-xs font-normal text-muted-foreground">
                        {row.elapsedMinutes ?? 0} min elapsed
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="uppercase">
                        {row.checkInMethod ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">ACTIVE</Badge>
                      {row.locationVerified ? (
                        <span className="ml-2 text-xs text-[#16a34a]">
                          Geo OK
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Missed Classes Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.missedClasses.length ?? 0) === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No missed check-ins for this date.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Scheduled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.missedClasses.map((row) => (
                    <TableRow key={row.sessionId}>
                      <TableCell>{row.teacherName}</TableCell>
                      <TableCell>
                        {row.courseCode}-{row.section}
                      </TableCell>
                      <TableCell>
                        {row.scheduledStartTime ?? "—"}–
                        {row.scheduledEndTime ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#002147]">
              Early Exit Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.earlyExits.length ?? 0) === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No early exits for this date.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.earlyExits.map((row) => (
                    <TableRow key={row.sessionId}>
                      <TableCell>{row.teacherName}</TableCell>
                      <TableCell>
                        {row.courseCode}-{row.section}
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">EARLY EXIT</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.completedMinutes ?? "?"} /{" "}
                          {row.requiredMinutes ?? 120} min
                          <br />
                          {formatTime(row.checkInTime)} –{" "}
                          {formatTime(row.checkOutTime)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
