import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Ban,
  Eye,
  Plus,
  RotateCcw,
  Search,
  UserCheck,
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
  DHAPTI_ACADEMIC_YEARS,
  academicYearLabel,
  formatCourseOptionLabel,
} from "@/lib/biuAcademicCatalog";
import { DHAPTI_SEMESTERS } from "@/lib/biuFaculties";

type EnrollmentAccountStatus = "ACTIVE" | "COMPLETED" | "DROPPED";
type DialogMode = "enroll" | "view" | "drop" | null;

interface EnrollmentRow {
  id: string;
  studentId: string;
  classSectionId: string;
  status: string;
  accountStatus: EnrollmentAccountStatus;
  enrolledAt: string;
  studentCode: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  academicYear: string;
  semester: string;
  room: string | null;
  schedule: string | null;
  student: {
    id: string;
    studentCode: string;
    name: string;
    fullName: string;
    email?: string;
    program: string | null;
    faculty: string | null;
    department: string | null;
  };
  course: { id: string; code: string; title: string; credits: number };
  teacher: { id: string; name: string; fullName?: string };
  classSection: {
    id: string;
    section: string;
    academicYear: string;
    semester: string;
    room: string | null;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    schedule: string | null;
  };
  faculty: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
}

interface Option {
  id: string;
  name?: string;
  title?: string;
  code: string;
  facultyId?: string;
  departmentId?: string;
}

interface StudentOption {
  id: string;
  studentCode: string;
  name?: string;
  fullName?: string;
  program?: string;
  department?: string;
  faculty?: string;
}

interface ClassOption {
  id: string;
  courseId: string;
  section: string;
  academicYear: string;
  semester: string;
  courseCode: string;
  courseTitle: string;
  teacherName: string;
  status: string;
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

const semesters = [...DHAPTI_SEMESTERS];

const thClass =
  "px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]";

function compactAcademicYear(year: string): string {
  const m = year.trim().match(/^(\d{4})\s*\/\s*(\d{2,4})$/);
  if (!m) return year;
  const end = m[2].length === 4 ? m[2].slice(2) : m[2];
  return `${m[1]}/${end}`;
}

function compactSemesterLabel(semester: string): string {
  return semester.replace(/^Semester\s+/i, "Sem ");
}

function formatTermLabel(year: string, semester: string): string {
  return `${compactAcademicYear(year)} ${compactSemesterLabel(semester)}`;
}

function compactCourseLabel(code: string, title: string): string {
  const short =
    title.length > 18 ? `${title.slice(0, 16).trimEnd()}…` : title;
  return `${code}: ${short}`;
}

function statusBadgeVariant(
  status: EnrollmentAccountStatus
): "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "COMPLETED") return "warning";
  return "danger";
}

function enrollmentErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 409) {
    return "This student is already enrolled in this class.";
  }
  return err.message || fallback;
}

export function AdminEnrollmentsPage() {
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");

  const [faculties, setFaculties] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<EnrollmentRow | null>(null);

  const [enrollFacultyId, setEnrollFacultyId] = useState("");
  const [enrollDepartmentId, setEnrollDepartmentId] = useState("");
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [enrollClassId, setEnrollClassId] = useState("");
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollClasses, setEnrollClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [
    debouncedQuery,
    statusFilter,
    facultyFilter,
    departmentFilter,
    courseFilter,
    classFilter,
    yearFilter,
    semesterFilter,
  ]);

  useEffect(() => {
    void Promise.all([
      api<ListResponse<Option>>("/faculties?page=1&pageSize=100&status=ACTIVE"),
      api<ListResponse<Option>>(
        "/departments?page=1&pageSize=100&status=ACTIVE"
      ),
      api<
        ListResponse<
          Option & { title?: string; departmentId?: string; facultyId?: string }
        >
      >("/courses?page=1&pageSize=100&status=ACTIVE"),
      api<ListResponse<ClassOption>>(
        "/classes?page=1&pageSize=100&status=ACTIVE"
      ),
    ])
      .then(([f, d, c, cl]) => {
        setFaculties(f.data);
        setDepartments(d.data);
        setCourses(
          c.data.map((row) => ({
            id: row.id,
            code: row.code,
            title: row.title ?? row.name,
            name: row.title ?? row.name,
            departmentId: row.departmentId,
            facultyId: row.facultyId,
          }))
        );
        setClasses(cl.data);
      })
      .catch(() => {
        setFaculties([]);
        setDepartments([]);
        setCourses([]);
        setClasses([]);
      });
  }, []);

  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (facultyFilter !== "ALL") params.set("facultyId", facultyFilter);
      if (departmentFilter !== "ALL") {
        params.set("departmentId", departmentFilter);
      }
      if (courseFilter !== "ALL") params.set("courseId", courseFilter);
      if (classFilter !== "ALL") params.set("classSectionId", classFilter);
      if (yearFilter !== "ALL") params.set("academicYear", yearFilter);
      if (semesterFilter !== "ALL") params.set("semester", semesterFilter);

      const res = await api<ListResponse<EnrollmentRow>>(
        `/enrollments?${params}`
      );
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load enrollments"
      );
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    statusFilter,
    facultyFilter,
    departmentFilter,
    courseFilter,
    classFilter,
    yearFilter,
    semesterFilter,
  ]);

  useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  const filterDepartments = useMemo(
    () =>
      departments.filter(
        (d) => facultyFilter === "ALL" || d.facultyId === facultyFilter
      ),
    [departments, facultyFilter]
  );

  const filterCourses = useMemo(
    () =>
      courses.filter((c) => {
        if (departmentFilter !== "ALL" && c.departmentId !== departmentFilter) {
          return false;
        }
        if (facultyFilter !== "ALL") {
          const dept = departments.find((d) => d.id === c.departmentId);
          if (
            c.facultyId !== facultyFilter &&
            dept?.facultyId !== facultyFilter
          ) {
            return false;
          }
        }
        return true;
      }),
    [courses, departmentFilter, facultyFilter, departments]
  );

  const filterClasses = useMemo(
    () =>
      classes.filter((c) => {
        if (courseFilter !== "ALL" && c.courseId !== courseFilter) return false;
        if (yearFilter !== "ALL" && c.academicYear !== yearFilter) return false;
        if (semesterFilter !== "ALL" && c.semester !== semesterFilter) {
          return false;
        }
        return true;
      }),
    [classes, courseFilter, yearFilter, semesterFilter]
  );

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    facultyFilter !== "ALL" ||
    departmentFilter !== "ALL" ||
    courseFilter !== "ALL" ||
    classFilter !== "ALL" ||
    yearFilter !== "ALL" ||
    semesterFilter !== "ALL" ||
    query.trim().length > 0;

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setStatusFilter("ALL");
    setFacultyFilter("ALL");
    setDepartmentFilter("ALL");
    setCourseFilter("ALL");
    setClassFilter("ALL");
    setYearFilter("ALL");
    setSemesterFilter("ALL");
  };

  const enrollFormDepartments = useMemo(
    () =>
      departments.filter(
        (d) => !enrollFacultyId || d.facultyId === enrollFacultyId
      ),
    [departments, enrollFacultyId]
  );

  const enrollFormCourses = useMemo(
    () =>
      courses.filter((c) => {
        if (enrollDepartmentId && c.departmentId !== enrollDepartmentId) {
          return false;
        }
        if (enrollFacultyId) {
          const dept = departments.find((d) => d.id === c.departmentId);
          if (
            c.facultyId !== enrollFacultyId &&
            dept?.facultyId !== enrollFacultyId
          ) {
            return false;
          }
        }
        return true;
      }),
    [courses, enrollDepartmentId, enrollFacultyId, departments]
  );

  const loadEnrollClasses = useCallback(async (courseId: string) => {
    if (!courseId) {
      setEnrollClasses([]);
      return;
    }
    try {
      const res = await api<ListResponse<ClassOption>>(
        `/classes?page=1&pageSize=100&status=ACTIVE&courseId=${courseId}`
      );
      setEnrollClasses(res.data);
    } catch {
      setEnrollClasses([]);
    }
  }, []);

  useEffect(() => {
    if (enrollCourseId) void loadEnrollClasses(enrollCourseId);
  }, [enrollCourseId, loadEnrollClasses]);

  const openEnroll = () => {
    setSelected(null);
    setActionError(null);
    setSuccessMessage(null);
    setEnrollFacultyId(faculties[0]?.id ?? "");
    setEnrollDepartmentId("");
    setEnrollCourseId("");
    setEnrollClassId("");
    setEnrollStudentId("");
    setEnrollClasses([]);
    setDialogMode("enroll");
    void api<ListResponse<StudentOption>>(
      "/students?page=1&pageSize=100&status=ACTIVE"
    )
      .then((res) => setStudentOptions(res.data))
      .catch(() => setStudentOptions([]));
  };

  const openView = (row: EnrollmentRow) => {
    setSelected(row);
    setActionError(null);
    setDialogMode("view");
  };

  const openDrop = (row: EnrollmentRow) => {
    setSelected(row);
    setActionError(null);
    setDialogMode("drop");
  };

  const submitEnroll = async () => {
    if (!enrollStudentId) {
      setActionError("Student is required.");
      return;
    }
    if (!enrollClassId) {
      setActionError("Class / section is required.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await api("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          studentId: enrollStudentId,
          classSectionId: enrollClassId,
        }),
      });
      setDialogMode(null);
      setSuccessMessage("Student enrolled successfully.");
      await loadEnrollments();
    } catch (err) {
      setActionError(enrollmentErrorMessage(err, "Failed to enroll student"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDrop = async () => {
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    try {
      await api(`/enrollments/${selected.id}`, { method: "DELETE" });
      setDialogMode(null);
      setSuccessMessage("Enrollment dropped. Historical record preserved.");
      await loadEnrollments();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to drop enrollment"
      );
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (row: EnrollmentRow) => {
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api(`/enrollments/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      setSuccessMessage("Enrollment reactivated.");
      await loadEnrollments();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to reactivate enrollment"
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl dark:text-slate-100">
            Manage Enrollments
          </h1>
          <p className="mt-2 text-muted-foreground dark:text-slate-400">
            Enroll students into class sections and manage enrollment status.
          </p>
        </div>
        <Button
          onClick={openEnroll}
          className="shrink-0 bg-[#ea580c] text-white hover:bg-[#c2410c]"
        >
          <Plus className="h-4 w-4" />
          Enroll Student
        </Button>
      </div>

      {(error || actionError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error || actionError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {successMessage}
        </div>
      )}

      <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-[#E5EBF3] pb-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student, course, or section…"
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="DROPPED">Dropped</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={facultyFilter}
              onValueChange={(v) => {
                setFacultyFilter(v);
                setDepartmentFilter("ALL");
                setCourseFilter("ALL");
                setClassFilter("ALL");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-44">
                <SelectValue placeholder="Faculty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Faculties</SelectItem>
                {faculties.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={departmentFilter}
              onValueChange={(v) => {
                setDepartmentFilter(v);
                setCourseFilter("ALL");
                setClassFilter("ALL");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-44">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {filterDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Select
              value={courseFilter}
              onValueChange={(v) => {
                setCourseFilter(v);
                setClassFilter("ALL");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-52">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Courses</SelectItem>
                {filterCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {formatCourseOptionLabel(c.code, c.title || c.name || "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-52">
                <SelectValue placeholder="Class section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {filterClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.courseCode} Sec {c.section} · {c.academicYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-44">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Years</SelectItem>
                {DHAPTI_ACADEMIC_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {academicYearLabel(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-40">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Semesters</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading enrollments…"
              : `Showing ${rows.length} of ${pagination.total} · Page ${pagination.page}/${pagination.totalPages}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className={`w-[118px] whitespace-nowrap ${thClass}`}>
                    Student ID
                  </TableHead>
                  <TableHead className={`w-[18%] ${thClass}`}>
                    Student Name
                  </TableHead>
                  <TableHead className={`w-[20%] ${thClass}`}>Course</TableHead>
                  <TableHead className={`w-[52px] whitespace-nowrap ${thClass}`}>
                    Sec
                  </TableHead>
                  <TableHead className={`w-[16%] ${thClass}`}>Teacher</TableHead>
                  <TableHead className={`w-[110px] whitespace-nowrap ${thClass}`}>
                    Term
                  </TableHead>
                  <TableHead className={`w-[88px] whitespace-nowrap ${thClass}`}>
                    Status
                  </TableHead>
                  <TableHead
                    className={`w-[100px] whitespace-nowrap text-right ${thClass}`}
                  >
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      Loading enrollments…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <p>No enrollments found.</p>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={clearFilters}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => {
                    const code = row.courseCode || row.course.code;
                    const title = row.courseTitle || row.course.title;
                    const year =
                      row.academicYear || row.classSection.academicYear;
                    const semester =
                      row.semester || row.classSection.semester;
                    return (
                    <TableRow
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-[#F4F7FB]/70 dark:border-slate-800 dark:hover:bg-slate-900/50"
                    >
                      <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {row.studentCode || row.student.studentCode}
                      </TableCell>
                      <TableCell className="max-w-0 px-3 py-3">
                        <p className="truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                          {row.studentName || row.student.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {row.student.email ||
                            row.student.program ||
                            "—"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 px-3 py-3">
                        <p
                          className="truncate text-sm font-semibold text-[#002147] dark:text-slate-100"
                          title={`${code}: ${title}`}
                        >
                          {compactCourseLabel(code, title)}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {row.section || row.classSection.section}
                      </TableCell>
                      <TableCell className="max-w-0 px-3 py-3">
                        <p className="line-clamp-2 text-sm font-semibold text-[#002147] dark:text-slate-100">
                          {row.teacherName || row.teacher.name}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {formatTermLabel(year, semester)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3">
                        <Badge
                          variant={statusBadgeVariant(row.accountStatus)}
                          className="px-2.5 py-0.5"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-[#002147] hover:bg-[#002147]/10"
                            title="View Enrollment"
                            onClick={() => openView(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {row.accountStatus === "ACTIVE" && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600 hover:bg-red-50"
                              title="Cancel / Remove"
                              onClick={() => openDrop(row)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {row.accountStatus === "DROPPED" && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-[#16a34a] hover:bg-green-50"
                              title="Reactivate"
                              onClick={() => void reactivate(row)}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5EBF3] px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page - 1 }))
              }
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pagination.page >= pagination.totalPages || loading
              }
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page + 1 }))
              }
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && setDialogMode(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "enroll"
                ? "Enroll Student"
                : dialogMode === "drop"
                  ? "Drop Enrollment"
                  : "Enrollment Details"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "enroll"
                ? "Select an active student and an active class section. Enrollment targets the class section, not the course alone."
                : dialogMode === "drop"
                  ? "This will mark the enrollment as DROPPED. Historical enrollment data will be preserved."
                  : "Enrollment record details."}
            </DialogDescription>
          </DialogHeader>

          {actionError && dialogMode !== null && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}

          {dialogMode === "view" && selected && (
            <div className="space-y-2 text-sm">
              <Detail
                label="Student"
                value={`${selected.student.studentCode} — ${selected.student.name}`}
              />
              <Detail
                label="Course"
                value={`${selected.course.code} — ${selected.course.title}`}
              />
              <Detail label="Section" value={selected.classSection.section} />
              <Detail label="Teacher" value={selected.teacher.name} />
              <Detail
                label="Academic Year"
                value={selected.classSection.academicYear}
              />
              <Detail label="Semester" value={selected.classSection.semester} />
              <Detail
                label="Schedule"
                value={selected.classSection.schedule || "—"}
              />
              <Detail label="Room" value={selected.classSection.room || "—"} />
              <Detail label="Status" value={selected.status} />
              <Detail
                label="Enrolled"
                value={new Date(selected.enrolledAt).toLocaleString()}
              />
              {selected.accountStatus === "ACTIVE" && (
                <DialogFooter className="pt-2 sm:justify-start">
                  <Button variant="outline" onClick={() => openDrop(selected)}>
                    Drop Student
                  </Button>
                </DialogFooter>
              )}
              {selected.accountStatus === "DROPPED" && (
                <DialogFooter className="pt-2 sm:justify-start">
                  <Button
                    className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                    onClick={() => void reactivate(selected)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reactivate
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}

          {dialogMode === "drop" && selected && (
            <div className="space-y-4 text-sm">
              <p>
                Drop{" "}
                <span className="font-semibold text-[#002147]">
                  {selected.student.name}
                </span>{" "}
                from:
              </p>
              <p className="rounded-lg border border-[#E5EBF3] bg-[#F4F7FB] px-3 py-2 font-semibold text-[#002147]">
                {selected.course.title} — Section {selected.classSection.section}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogMode(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void confirmDrop()}
                >
                  {saving ? "Dropping…" : "Drop Enrollment"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {dialogMode === "enroll" && (
            <div className="space-y-3">
              <Field label="Student">
                <Select
                  value={enrollStudentId}
                  onValueChange={setEnrollStudentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select active student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.studentCode} — {s.name || s.fullName}
                        {s.program ? ` · ${s.program}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Faculty">
                <Select
                  value={enrollFacultyId}
                  onValueChange={(v) => {
                    setEnrollFacultyId(v);
                    setEnrollDepartmentId("");
                    setEnrollCourseId("");
                    setEnrollClassId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {faculties.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Department">
                <Select
                  value={enrollDepartmentId}
                  onValueChange={(v) => {
                    setEnrollDepartmentId(v);
                    setEnrollCourseId("");
                    setEnrollClassId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollFormDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Course">
                <Select
                  value={enrollCourseId}
                  onValueChange={(v) => {
                    setEnrollCourseId(v);
                    setEnrollClassId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollFormCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.title || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Class / Section">
                <Select
                  value={enrollClassId}
                  onValueChange={setEnrollClassId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class section" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.courseTitle} ({c.courseCode}) · Sec {c.section} ·{" "}
                        {c.academicYear} · {c.semester} · {c.teacherName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {enrollCourseId && enrollClasses.length === 0 && (
                  <p className="text-xs text-amber-700">
                    No active class sections for this course. Create one under
                    Manage Classes first.
                  </p>
                )}
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                  disabled={saving}
                  onClick={() => void submitEnroll()}
                >
                  {saving ? "Enrolling…" : "Enroll Student"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-[#002147]">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#E5EBF3] py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-[#002147]">{value}</span>
    </div>
  );
}
