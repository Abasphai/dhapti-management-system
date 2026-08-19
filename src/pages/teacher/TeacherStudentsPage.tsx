import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Search, Users } from "lucide-react";

import { PageHeader } from "@/components/portals";
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

interface ClassOption {
  id: string;
  section: string;
  academicYear: string;
  semester: string;
  course: { code: string; title: string };
  courseCode?: string;
  courseTitle?: string;
}

interface RosterStudent {
  studentId: string;
  studentCode: string;
  name: string;
  fullName: string;
  faculty: string | null;
  department: string | null;
  semester: string;
  academicYear: string;
  program: string | null;
  attendancePercent: number | null;
  status: string;
}

function attendanceTone(value: number | null) {
  if (value == null) return "text-muted-foreground";
  if (value >= 90) return "text-[#16a34a]";
  if (value >= 75) return "text-[#E85D04]";
  return "text-red-600";
}

export function TeacherStudentsPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classSectionId, setClassSectionId] = useState("");
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingClasses(true);
    void api<{ data: ClassOption[] }>("/teachers/me/classes")
      .then((res) => {
        if (cancelled) return;
        setClasses(res.data);
        if (res.data[0]) setClassSectionId(res.data[0].id);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load classes"
          );
          setClasses([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classSectionId) {
      setStudents([]);
      return;
    }
    setLoadingRoster(true);
    setError(null);
    setSelectedId(null);
    try {
      const res = await api<{ data: RosterStudent[] }>(
        `/classes/${classSectionId}/students`
      );
      setStudents(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load student roster"
      );
      setStudents([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [classSectionId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        (s.faculty ?? "").toLowerCase().includes(q)
    );
  }, [query, students]);

  const selected = students.find((s) => s.studentId === selectedId) ?? null;

  const avgAttendance = useMemo(() => {
    const values = students
      .map((s) => s.attendancePercent)
      .filter((v): v is number => v != null);
    if (!values.length) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [students]);

  const selectedClass = classes.find((c) => c.id === classSectionId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Student List"
        description="View enrolled students for your assigned class sections."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#002147]/10 text-[#002147]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Enrolled Students
              </p>
              <p className="text-xl font-bold text-[#002147]">{students.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">My Classes</p>
            <p className="text-xl font-bold text-[#002147]">{classes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Avg. Attendance
            </p>
            <p className="text-xl font-bold text-[#16a34a]">
              {avgAttendance != null ? `${avgAttendance}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadRoster()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="space-y-4 border-b border-[#E5EBF3] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or student ID..."
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9"
              />
            </div>
            <Select
              value={classSectionId}
              onValueChange={setClassSectionId}
              disabled={loadingClasses || classes.length === 0}
            >
              <SelectTrigger className="min-w-[280px]">
                <SelectValue placeholder="Select class section" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c.course?.code ?? c.courseCode) +
                      ` · Sec ${c.section} (${c.academicYear} S${c.semester})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {students.length} students
            {selectedClass
              ? ` · ${selectedClass.course?.code ?? selectedClass.courseCode}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="pl-6 text-[#002147] dark:text-slate-200">Student ID</TableHead>
                <TableHead className="text-[#002147] dark:text-slate-200">Name</TableHead>
                <TableHead className="text-[#002147] dark:text-slate-200">Faculty</TableHead>
                <TableHead className="text-[#002147] dark:text-slate-200">Semester</TableHead>
                <TableHead className="text-[#002147] dark:text-slate-200">Attendance %</TableHead>
                <TableHead className="pr-6 text-right text-[#002147] dark:text-slate-200">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(loadingClasses || loadingRoster) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!loadingClasses && !loadingRoster && classes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No class sections assigned to you yet.
                  </TableCell>
                </TableRow>
              )}
              {!loadingClasses &&
                !loadingRoster &&
                classes.length > 0 &&
                filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No students match your filters.
                    </TableCell>
                  </TableRow>
                )}
              {!loadingRoster &&
                filtered.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="pl-6 font-medium text-[#002147]">
                      {student.studentCode}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.fullName || student.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.faculty ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.academicYear} · {student.semester}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-semibold",
                          attendanceTone(student.attendancePercent)
                        )}
                      >
                        {student.attendancePercent != null
                          ? `${student.attendancePercent}%`
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg border-[#E5EBF3] text-[#002147] hover:bg-[#F4F7FB]"
                        onClick={() => setSelectedId(student.studentId)}
                      >
                        <Eye className="h-4 w-4" />
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between border-b border-[#E5EBF3] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#002147]">Student Profile</h2>
              <p className="text-sm text-muted-foreground">
                Quick roster overview (read-only)
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedId(null)}
              className="text-muted-foreground"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Student ID
              </p>
              <p className="mt-1 font-semibold text-[#002147]">
                {selected.studentCode}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Full Name
              </p>
              <p className="mt-1 font-semibold text-[#002147]">
                {selected.fullName || selected.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Faculty</p>
              <p className="mt-1 font-semibold text-[#002147]">
                {selected.faculty ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Attendance
              </p>
              <Badge
                variant={
                  selected.attendancePercent == null
                    ? "secondary"
                    : selected.attendancePercent >= 90
                      ? "success"
                      : selected.attendancePercent >= 75
                        ? "warning"
                        : "danger"
                }
                className="mt-1"
              >
                {selected.attendancePercent != null
                  ? `${selected.attendancePercent}%`
                  : "No sessions"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
