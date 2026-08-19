import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  QrCode,
  Timer,
  Unlock,
} from "lucide-react";

import { FacultyQrScanDialog } from "@/components/teacher/FacultyQrScanDialog";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ClassSectionBrief {
  id: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  room: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface AssignedClass {
  id: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  room: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  status?: string;
}

interface Session {
  id: string;
  accountStatus: "SCHEDULED" | "OPEN" | "COMPLETED" | "CANCELLED";
  actualStartTime: string | null;
  actualEndTime: string | null;
  teacherAttendanceStatus?: string;
  teacherAttendance?: {
    checkInTime?: string;
    checkOutTime?: string | null;
    startedAt: string;
    endedAt: string | null;
    requiredMinutes?: number;
    expectedCheckOutAt?: string | null;
    completedMinutes?: number | null;
    status?: string;
    locationVerified?: boolean;
  } | null;
}

interface SessionRow {
  classSection: ClassSectionBrief;
  session: Session | null;
}

interface ActiveTimer {
  sessionId: string;
  checkInTime: string;
  expectedCheckOutTime: string;
  requiredMinutes: number;
  elapsedMinutes: number;
  remainingMs: number;
  countdown: string;
  canCheckOutFreely: boolean;
  status: string;
  locationVerified: boolean;
  courseCode: string;
  courseTitle: string;
  section: string;
  room: string | null;
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

function formatSchedule(cs: ClassSectionBrief) {
  const day = cs.dayOfWeek || "";
  const range =
    cs.startTime && cs.endTime
      ? `${cs.startTime}–${cs.endTime}`
      : cs.startTime || cs.endTime || "";
  if (day && range) return `${day} · ${range}`;
  return day || range || "Schedule not set";
}

function formatCountdownFromMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
}

function readGeo(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

export function TeacherMyAttendancePage() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [manualStarting, setManualStarting] = useState(false);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [tick, setTick] = useState(0);

  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyTarget, setEarlyTarget] = useState<{
    sessionId: string;
    classSectionId: string;
    completedMinutes: number;
    requiredMinutes: number;
  } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<{
    sessionId: string;
    label: string;
  } | null>(null);
  const [todaySummary, setTodaySummary] = useState<{
    totalClasses: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    late: number;
    earlyEnds: number;
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

  const loadAssignedClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const res = await api<{ data: AssignedClass[] }>("/teachers/me/classes");
      setAssignedClasses(res.data);
      setSelectedClassId((prev) => {
        if (prev && res.data.some((c) => c.id === prev)) return prev;
        return res.data[0]?.id ?? "";
      });
    } catch {
      setAssignedClasses([]);
    } finally {
      setClassesLoading(false);
    }
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const res = await api<{ active: boolean; session: ActiveTimer | null }>(
        "/teacher/attendance/active-session"
      );
      setActiveTimer(res.active && res.session ? res.session : null);
    } catch {
      /* non-blocking */
    }
  }, []);

  const loadTodaySummary = useCallback(async () => {
    try {
      const res = await api<{
        totalClasses: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        late: number;
        earlyEnds: number;
      }>("/teacher/attendance/today-summary");
      setTodaySummary(res);
    } catch {
      setTodaySummary(null);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    void loadActive();
    void loadAssignedClasses();
    void loadTodaySummary();
  }, [loadSessions, loadActive, loadAssignedClasses, loadTodaySummary]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeTimer) return;
    const id = window.setInterval(() => void loadActive(), 30_000);
    return () => window.clearInterval(id);
  }, [activeTimer, loadActive]);

  const liveCountdown = useMemo(() => {
    void tick;
    if (!activeTimer?.checkInTime) return null;
    const required = activeTimer.requiredMinutes || 120;
    const expected =
      new Date(activeTimer.checkInTime).getTime() + required * 60_000;
    const remaining = Math.max(0, expected - Date.now());
    return {
      label: formatCountdownFromMs(remaining),
      remainingMs: remaining,
      canCheckOutFreely: remaining <= 0,
      elapsedMinutes: Math.floor(
        Math.max(0, Date.now() - new Date(activeTimer.checkInTime).getTime()) /
          60_000
      ),
    };
  }, [activeTimer, tick]);

  const checkIn = async (classSection: ClassSectionBrief, sessionId?: string) => {
    setActingId(classSection.id);
    setSuccessMessage(null);
    setError(null);
    try {
      const geo = await readGeo();
      let sid = sessionId;
      if (!sid) {
        const ensured = await api<Session>(
          `/classes/${classSection.id}/sessions/ensure`,
          {
            method: "POST",
            body: JSON.stringify({ date }),
          }
        );
        sid = ensured.id;
        if (ensured.accountStatus === "OPEN") {
          setSuccessMessage("Class session is already active.");
          await loadSessions();
          await loadActive();
          return;
        }
      }
      await api("/teacher/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          sessionId: sid,
          ...(geo ?? {}),
        }),
      });
      setSuccessMessage(
        geo
          ? "Checked in. Campus location captured. 2-hour session timer started."
          : "Checked in. 2-hour session timer started (location unavailable)."
      );
      await loadSessions();
      await loadActive();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to start class session"
      );
    } finally {
      setActingId(null);
    }
  };

  const startManualSession = async () => {
    if (!selectedClassId) {
      setError("Select a class before starting a session.");
      return;
    }
    if (activeTimer) {
      setError("Finish your active class before starting another.");
      return;
    }
    setManualStarting(true);
    setActingId(selectedClassId);
    setSuccessMessage(null);
    setError(null);
    try {
      const geo = await readGeo();
      await api("/teacher/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({
          classSectionId: selectedClassId,
          date,
          ...(geo ?? {}),
        }),
      });
      setSuccessMessage(
        "Unscheduled / makeup session started. 2-hour locked timer is running."
      );
      await loadSessions();
      await loadActive();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to start unscheduled class session"
      );
    } finally {
      setManualStarting(false);
      setActingId(null);
    }
  };

  const weekdayName = useMemo(() => {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase();
  }, [date]);

  /** Classes whose timetable day matches the selected date, or that already have a session. */
  const scheduledForDate = useMemo(() => {
    return rows.filter(({ classSection, session }) => {
      if (session) return true;
      const day = (classSection.dayOfWeek || "").trim().toUpperCase();
      if (!day || !weekdayName) return false;
      return (
        day === weekdayName ||
        day.startsWith(weekdayName.slice(0, 3)) ||
        weekdayName.startsWith(day.slice(0, 3))
      );
    });
  }, [rows, weekdayName]);

  const showManualSelector =
    !loading && !classesLoading && assignedClasses.length > 0;

  const attemptCheckOut = async (
    sessionId: string,
    classSectionId: string,
    confirmEarlyExit = false
  ) => {
    setActingId(classSectionId);
    setSuccessMessage(null);
    setError(null);
    try {
      const res = await api<{
        timerStatus?: string;
        completedMinutes?: number;
      }>("/teacher/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ sessionId, confirmEarlyExit }),
      });
      setEarlyOpen(false);
      setEarlyTarget(null);
      if (res.timerStatus === "EARLY_EXIT") {
        setSuccessMessage(
          `Checked out early (${res.completedMinutes ?? "?"} min). Flagged as EARLY EXIT for admin audit.`
        );
      } else {
        setSuccessMessage("Class completed — full 2-hour session recorded.");
      }
      await loadSessions();
      await loadActive();
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
        setError(
          err instanceof ApiError ? err.message : "Failed to check out"
        );
      }
    } finally {
      setActingId(null);
    }
  };

  const requestEnd = (sessionId: string, classSectionId: string) => {
    if (liveCountdown && !liveCountdown.canCheckOutFreely) {
      setEarlyTarget({
        sessionId,
        classSectionId,
        completedMinutes: liveCountdown.elapsedMinutes,
        requiredMinutes: activeTimer?.requiredMinutes ?? 120,
      });
      setEarlyOpen(true);
      return;
    }
    void attemptCheckOut(sessionId, classSectionId, false);
  };

  const openScan = async (classSection: ClassSectionBrief, sessionId?: string) => {
    setError(null);
    try {
      let sid = sessionId;
      if (!sid) {
        const ensured = await api<Session>(
          `/classes/${classSection.id}/sessions/ensure`,
          {
            method: "POST",
            body: JSON.stringify({ date }),
          }
        );
        sid = ensured.id;
        await loadSessions();
      }
      setScanTarget({
        sessionId: sid!,
        label: `${classSection.courseCode} — ${classSection.courseTitle}`,
      });
      setScanOpen(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not prepare session for QR scan"
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="My Attendance (Check-in / Out)"
        description="Dynamic QR Verified Attendance or manual check-in. Server time and the 2-hour timer are authoritative."
      />

      {todaySummary && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Total", todaySummary.totalClasses],
              ["Completed", todaySummary.completed],
              ["In Progress", todaySummary.inProgress],
              ["Not Started", todaySummary.notStarted],
              ["Late", todaySummary.late],
              ["Early Ends", todaySummary.earlyEnds],
            ] as const
          ).map(([label, value]) => (
            <Card key={label} className="border-[#E5EBF3] shadow-sm">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#002147]">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {activeTimer && liveCountdown && (
        <Card className="overflow-hidden border-[#002147]/20 bg-gradient-to-br from-[#002147] via-[#003366] to-[#0a3d6b] text-white shadow-md">
          <CardContent className="space-y-3 p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-300">
              <Timer className="h-4 w-4" />
              Class Session Active
            </div>
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">
              ⏳ Time Remaining: {liveCountdown.label}
            </p>
            <p className="text-sm text-white/80">
              {activeTimer.courseCode}
              {activeTimer.section ? `-${activeTimer.section}` : ""} —{" "}
              {activeTimer.courseTitle}
              {" · "}
              Checked in {formatTime(activeTimer.checkInTime)}
              {" · "}
              Expected out {formatTime(activeTimer.expectedCheckOutTime)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {liveCountdown.canCheckOutFreely ? (
                <Badge className="bg-[#16a34a] text-white hover:bg-[#16a34a]">
                  <Unlock className="mr-1 h-3 w-3" />
                  Check-out unlocked
                </Badge>
              ) : (
                <Badge className="bg-orange-500 text-white hover:bg-orange-500">
                  <Lock className="mr-1 h-3 w-3" />
                  Check-out locked until 120 minutes
                </Badge>
              )}
              {activeTimer.locationVerified && (
                <Badge className="bg-white/15 text-white hover:bg-white/15">
                  Campus location verified
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            onClick={() => {
              void loadSessions();
              void loadActive();
            }}
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
              {error}
            </div>
          )}

          {loading || classesLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions…
            </div>
          ) : assignedClasses.length === 0 && rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No active classes assigned to you.
            </div>
          ) : (
            <div className="space-y-4">
              {showManualSelector && scheduledForDate.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No class is automatically scheduled for this date
                  {weekdayName ? ` (${weekdayName})` : ""}. Start an unscheduled
                  or makeup session below.
                </p>
              )}

              {showManualSelector && (
                <Card className="attendance-checkin-card border-[#16a34a]/25 bg-gradient-to-br from-[#F0FDF4] to-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black text-[#002147] md:text-xl">
                      Start an Unscheduled or Makeup Class Session
                    </CardTitle>
                    <p className="text-xs font-medium text-slate-600 md:text-sm">
                      Select any assigned class and begin a locked 2-hour
                      check-in. The session appears on the Admin Live Class
                      Monitor immediately.
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#002147]">
                        Select Class
                      </span>
                      <Select
                        value={selectedClassId}
                        onValueChange={setSelectedClassId}
                        disabled={!!activeTimer || manualStarting}
                      >
                        <SelectTrigger className="border-[#E5EBF3] bg-white text-[#002147]">
                          <SelectValue placeholder="Choose a class…" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignedClasses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.courseCode}
                              {c.section ? `-${c.section}` : ""} — {c.courseTitle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <Button
                      className="bg-[#16a34a] text-white hover:bg-[#15803d] sm:shrink-0"
                      disabled={
                        !selectedClassId ||
                        !!activeTimer ||
                        manualStarting ||
                        actingId === selectedClassId
                      }
                      onClick={() => void startManualSession()}
                    >
                      {manualStarting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Timer className="h-4 w-4" />
                      )}
                      Start 2-Hour Class Session (Check-In)
                    </Button>
                  </CardContent>
                  {activeTimer && (
                    <p className="px-6 pb-4 text-xs font-medium text-slate-600">
                      Finish your active class before starting another session.
                    </p>
                  )}
                </Card>
              )}

              {scheduledForDate.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {scheduledForDate.map(({ classSection, session }) => {
                const status = session?.accountStatus ?? null;
                const busy = actingId === classSection.id;
                const isThisActive =
                  !!session &&
                  activeTimer?.sessionId === session.id &&
                  status === "OPEN";
                const locked =
                  isThisActive && liveCountdown
                    ? !liveCountdown.canCheckOutFreely
                    : status === "OPEN";
                const timerStatus =
                  session?.teacherAttendance?.status ||
                  session?.teacherAttendanceStatus;

                return (
                  <Card
                    key={classSection.id}
                    className={cn(
                      "border-[#E5EBF3] shadow-sm",
                      isThisActive && "ring-2 ring-[#ea580c]/40"
                    )}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
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
                        {timerStatus === "EARLY_EXIT" ? (
                          <Badge variant="warning">EARLY EXIT</Badge>
                        ) : timerStatus === "COMPLETED" ||
                          status === "COMPLETED" ? (
                          <Badge variant="success">COMPLETED</Badge>
                        ) : status === "OPEN" ? (
                          <Badge variant="info">ACTIVE</Badge>
                        ) : (
                          <Badge variant="secondary">
                            {status ?? "No session"}
                          </Badge>
                        )}
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
                        {session?.actualStartTime && (
                          <p className="text-[#16a34a]">
                            Check-in {formatTime(session.actualStartTime)}
                            {session.actualEndTime
                              ? ` · Check-out ${formatTime(session.actualEndTime)}`
                              : ""}
                          </p>
                        )}
                        {session?.teacherAttendance?.completedMinutes !=
                          null && (
                          <p>
                            Duration:{" "}
                            {session.teacherAttendance.completedMinutes} /{" "}
                            {session.teacherAttendance.requiredMinutes ?? 120}{" "}
                            min
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(!session || status === "SCHEDULED") && (
                          <>
                            <Button
                              disabled={busy || !!activeTimer}
                              className="bg-[#002147] text-white hover:bg-[#003366]"
                              onClick={() =>
                                void checkIn(classSection, session?.id)
                              }
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Timer className="h-4 w-4" />
                              )}
                              Start Class (Check-In)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy || !!activeTimer}
                              onClick={() =>
                                void openScan(classSection, session?.id)
                              }
                            >
                              <QrCode className="h-4 w-4" />
                              Scan QR
                            </Button>
                          </>
                        )}
                        {status === "OPEN" && session && (
                          <>
                            <Button
                              variant={locked ? "outline" : "default"}
                              disabled={busy}
                              className={cn(
                                !locked &&
                                  "bg-[#16a34a] text-white hover:bg-[#15803d]"
                              )}
                              title={
                                locked
                                  ? "Locked until 120 minutes — click for early exit warning"
                                  : "End class session"
                              }
                              onClick={() =>
                                requestEnd(session.id, classSection.id)
                              }
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : locked ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Unlock className="h-4 w-4" />
                              )}
                              End Class & Check-Out
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void openScan(classSection, session.id)
                              }
                            >
                              <QrCode className="h-4 w-4" />
                              Scan QR to End
                            </Button>
                          </>
                        )}
                        {activeTimer && !isThisActive && status !== "OPEN" && (
                          <p className="text-xs text-muted-foreground">
                            Finish your active class before starting another.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                void attemptCheckOut(
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

      {scanTarget && (
        <FacultyQrScanDialog
          open={scanOpen}
          onOpenChange={(o) => {
            setScanOpen(o);
            if (!o) setScanTarget(null);
          }}
          sessionId={scanTarget.sessionId}
          courseLabel={scanTarget.label}
          onSuccess={() => {
            void loadSessions();
            void loadActive();
            void loadTodaySummary();
          }}
        />
      )}
    </div>
  );
}
