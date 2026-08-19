import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  UserCheck,
  Users,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";

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

type TabKey = "faculties" | "departments" | "courses";
type UiStatus = "Active" | "Inactive" | "Suspended";
type DialogMode = "add" | "edit" | null;

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface FacultyRow {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: UiStatus;
  accountStatus: string;
  departmentCount: number;
  studentCount: number;
  courseCount: number;
}

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  faculty: string | null;
  status: UiStatus;
  accountStatus: string;
  courseCount: number;
}

interface CourseRow {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester?: string | null;
  facultyId: string | null;
  departmentId: string;
  faculty: string | null;
  department: string | null;
  status: UiStatus;
  accountStatus: string;
}

interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

interface OptionRow {
  id: string;
  name: string;
  code: string;
  facultyId?: string;
}

interface FacultyDetailDepartment {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  teacherCount: number;
  courseCount: number;
}

interface FacultyDetailTeacher {
  id: string;
  fullName: string;
  facultyCode: string;
  designation: string | null;
  email: string;
  department: string;
  departmentCode: string;
}

interface FacultyDetail extends FacultyRow {
  description?: string | null;
  departments: FacultyDetailDepartment[];
  activeTeacherCount: number;
  activeTeachers: FacultyDetailTeacher[];
}

const CARD_COLORS = [
  "bg-[#ea580c]/10 text-[#ea580c]",
  "bg-[#002147]/10 text-[#002147]",
  "bg-[#16a34a]/10 text-[#16a34a]",
];

const emptyPagination: Pagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
};

export function AdminFacultiesPage() {
  const [tab, setTab] = useState<TabKey>("faculties");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);

  const [facultyOptions, setFacultyOptions] = useState<OptionRow[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<OptionRow[]>([]);

  const [summary, setSummary] = useState({
    faculties: 0,
    departments: 0,
    students: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseTeachersOpen, setCourseTeachersOpen] = useState(false);
  const [courseTeachersTitle, setCourseTeachersTitle] = useState("");
  const [courseTeachers, setCourseTeachers] = useState<
    { teacherId: string; name: string; facultyCode: string; department: string | null }[]
  >([]);
  const [courseTeachersLoading, setCourseTeachersLoading] = useState(false);
  const [facultyDetail, setFacultyDetail] = useState<FacultyDetail | null>(null);
  const [facultyDetailLoading, setFacultyDetailLoading] = useState(false);

  const [facultyForm, setFacultyForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    code: "",
    facultyId: "",
  });
  const [courseForm, setCourseForm] = useState({
    title: "",
    code: "",
    credits: "3",
    semester: "",
    facultyId: "",
    departmentId: "",
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [tab, debouncedQuery, statusFilter, facultyFilter, departmentFilter]);

  const loadOptions = useCallback(async () => {
    const [facRes, deptRes] = await Promise.all([
      api<ListResponse<OptionRow>>("/faculties?page=1&pageSize=100&status=ACTIVE"),
      api<ListResponse<OptionRow & { facultyId: string }>>(
        "/departments?page=1&pageSize=100&status=ACTIVE"
      ),
    ]);
    setFacultyOptions(facRes.data);
    setDepartmentOptions(deptRes.data);
    setSummary((s) => ({
      ...s,
      faculties: facRes.pagination.total,
      departments: deptRes.pagination.total,
    }));
  }, []);

  const loadSummaryStudents = useCallback(async () => {
    try {
      const res = await api<ListResponse<unknown>>(
        "/students?page=1&pageSize=1"
      );
      setSummary((s) => ({ ...s, students: res.pagination.total }));
    } catch {
      /* students count is optional for this page */
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      if (tab === "faculties") {
        const res = await api<ListResponse<FacultyRow>>(
          `/faculties?${params}`
        );
        setFaculties(res.data);
        setPagination(res.pagination);
      } else if (tab === "departments") {
        if (facultyFilter !== "ALL") params.set("facultyId", facultyFilter);
        const res = await api<ListResponse<DepartmentRow>>(
          `/departments?${params}`
        );
        setDepartments(res.data);
        setPagination(res.pagination);
      } else {
        if (facultyFilter !== "ALL") params.set("facultyId", facultyFilter);
        if (departmentFilter !== "ALL") {
          params.set("departmentId", departmentFilter);
        }
        const res = await api<ListResponse<CourseRow>>(`/courses?${params}`);
        setCourses(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load academic data"
      );
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    statusFilter,
    facultyFilter,
    departmentFilter,
  ]);

  useEffect(() => {
    void loadOptions();
    void loadSummaryStudents();
  }, [loadOptions, loadSummaryStudents]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  const filteredDepartmentOptions = useMemo(() => {
    if (!courseForm.facultyId) return departmentOptions;
    return departmentOptions.filter((d) => d.facultyId === courseForm.facultyId);
  }, [departmentOptions, courseForm.facultyId]);

  const openFacultyDetail = async (facultyId: string) => {
    setFacultyDetailLoading(true);
    setActionError(null);
    try {
      const detail = await api<FacultyDetail>(`/faculties/${facultyId}`);
      setFacultyDetail(detail);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to load faculty details"
      );
    } finally {
      setFacultyDetailLoading(false);
    }
  };

  const openAdd = () => {
    setSelectedId(null);
    setActionError(null);
    setDialogMode("add");
    if (tab === "faculties") {
      setFacultyForm({ name: "", code: "", description: "" });
    } else if (tab === "departments") {
      setDepartmentForm({
        name: "",
        code: "",
        facultyId: facultyOptions[0]?.id ?? "",
      });
    } else {
      const firstFaculty = facultyOptions[0]?.id ?? "";
      const firstDept =
        departmentOptions.find((d) => d.facultyId === firstFaculty)?.id ??
        departmentOptions[0]?.id ??
        "";
      setCourseForm({
        title: "",
        code: "",
        credits: "3",
        semester: "",
        facultyId: firstFaculty,
        departmentId: firstDept,
      });
    }
  };

  const openEditFaculty = (row: FacultyRow) => {
    setSelectedId(row.id);
    setActionError(null);
    setFacultyForm({
      name: row.name,
      code: row.code,
      description: row.description ?? "",
    });
    setDialogMode("edit");
  };

  const openEditDepartment = (row: DepartmentRow) => {
    setSelectedId(row.id);
    setActionError(null);
    setDepartmentForm({
      name: row.name,
      code: row.code,
      facultyId: row.facultyId,
    });
    setDialogMode("edit");
  };

  const openEditCourse = (row: CourseRow) => {
    setSelectedId(row.id);
    setActionError(null);
    setCourseForm({
      title: row.title,
      code: row.code,
      credits: String(row.credits),
      semester: row.semester ?? "",
      facultyId: row.facultyId ?? "",
      departmentId: row.departmentId,
    });
    setDialogMode("edit");
  };

  const openCourseTeachers = async (row: CourseRow) => {
    setCourseTeachersTitle(`${row.code} — ${row.title}`);
    setCourseTeachersOpen(true);
    setCourseTeachersLoading(true);
    setActionError(null);
    try {
      const res = await api<{
        data: {
          teacherId: string;
          name: string;
          facultyCode: string;
          department: string | null;
        }[];
      }>(`/courses/${row.id}/teachers`);
      setCourseTeachers(res.data);
    } catch (err) {
      setCourseTeachers([]);
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Failed to load assigned teachers"
      );
    } finally {
      setCourseTeachersLoading(false);
    }
  };

  const toggleStatus = async (
    entity: "faculties" | "departments" | "courses",
    id: string,
    current: UiStatus
  ) => {
    setActionError(null);
    const next = current === "Active" ? "INACTIVE" : "ACTIVE";
    try {
      await api(`/${entity}/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await loadTabData();
      await loadOptions();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update status"
      );
    }
  };

  const save = async () => {
    setSaving(true);
    setActionError(null);
    try {
      if (tab === "faculties") {
        if (!facultyForm.name.trim() || !facultyForm.code.trim()) {
          setActionError("Faculty name and code are required.");
          return;
        }
        const payload = {
          name: facultyForm.name.trim(),
          code: facultyForm.code.trim(),
          description: facultyForm.description.trim() || undefined,
        };
        if (dialogMode === "add") {
          await api("/faculties", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } else if (selectedId) {
          await api(`/faculties/${selectedId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        }
      } else if (tab === "departments") {
        if (
          !departmentForm.name.trim() ||
          !departmentForm.code.trim() ||
          !departmentForm.facultyId
        ) {
          setActionError("Department name, code, and faculty are required.");
          return;
        }
        const payload = {
          name: departmentForm.name.trim(),
          code: departmentForm.code.trim(),
          facultyId: departmentForm.facultyId,
        };
        if (dialogMode === "add") {
          await api("/departments", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } else if (selectedId) {
          await api(`/departments/${selectedId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        }
      } else {
        if (
          !courseForm.title.trim() ||
          !courseForm.code.trim() ||
          !courseForm.departmentId
        ) {
          setActionError("Course title, code, and department are required.");
          return;
        }
        const credits = Number(courseForm.credits) || 3;
        const payload = {
          title: courseForm.title.trim(),
          code: courseForm.code.trim(),
          credits,
          departmentId: courseForm.departmentId,
          semester: courseForm.semester.trim() || undefined,
        };
        if (dialogMode === "add") {
          await api("/courses", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } else if (selectedId) {
          await api(`/courses/${selectedId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        }
      }
      setDialogMode(null);
      await loadTabData();
      await loadOptions();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save changes"
      );
    } finally {
      setSaving(false);
    }
  };

  const overviewFaculties = facultyOptions.slice(0, 12);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Faculties & Departments"
        description="Manage academic faculties, departments, and courses across Dhapti University."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Faculties"
          value={summary.faculties}
          accent="text-[#002147]"
        />
        <SummaryCard
          label="Departments"
          value={summary.departments}
          accent="text-[#ea580c]"
        />
        <SummaryCard
          label="Enrolled Students"
          value={summary.students.toLocaleString()}
          accent="text-[#16a34a]"
        />
      </div>

      {overviewFaculties.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {overviewFaculties.map((faculty, index) => (
            <motion.div
              key={faculty.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25, ease: "easeOut" }}
            >
              <Card
                role="button"
                tabIndex={0}
                onClick={() => void openFacultyDetail(faculty.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void openFacultyDetail(faculty.id);
                  }
                }}
                className="h-full cursor-pointer border-[#E5EBF3] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-2xl dark:border-slate-800"
              >
                <CardContent className="flex h-full flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${CARD_COLORS[index % CARD_COLORS.length]}`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <span className="rounded-lg bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#002147] dark:bg-slate-800 dark:text-slate-200">
                      {faculty.code}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#002147] dark:text-slate-100">
                    {faculty.name}
                  </h3>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Click to view departments, enrollment & teachers
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-[#E5EBF3] pb-4 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["faculties", "Faculties"],
                ["departments", "Departments"],
                ["courses", "Courses"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                  tab === key
                    ? "bg-[#002147] text-white"
                    : "bg-[#F4F7FB] text-[#002147] hover:bg-[#E5EBF3] dark:bg-slate-800 dark:text-slate-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "faculties"
                    ? "Search by faculty code or name..."
                    : tab === "departments"
                      ? "Search by department code, name, or faculty..."
                      : "Search by course code, title, department, or faculty..."
                }
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-[#E5EBF3] lg:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            {tab !== "faculties" && (
              <Select
                value={facultyFilter}
                onValueChange={(v) => {
                  setFacultyFilter(v);
                  setDepartmentFilter("ALL");
                }}
              >
                <SelectTrigger className="h-10 w-full rounded-xl border-[#E5EBF3] lg:w-52">
                  <SelectValue placeholder="Faculty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Faculties</SelectItem>
                  {facultyOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {tab === "courses" && (
              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger className="h-10 w-full rounded-xl border-[#E5EBF3] lg:w-52">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departmentOptions
                    .filter(
                      (d) =>
                        facultyFilter === "ALL" || d.facultyId === facultyFilter
                    )
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={openAdd}
              className="shrink-0 bg-[#ea580c] text-white hover:bg-[#c2410c]"
            >
              <Plus className="h-4 w-4" />
              {tab === "faculties"
                ? "Add Faculty"
                : tab === "departments"
                  ? "Add Department"
                  : "Add Course"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {(error || actionError) && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error || actionError}
            </div>
          )}

          {loading ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : tab === "faculties" ? (
            <FacultyTable
              rows={faculties}
              onView={(row) => void openFacultyDetail(row.id)}
              onEdit={openEditFaculty}
              onToggle={(row) =>
                void toggleStatus("faculties", row.id, row.status)
              }
            />
          ) : tab === "departments" ? (
            <DepartmentTable
              rows={departments}
              onEdit={openEditDepartment}
              onToggle={(row) =>
                void toggleStatus("departments", row.id, row.status)
              }
            />
          ) : (
            <CourseTable
              rows={courses}
              onEdit={openEditCourse}
              onViewTeachers={(row) => void openCourseTeachers(row)}
              onToggle={(row) =>
                void toggleStatus("courses", row.id, row.status)
              }
            />
          )}

          <div className="flex items-center justify-between border-t border-[#E5EBF3] px-4 py-3 text-sm dark:border-slate-800">
            <span className="text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ·{" "}
              {pagination.total} total
            </span>
            <div className="flex gap-2">
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={courseTeachersOpen} onOpenChange={setCourseTeachersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assigned Teachers</DialogTitle>
            <DialogDescription>{courseTeachersTitle}</DialogDescription>
          </DialogHeader>
          {courseTeachersLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : courseTeachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No teachers assigned to this course yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {courseTeachers.map((t) => (
                <li
                  key={t.teacherId}
                  className="rounded-lg border border-[#E5EBF3] px-3 py-2"
                >
                  <p className="font-semibold text-[#002147]">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.facultyCode}
                    {t.department ? ` · ${t.department}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={facultyDetail !== null || facultyDetailLoading}
        onOpenChange={(open) => {
          if (!open) {
            setFacultyDetail(null);
            setFacultyDetailLoading(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">
              {facultyDetail
                ? `${facultyDetail.name} (${facultyDetail.code})`
                : "Faculty Details"}
            </DialogTitle>
            <DialogDescription>
              Departments, student enrollment, and active teachers for this
              faculty.
            </DialogDescription>
          </DialogHeader>
          {facultyDetailLoading && !facultyDetail ? (
            <p className="text-sm text-muted-foreground">Loading faculty…</p>
          ) : facultyDetail ? (
            <div className="space-y-5">
              {facultyDetail.description && (
                <p className="text-sm text-slate-600">
                  {facultyDetail.description}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#E5EBF3] bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Departments
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#002147]">
                    {facultyDetail.departments?.length ??
                      facultyDetail.departmentCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF3] bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Students
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#002147]">
                    {facultyDetail.studentCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF3] bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Active Teachers
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#002147]">
                    {facultyDetail.activeTeacherCount ?? 0}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-bold text-[#002147]">
                  Departments
                </h4>
                <div className="space-y-2">
                  {(facultyDetail.departments ?? []).map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5EBF3] px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-[#002147]">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.code}</p>
                      </div>
                      <div className="flex gap-3 text-xs font-semibold text-slate-600">
                        <span>{d.studentCount} students</span>
                        <span>{d.teacherCount} teachers</span>
                        <span>{d.courseCount} courses</span>
                      </div>
                    </div>
                  ))}
                  {(facultyDetail.departments ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No departments yet. Use Add Department to create one.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-bold text-[#002147]">
                  Active Teachers
                </h4>
                {(facultyDetail.activeTeachers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active teachers assigned to departments in this faculty.
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {facultyDetail.activeTeachers.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-lg border border-[#E5EBF3] px-3 py-2"
                      >
                        <p className="font-semibold text-[#002147]">
                          {t.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.facultyCode}
                          {t.designation ? ` · ${t.designation}` : ""} ·{" "}
                          {t.department}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setFacultyDetail(null)}
                >
                  Close
                </Button>
                <Button
                  className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                  onClick={() => {
                    const row = faculties.find((f) => f.id === facultyDetail.id);
                    setFacultyDetail(null);
                    if (row) openEditFaculty(row);
                    else {
                      openEditFaculty({
                        id: facultyDetail.id,
                        name: facultyDetail.name,
                        code: facultyDetail.code,
                        description: facultyDetail.description,
                        status: facultyDetail.status,
                        accountStatus: facultyDetail.accountStatus,
                        departmentCount: facultyDetail.departmentCount,
                        studentCount: facultyDetail.studentCount,
                        courseCount: facultyDetail.courseCount,
                      });
                    }
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Faculty
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && setDialogMode(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Create" : "Edit"}{" "}
              {tab === "faculties"
                ? "Faculty"
                : tab === "departments"
                  ? "Department"
                  : "Course"}
            </DialogTitle>
            <DialogDescription>
              Changes are saved to the academic structure database.
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}

          <div className="space-y-3">
            {tab === "faculties" && (
              <>
                <Field label="Name">
                  <Input
                    value={facultyForm.name}
                    onChange={(e) =>
                      setFacultyForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Code">
                  <Input
                    value={facultyForm.code}
                    onChange={(e) =>
                      setFacultyForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Description">
                  <Input
                    value={facultyForm.description}
                    onChange={(e) =>
                      setFacultyForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                  />
                </Field>
              </>
            )}

            {tab === "departments" && (
              <>
                <Field label="Faculty">
                  <Select
                    value={departmentForm.facultyId}
                    onValueChange={(v) =>
                      setDepartmentForm((f) => ({ ...f, facultyId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      {facultyOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Name">
                  <Input
                    value={departmentForm.name}
                    onChange={(e) =>
                      setDepartmentForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Code">
                  <Input
                    value={departmentForm.code}
                    onChange={(e) =>
                      setDepartmentForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                </Field>
              </>
            )}

            {tab === "courses" && (
              <>
                <Field label="Faculty">
                  <Select
                    value={courseForm.facultyId}
                    onValueChange={(v) => {
                      const firstDept =
                        departmentOptions.find((d) => d.facultyId === v)?.id ??
                        "";
                      setCourseForm((f) => ({
                        ...f,
                        facultyId: v,
                        departmentId: firstDept,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      {facultyOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Department">
                  <Select
                    value={courseForm.departmentId}
                    onValueChange={(v) =>
                      setCourseForm((f) => ({ ...f, departmentId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDepartmentOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Title">
                  <Input
                    value={courseForm.title}
                    onChange={(e) =>
                      setCourseForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Code">
                  <Input
                    value={courseForm.code}
                    onChange={(e) =>
                      setCourseForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Credits">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={courseForm.credits}
                      onChange={(e) =>
                        setCourseForm((f) => ({
                          ...f,
                          credits: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Semester">
                    <Input
                      value={courseForm.semester}
                      onChange={(e) =>
                        setCourseForm((f) => ({
                          ...f,
                          semester: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

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
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
      <CardContent className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
      </CardContent>
    </Card>
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

function StatusBadge({ status }: { status: UiStatus }) {
  return (
    <Badge
      className={cn(
        status === "Active" && "bg-green-100 text-green-800 hover:bg-green-100",
        status === "Inactive" &&
          "bg-slate-100 text-slate-700 hover:bg-slate-100",
        status === "Suspended" && "bg-amber-100 text-amber-800 hover:bg-amber-100"
      )}
    >
      {status}
    </Badge>
  );
}

function FacultyTable({
  rows,
  onView,
  onEdit,
  onToggle,
}: {
  rows: FacultyRow[];
  onView: (row: FacultyRow) => void;
  onEdit: (row: FacultyRow) => void;
  onToggle: (row: FacultyRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        No faculties found.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Departments</TableHead>
          <TableHead>Students</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onView(row)}
          >
            <TableCell className="font-semibold">{row.code}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                {row.departmentCount}
              </span>
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {row.studentCount}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onView(row)}
                  aria-label="View faculty departments"
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(row)}
                  aria-label="Edit faculty"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onToggle(row)}
                  aria-label="Toggle faculty status"
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
  );
}

function DepartmentTable({
  rows,
  onEdit,
  onToggle,
}: {
  rows: DepartmentRow[];
  onEdit: (row: DepartmentRow) => void;
  onToggle: (row: DepartmentRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        No departments found.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Faculty</TableHead>
          <TableHead>Courses</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-semibold">{row.code}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.faculty ?? "—"}</TableCell>
            <TableCell>{row.courseCount}</TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(row)}
                  aria-label="Edit department"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onToggle(row)}
                  aria-label="Toggle department status"
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
  );
}

function CourseTable({
  rows,
  onEdit,
  onViewTeachers,
  onToggle,
}: {
  rows: CourseRow[];
  onEdit: (row: CourseRow) => void;
  onViewTeachers: (row: CourseRow) => void;
  onToggle: (row: CourseRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        No courses found.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Faculty</TableHead>
          <TableHead>Credits</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-semibold">{row.code}</TableCell>
            <TableCell>{row.title}</TableCell>
            <TableCell>{row.department ?? "—"}</TableCell>
            <TableCell>{row.faculty ?? "—"}</TableCell>
            <TableCell>{row.credits}</TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onViewTeachers(row)}
                  aria-label="View assigned teachers"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit(row)}
                  aria-label="Edit course"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onToggle(row)}
                  aria-label="Toggle course status"
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
  );
}
