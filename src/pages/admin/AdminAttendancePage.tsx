import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type Tab = "teachers" | "sessions" | "students";

interface Option {
  id: string;
  name?: string;
  title?: string;
  code: string;
  facultyId?: string;
}

interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface TeacherAttendanceRow {
  sessionId: string;
  date: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  status: string;
  teacherAttendanceStatus: string;
  teacherName: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  section: string | null;
  room: string | null;
  classSectionId: string;
}

interface SessionRow {
  id: string;
  date: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  accountStatus: string;
  teacherAttendanceStatus: string;
  teacherName?: string | null;
  courseCode?: string | null;
  courseTitle?: string | null;
  section?: string | null;
  room?: string | null;
  markedCount?: number;
}

interface StudentAttendanceRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  classSectionId: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  totalSessions: number;
  percentage: number | null;
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

function sessionBadgeVariant(
  status: string
): "secondary" | "warning" | "success" | "danger" | "info" {
  if (status === "OPEN") return "success";
  if (status === "COMPLETED") return "info";
  if (status === "CANCELLED") return "danger";
  if (status === "SCHEDULED") return "warning";
  return "secondary";
}

function teacherStatusVariant(
  status: string
): "secondary" | "warning" | "success" | "danger" | "info" {
  if (status === "PRESENT") return "success";
  if (status === "COMPLETED") return "info";
  if (status === "NOT_STARTED") return "warning";
  if (status === "CANCELLED") return "danger";
  return "secondary";
}

export function AdminAttendancePage() {
  const [tab, setTab] = useState<Tab>("teachers");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [date, setDate] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [facultyId, setFacultyId] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [courseId, setCourseId] = useState("ALL");

  const [faculties, setFaculties] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [teacherRows, setTeacherRows] = useState<TeacherAttendanceRow[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [studentRows, setStudentRows] = useState<StudentAttendanceRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [
    debouncedQuery,
    date,
    statusFilter,
    facultyId,
    departmentId,
    courseId,
    tab,
  ]);

  useEffect(() => {
    void api<ListResponse<Option>>("/faculties?page=1&pageSize=100")
      .then((r) => setFaculties(r.data))
      .catch(() => setFaculties([]));
    void api<ListResponse<Option>>("/departments?page=1&pageSize=200")
      .then((r) => setDepartments(r.data))
      .catch(() => setDepartments([]));
    void api<ListResponse<Option>>("/courses?page=1&pageSize=200")
      .then((r) => setCourses(r.data))
      .catch(() => setCourses([]));
  }, []);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    });
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (facultyId !== "ALL") params.set("facultyId", facultyId);
    if (departmentId !== "ALL") params.set("departmentId", departmentId);
    if (courseId !== "ALL") params.set("courseId", courseId);
    if (tab !== "students") {
      if (date) params.set("date", date);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
    }
    return params;
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    facultyId,
    departmentId,
    courseId,
    tab,
    date,
    statusFilter,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      if (tab === "teachers") {
        const res = await api<ListResponse<TeacherAttendanceRow> & { date: string }>(
          `/attendance/teachers?${params}`
        );
        setTeacherRows(res.data);
        setPagination(res.pagination);
      } else if (tab === "sessions") {
        const res = await api<ListResponse<SessionRow>>(
          `/attendance/sessions?${params}`
        );
        setSessionRows(res.data);
        setPagination(res.pagination);
      } else {
        const res = await api<ListResponse<StudentAttendanceRow>>(
          `/attendance/students?${params}`
        );
        setStudentRows(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load attendance"
      );
      setTeacherRows([]);
      setSessionRows([]);
      setStudentRows([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredDepartments = departments.filter(
    (d) => facultyId === "ALL" || d.facultyId === facultyId
  );

  const tabButton = (id: Tab, label: string) => (
    <Button
      key={id}
      variant={tab === id ? "default" : "outline"}
      className={
        tab === id ? "bg-[#002147] text-white hover:bg-[#003366]" : ""
      }
      onClick={() => setTab(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#002147]">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor teacher sessions and student attendance summaries across the
          university.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabButton("teachers", "Teachers today")}
        {tabButton("sessions", "Sessions")}
        {tabButton("students", "Student summaries")}
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="space-y-3 border-b border-[#E5EBF3] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "students"
                    ? "Search student, ID, course…"
                    : "Search teacher, course, topic…"
                }
                className="h-10 pl-9"
              />
            </div>
            {tab !== "students" && (
              <>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 w-full lg:w-44"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full lg:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              value={facultyId}
              onValueChange={(v) => {
                setFacultyId(v);
                setDepartmentId("ALL");
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Faculty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All faculties</SelectItem>
                {faculties.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All departments</SelectItem>
                {filteredDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.title ?? c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </div>
          )}

          {tab === "teachers" && (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Teacher</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="pr-6">Teacher status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Loading teacher attendance…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && teacherRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No sessions match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  teacherRows.map((row) => (
                    <TableRow key={row.sessionId}>
                      <TableCell className="pl-6 font-semibold text-[#002147]">
                        {row.teacherName || "—"}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {row.courseCode} · Sec {row.section}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.courseTitle}
                          {row.room ? ` · ${row.room}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.scheduledStartTime && row.scheduledEndTime
                          ? `${row.scheduledStartTime}–${row.scheduledEndTime}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTime(row.actualStartTime)}
                        {row.actualEndTime
                          ? ` – ${formatTime(row.actualEndTime)}`
                          : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sessionBadgeVariant(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Badge
                          variant={teacherStatusVariant(
                            row.teacherAttendanceStatus
                          )}
                        >
                          {row.teacherAttendanceStatus.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {tab === "sessions" && (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Marked</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Loading sessions…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && sessionRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No sessions match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  sessionRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6 font-medium text-[#002147]">
                        {row.date}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {row.courseCode} · Sec {row.section}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.courseTitle}
                        </p>
                      </TableCell>
                      <TableCell>{row.teacherName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.scheduledStartTime && row.scheduledEndTime
                          ? `${row.scheduledStartTime}–${row.scheduledEndTime}`
                          : "—"}
                      </TableCell>
                      <TableCell>{row.markedCount ?? 0}</TableCell>
                      <TableCell className="pr-6">
                        <Badge
                          variant={sessionBadgeVariant(row.accountStatus)}
                        >
                          {row.accountStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {tab === "students" && (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>P / L / A / E</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead className="pr-6 text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Loading student summaries…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && studentRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No student attendance summaries match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  studentRows.map((row) => {
                    const ok =
                      row.percentage == null ? true : row.percentage >= 75;
                    return (
                      <TableRow
                        key={`${row.studentId}-${row.classSectionId}`}
                      >
                        <TableCell className="pl-6">
                          <p className="font-semibold text-[#002147]">
                            {row.studentName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.studentCode}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {row.courseCode} · Sec {row.section}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.courseTitle}
                          </p>
                        </TableCell>
                        <TableCell>{row.teacherName}</TableCell>
                        <TableCell className="text-sm">
                          <span className="text-[#16a34a]">{row.present}</span>
                          {" / "}
                          <span className="text-[#E85D04]">{row.late}</span>
                          {" / "}
                          <span className="text-red-600">{row.absent}</span>
                          {" / "}
                          <span>{row.excused}</span>
                        </TableCell>
                        <TableCell>{row.totalSessions}</TableCell>
                        <TableCell className="pr-6 text-right">
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
                            {row.percentage == null
                              ? "—"
                              : `${row.percentage}%`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between border-t border-[#E5EBF3] px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page - 1 }))
              }
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ·{" "}
              {pagination.total} total
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page + 1 }))
              }
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
