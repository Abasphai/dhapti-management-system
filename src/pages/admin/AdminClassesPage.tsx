import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Eye, Pencil, Plus, Search, UserCheck, Users } from "lucide-react";

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
  DHAPTI_CURRENT_ACADEMIC_YEAR,
  academicYearLabel,
  formatCourseOptionLabel,
} from "@/lib/biuAcademicCatalog";
import { DHAPTI_SEMESTERS } from "@/lib/biuFaculties";

type UiStatus = "Active" | "Inactive" | "Suspended";
type DialogMode = "view" | "edit" | "add" | "students" | "dropStudent" | null;

interface ClassStudentRow {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  name: string;
  fullName?: string;
  status: string;
  accountStatus: string;
  enrolledAt: string;
  program: string | null;
  faculty: string | null;
  department: string | null;
}

interface StudentOption {
  id: string;
  studentCode: string;
  name?: string;
  fullName?: string;
  status: string;
}

interface ClassRow {
  id: string;
  courseId: string;
  teacherId: string;
  section: string;
  academicYear: string;
  semester: string;
  room: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  schedule: string | null;
  status: UiStatus;
  courseCode: string;
  courseTitle: string;
  teacherName: string;
  department: string | null;
  faculty: string | null;
  departmentId?: string | null;
  facultyId?: string | null;
}

interface Option {
  id: string;
  name?: string;
  title?: string;
  code: string;
  facultyId?: string;
  departmentId?: string;
}

interface TeacherOption {
  id: string;
  name: string;
  fullName?: string;
  facultyCode: string;
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

function formatScheduleLabel(row: ClassRow): string {
  const raw =
    row.schedule ||
    [row.dayOfWeek, row.startTime && row.endTime ? `${row.startTime}-${row.endTime}` : null]
      .filter(Boolean)
      .join(" ");
  if (!raw) return "—";
  return raw
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const emptyForm = {
  facultyId: "",
  departmentId: "",
  courseId: "",
  teacherId: "",
  section: "A",
  academicYear: DHAPTI_CURRENT_ACADEMIC_YEAR,
  semester: "Semester 1",
  room: "",
  dayOfWeek: "",
  startTime: "",
  endTime: "",
};

export function AdminClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
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
  const [yearFilter, setYearFilter] = useState("ALL");

  const [faculties, setFaculties] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [courseTeachers, setCourseTeachers] = useState<TeacherOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<ClassRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [classStudents, setClassStudents] = useState<ClassStudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ClassStudentRow | null>(null);

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
    yearFilter,
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
    ])
      .then(([f, d, c]) => {
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
      })
      .catch(() => {
        setFaculties([]);
        setDepartments([]);
        setCourses([]);
      });
  }, []);

  const loadClasses = useCallback(async () => {
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
      if (yearFilter !== "ALL") params.set("academicYear", yearFilter);

      const res = await api<ListResponse<ClassRow>>(`/classes?${params}`);
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load classes"
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
    yearFilter,
  ]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const loadTeachersForCourse = useCallback(async (courseId: string) => {
    if (!courseId) {
      setCourseTeachers([]);
      return;
    }
    try {
      const res = await api<{ data: TeacherOption[] }>(
        `/courses/${courseId}/teachers`
      );
      setCourseTeachers(
        res.data.map((t) => ({
          id: t.id,
          name: t.name || t.fullName || "",
          fullName: t.fullName || t.name,
          facultyCode: t.facultyCode,
        }))
      );
    } catch {
      setCourseTeachers([]);
    }
  }, []);

  useEffect(() => {
    if (form.courseId) void loadTeachersForCourse(form.courseId);
  }, [form.courseId, loadTeachersForCourse]);

  const formDepartments = useMemo(
    () =>
      departments.filter(
        (d) => !form.facultyId || d.facultyId === form.facultyId
      ),
    [departments, form.facultyId]
  );

  const formCourses = useMemo(
    () =>
      courses.filter((c) => {
        if (form.departmentId && c.departmentId !== form.departmentId) {
          return false;
        }
        if (
          form.facultyId &&
          c.facultyId !== form.facultyId &&
          !formDepartments.some((d) => d.id === c.departmentId)
        ) {
          return false;
        }
        return true;
      }),
    [courses, form.departmentId, form.facultyId, formDepartments]
  );

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
          if (c.facultyId !== facultyFilter && dept?.facultyId !== facultyFilter) {
            return false;
          }
        }
        return true;
      }),
    [courses, departmentFilter, facultyFilter, departments]
  );

  const openAdd = () => {
    setSelected(null);
    setActionError(null);
    setForm({
      ...emptyForm,
      facultyId: faculties[0]?.id ?? "",
      departmentId: "",
      courseId: "",
      teacherId: "",
    });
    setDialogMode("add");
  };

  const openView = (row: ClassRow) => {
    setSelected(row);
    setActionError(null);
    setDialogMode("view");
  };

  const loadClassStudents = useCallback(async (classId: string) => {
    setStudentsLoading(true);
    setActionError(null);
    try {
      const res = await api<{ data: ClassStudentRow[] }>(
        `/classes/${classId}/students`
      );
      setClassStudents(res.data);
    } catch (err) {
      setClassStudents([]);
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to load enrolled students"
      );
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const openStudents = (row: ClassRow) => {
    setSelected(row);
    setActionError(null);
    setSuccessMessage(null);
    setDropTarget(null);
    setEnrollStudentId("");
    setDialogMode("students");
    void loadClassStudents(row.id);
    void api<ListResponse<StudentOption>>(
      "/students?page=1&pageSize=100&status=ACTIVE"
    )
      .then((res) => setStudentOptions(res.data))
      .catch(() => setStudentOptions([]));
  };

  const enrollStudent = async () => {
    if (!selected || !enrollStudentId) {
      setActionError("Select a student to enroll.");
      return;
    }
    setEnrolling(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          studentId: enrollStudentId,
          classSectionId: selected.id,
        }),
      });
      setEnrollStudentId("");
      setSuccessMessage("Student enrolled successfully.");
      await loadClassStudents(selected.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError("This student is already enrolled in this class.");
      } else {
        setActionError(
          err instanceof ApiError ? err.message : "Failed to enroll student"
        );
      }
    } finally {
      setEnrolling(false);
    }
  };

  const confirmDropEnrollment = async () => {
    if (!selected || !dropTarget) return;
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api(`/enrollments/${dropTarget.enrollmentId}`, {
        method: "DELETE",
      });
      setDropTarget(null);
      setDialogMode("students");
      setSuccessMessage("Enrollment dropped. Historical record preserved.");
      await loadClassStudents(selected.id);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to drop enrollment"
      );
    }
  };

  const reactivateEnrollment = async (enrollmentId: string) => {
    if (!selected) return;
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api(`/enrollments/${enrollmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      setSuccessMessage("Enrollment reactivated.");
      await loadClassStudents(selected.id);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to reactivate enrollment"
      );
    }
  };

  const openEdit = (row: ClassRow) => {
    setSelected(row);
    setActionError(null);
    setForm({
      facultyId: row.facultyId ?? "",
      departmentId: row.departmentId ?? "",
      courseId: row.courseId,
      teacherId: row.teacherId,
      section: row.section,
      academicYear: row.academicYear,
      semester: row.semester,
      room: row.room ?? "",
      dayOfWeek: row.dayOfWeek ?? "",
      startTime: row.startTime ?? "",
      endTime: row.endTime ?? "",
    });
    setDialogMode("edit");
  };

  const toggleStatus = async (row: ClassRow) => {
    setActionError(null);
    const next = row.status === "Active" ? "INACTIVE" : "ACTIVE";
    try {
      await api(`/classes/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await loadClasses();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update status"
      );
    }
  };

  const save = async () => {
    if (!form.courseId || !form.teacherId || !form.section.trim()) {
      setActionError("Course, teacher, and section are required.");
      return;
    }
    setSaving(true);
    setActionError(null);
    const payload = {
      courseId: form.courseId,
      teacherId: form.teacherId,
      section: form.section.trim(),
      academicYear: form.academicYear.trim(),
      semester: form.semester,
      room: form.room.trim() || null,
      dayOfWeek: form.dayOfWeek.trim() || null,
      startTime: form.startTime.trim() || null,
      endTime: form.endTime.trim() || null,
    };
    try {
      if (dialogMode === "add") {
        await api("/classes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else if (dialogMode === "edit" && selected) {
        await api(`/classes/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      setDialogMode(null);
      await loadClasses();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save class"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl dark:text-slate-100">
            Manage Classes
          </h1>
          <p className="mt-2 text-muted-foreground dark:text-slate-400">
            Schedule course sections and assign teachers from the course roster.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="shrink-0 bg-[#ea580c] text-white hover:bg-[#c2410c]"
        >
          <Plus className="h-4 w-4" />
          Add Class
        </Button>
      </div>

      {(error || actionError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error || actionError}
        </div>
      )}
      {successMessage && dialogMode === null && (
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
                placeholder="Search by course, teacher, section, or room..."
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
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={facultyFilter}
              onValueChange={(v) => {
                setFacultyFilter(v);
                setDepartmentFilter("ALL");
                setCourseFilter("ALL");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-48">
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
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-48">
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
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl xl:w-56">
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
          </div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading classes…"
              : `Showing ${rows.length} of ${pagination.total} · Page ${pagination.page}/${pagination.totalPages}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-scroll">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className={`w-[22%] ${thClass}`}>Course</TableHead>
                <TableHead className={`w-[56px] whitespace-nowrap ${thClass}`}>
                  Sec
                </TableHead>
                <TableHead className={`w-[16%] ${thClass}`}>Teacher</TableHead>
                <TableHead className={`w-[140px] whitespace-nowrap ${thClass}`}>
                  Schedule
                </TableHead>
                <TableHead className={`w-[72px] ${thClass}`}>Room</TableHead>
                <TableHead className={`w-[110px] whitespace-nowrap ${thClass}`}>
                  Term
                </TableHead>
                <TableHead className={`w-[88px] whitespace-nowrap ${thClass}`}>
                  Status
                </TableHead>
                <TableHead
                  className={`w-[148px] whitespace-nowrap text-right ${thClass}`}
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
                    Loading classes…
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No classes match your filters.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-[#F4F7FB]/70 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    <TableCell className="max-w-0 px-3 py-3">
                      <p className="truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                        {row.courseTitle}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-[#ea580c]">
                        {row.courseCode}
                        {row.department ? ` · ${row.department}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                      {row.section}
                    </TableCell>
                    <TableCell className="max-w-0 px-3 py-3">
                      <p className="line-clamp-2 text-sm font-semibold text-[#002147] dark:text-slate-100">
                        {row.teacherName}
                      </p>
                      {row.faculty && (
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {row.faculty}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {formatScheduleLabel(row)}
                    </TableCell>
                    <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {row.room || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {formatTermLabel(row.academicYear, row.semester)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3">
                      <Badge
                        variant={
                          row.status === "Active" ? "success" : "danger"
                        }
                        className="px-2.5 py-0.5"
                      >
                        {row.status === "Active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#002147] hover:bg-[#002147]/10"
                          onClick={() => openView(row)}
                          title="View class"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#002147] hover:bg-[#002147]/10"
                          onClick={() => openStudents(row)}
                          title="Enrolled students"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#ea580c] hover:bg-orange-50"
                          onClick={() => openEdit(row)}
                          title="Edit class"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={
                            row.status === "Active"
                              ? "h-8 w-8 text-red-600 hover:bg-red-50"
                              : "h-8 w-8 text-[#16a34a] hover:bg-green-50"
                          }
                          onClick={() => void toggleStatus(row)}
                          title={
                            row.status === "Active" ? "Deactivate" : "Activate"
                          }
                        >
                          {row.status === "Active" ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto ${
            dialogMode === "students" ? "max-w-2xl" : "max-w-lg"
          }`}
        >
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add"
                ? "Create Class"
                : dialogMode === "edit"
                  ? "Edit Class"
                  : dialogMode === "students"
                    ? "Enrolled Students"
                    : dialogMode === "dropStudent"
                      ? "Drop Enrollment"
                      : "Class Details"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "students" && selected
                ? `${selected.courseCode} — ${selected.courseTitle} · Section ${selected.section} · ${selected.teacherName}`
                : dialogMode === "dropStudent" && dropTarget
                  ? "This will mark the enrollment as DROPPED. Historical enrollment data will be preserved."
                  : "Teachers listed are those already assigned to the selected course."}
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}
          {successMessage &&
            (dialogMode === "students" || dialogMode === "dropStudent") && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
                {successMessage}
              </p>
            )}

          {dialogMode === "view" && selected && (
            <div className="space-y-2 text-sm">
              <Detail label="Course" value={`${selected.courseCode} — ${selected.courseTitle}`} />
              <Detail label="Section" value={selected.section} />
              <Detail label="Teacher" value={selected.teacherName} />
              <Detail label="Faculty" value={selected.faculty || "—"} />
              <Detail label="Department" value={selected.department || "—"} />
              <Detail label="Academic Year" value={selected.academicYear} />
              <Detail label="Semester" value={selected.semester} />
              <Detail label="Schedule" value={selected.schedule || "—"} />
              <Detail label="Room" value={selected.room || "—"} />
              <Detail label="Status" value={selected.status} />
              <DialogFooter className="pt-2 sm:justify-start">
                <Button
                  variant="outline"
                  onClick={() => openStudents(selected)}
                >
                  <Users className="h-4 w-4" />
                  Manage enrollments
                </Button>
              </DialogFooter>
            </div>
          )}

          {dialogMode === "dropStudent" && selected && dropTarget && (
            <div className="space-y-4 text-sm">
              <p>
                Drop{" "}
                <span className="font-semibold text-[#002147]">
                  {dropTarget.name || dropTarget.fullName}
                </span>{" "}
                from:
              </p>
              <p className="rounded-lg border border-[#E5EBF3] bg-[#F4F7FB] px-3 py-2 font-semibold text-[#002147]">
                {selected.courseTitle} — Section {selected.section}
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDropTarget(null);
                    setDialogMode("students");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void confirmDropEnrollment()}
                >
                  Drop Enrollment
                </Button>
              </DialogFooter>
            </div>
          )}

          {dialogMode === "students" && selected && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field label="Enroll student">
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                  disabled={enrolling || !enrollStudentId}
                  onClick={() => void enrollStudent()}
                >
                  {enrolling ? "Enrolling…" : "Enroll Student"}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading students…
                      </TableCell>
                    </TableRow>
                  )}
                  {!studentsLoading && classStudents.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="space-y-2 py-8 text-center text-muted-foreground"
                      >
                        <p>No students are enrolled in this class yet.</p>
                        <p className="text-xs">
                          Use <span className="font-semibold">Enroll Student</span>{" "}
                          above to add the first student.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {!studentsLoading &&
                    classStudents.map((s) => (
                      <TableRow key={s.enrollmentId}>
                        <TableCell className="font-semibold">
                          {s.studentCode}
                        </TableCell>
                        <TableCell>
                          <p>{s.name || s.fullName}</p>
                          {(s.program || s.department) && (
                            <p className="text-[11px] text-muted-foreground">
                              {[s.program, s.department]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.accountStatus === "ACTIVE"
                                ? "success"
                                : s.accountStatus === "COMPLETED"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(s.enrolledAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.accountStatus === "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDropTarget(s);
                                setDialogMode("dropStudent");
                              }}
                            >
                              Drop
                            </Button>
                          )}
                          {s.accountStatus === "DROPPED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void reactivateEnrollment(s.enrollmentId)
                              }
                            >
                              Reactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          {(dialogMode === "add" || dialogMode === "edit") && (
            <div className="space-y-3">
              <Field label="Faculty">
                <Select
                  value={form.facultyId}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      facultyId: v,
                      departmentId: "",
                      courseId: "",
                      teacherId: "",
                    }))
                  }
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
                  value={form.departmentId}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      departmentId: v,
                      courseId: "",
                      teacherId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {formDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Course">
                <Select
                  value={form.courseId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, courseId: v, teacherId: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {formCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {formatCourseOptionLabel(
                          c.code,
                          c.title || c.name || ""
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Teacher">
                <Select
                  value={form.teacherId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, teacherId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assigned teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {courseTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.facultyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.courseId && courseTeachers.length === 0 && (
                  <p className="text-xs text-amber-700">
                    No teachers assigned to this course yet. Assign them under
                    Manage Teachers first.
                  </p>
                )}
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Section">
                  <Input
                    value={form.section}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, section: e.target.value }))
                    }
                    placeholder="A"
                  />
                </Field>
                <Field label="Academic Year">
                  <Select
                    value={form.academicYear}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, academicYear: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {DHAPTI_ACADEMIC_YEARS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {academicYearLabel(y)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Semester">
                <Select
                  value={form.semester}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, semester: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Room">
                <Input
                  value={form.room}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, room: e.target.value }))
                  }
                  placeholder="Lab 2"
                />
              </Field>
              <Field label="Day(s)">
                <Input
                  value={form.dayOfWeek}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dayOfWeek: e.target.value }))
                  }
                  placeholder="Mon / Wed"
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Start">
                  <Input
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    placeholder="08:00"
                  />
                </Field>
                <Field label="End">
                  <Input
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    placeholder="10:00"
                  />
                </Field>
              </div>
            </div>
          )}

          {(dialogMode === "add" || dialogMode === "edit") && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
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
  children: React.ReactNode;
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
      <span className="font-semibold text-[#002147]">{value}</span>
    </div>
  );
}
