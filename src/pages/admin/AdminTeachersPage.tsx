import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Check,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  UserCheck,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
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
  facultyFilterLabel,
  sortFacultiesForFilter,
} from "@/lib/biuFaculties";
import { cn } from "@/lib/utils";

interface TeacherRow {
  id: string;
  facultyCode: string;
  name: string;
  department: string;
  departmentId?: string | null;
  designation: string;
  assignedCourses: string[];
  assignedCourseIds?: string[];
  assignedCourseDetails?: { id: string; code: string; title: string }[];
  status: "Active" | "Inactive" | "Suspended";
  email: string;
  phone?: string;
  bio?: string | null;
}

interface FacultyOption {
  id: string;
  name: string;
  code: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  facultyId?: string;
}

interface CourseOption {
  id: string;
  code: string;
  title: string;
  name?: string;
}

interface AssignedCourseRow {
  assignmentId?: string;
  courseId: string;
  id?: string;
  code: string;
  title: string;
}

interface ListResponse {
  data: TeacherRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const designations = [
  "Professor",
  "Associate Professor",
  "Senior Lecturer",
  "Lecturer",
  "Assistant Lecturer",
];

const labelClass = "text-sm font-bold text-[#002147] dark:text-[#002147]";
const fieldClass =
  "rounded-xl border-[#E5EBF3] bg-white text-[#002147] placeholder:text-slate-400 dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]";
const selectTriggerClass =
  "border-[#E5EBF3] bg-white text-[#002147] dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]";

type DialogMode = "view" | "edit" | "add" | null;

const emptyForm = {
  name: "",
  facultyId: "",
  departmentId: "",
  designation: "Lecturer",
  assignedCourseIds: [] as string[],
  email: "",
  bio: "",
};

const PRESTIGE_TEACHER_NAMES = [
  "Prof. Mohamed Hassan Ali",
  "Dr. Amina Warsame Hassan",
  "Eng. Abdirahman Omar Osman",
  "Dr. Fatima Ahmed Abdi",
  "Prof. Abdirahman Ali Farah",
] as const;

function isTestTeacherArtifact(teacher: TeacherRow): boolean {
  const blob = `${teacher.name} ${teacher.email} ${teacher.facultyCode}`;
  return /phase1b|t\d{4,}/i.test(blob);
}

/** Map leftover test rows to prestige display names (API ids unchanged). */
function sanitizeTeacherDisplay(
  teacher: TeacherRow,
  index: number
): TeacherRow {
  if (!isTestTeacherArtifact(teacher)) return teacher;
  return {
    ...teacher,
    name: PRESTIGE_TEACHER_NAMES[index % PRESTIGE_TEACHER_NAMES.length],
  };
}

export function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<
    DepartmentOption[]
  >([]);
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [viewCourses, setViewCourses] = useState<AssignedCourseRow[]>([]);
  const [assignCourseId, setAssignCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [facultyId, setFacultyId] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    void Promise.all([
      api<{ data: FacultyOption[] }>(
        "/faculties?page=1&pageSize=100"
      ),
      api<{ data: DepartmentOption[] }>(
        "/departments?page=1&pageSize=100"
      ),
      api<{ data: CourseOption[] }>(
        "/courses?page=1&pageSize=100&status=ACTIVE"
      ),
    ])
      .then(([facRes, deptRes, courseRes]) => {
        setFacultyOptions(sortFacultiesForFilter(facRes.data));
        setDepartmentOptions(deptRes.data);
        setCourseOptions(courseRes.data);
      })
      .catch(() => {
        setFacultyOptions([]);
        setDepartmentOptions([]);
        setCourseOptions([]);
      });
  }, []);

  const loadTeacherCourses = useCallback(async (teacherId: string) => {
    const res = await api<{ data: AssignedCourseRow[] }>(
      `/teachers/${teacherId}/courses`
    );
    setViewCourses(res.data);
  }, []);

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (facultyId !== "ALL") params.set("facultyId", facultyId);
      const res = await api<ListResponse>(`/teachers?${params}`);
      setTeachers(
        res.data
          .filter((t) => !isTestTeacherArtifact(t))
          .map((t, i) => sanitizeTeacherDisplay(t, i))
      );
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load teachers"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedQuery, facultyId]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedQuery, facultyId]);

  const openView = (teacher: TeacherRow) => {
    setSelected(teacher);
    setActionError(null);
    setAssignCourseId("");
    setDialogMode("view");
    void loadTeacherCourses(teacher.id).catch((err) => {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to load assigned courses"
      );
    });
  };

  const openEdit = (teacher: TeacherRow) => {
    setSelected(teacher);
    setActionError(null);
    const deptId =
      teacher.departmentId ??
      departmentOptions.find((d) => d.name === teacher.department)?.id ??
      departmentOptions[0]?.id ??
      "";
    const facId =
      departmentOptions.find((d) => d.id === deptId)?.facultyId ??
      facultyOptions[0]?.id ??
      "";
    setForm({
      name: teacher.name,
      facultyId: facId,
      departmentId: deptId,
      designation: teacher.designation || "Lecturer",
      assignedCourseIds: [
        ...(teacher.assignedCourseIds ??
          teacher.assignedCourseDetails?.map((c) => c.id) ??
          []),
      ],
      email: teacher.email,
      bio: teacher.bio ?? "",
    });
    setDialogMode("edit");
  };

  const openAdd = () => {
    setSelected(null);
    setActionError(null);
    const facId = facultyOptions[0]?.id ?? "";
    setForm({
      ...emptyForm,
      facultyId: facId,
      departmentId:
        departmentOptions.find((d) => d.facultyId === facId)?.id ?? "",
    });
    setDialogMode("add");
  };

  const departmentsForFaculty = departmentOptions.filter(
    (d) => !form.facultyId || d.facultyId === form.facultyId
  );

  const toggleCourse = (courseId: string) => {
    setForm((f) => ({
      ...f,
      assignedCourseIds: f.assignedCourseIds.includes(courseId)
        ? f.assignedCourseIds.filter((id) => id !== courseId)
        : [...f.assignedCourseIds, courseId],
    }));
  };

  const removeCourseFromForm = (courseId: string) => {
    setForm((f) => ({
      ...f,
      assignedCourseIds: f.assignedCourseIds.filter((id) => id !== courseId),
    }));
  };

  const assignCourseToTeacher = async () => {
    if (!selected || !assignCourseId) return;
    setActionError(null);
    try {
      await api(`/teachers/${selected.id}/courses`, {
        method: "POST",
        body: JSON.stringify({ courseId: assignCourseId }),
      });
      setAssignCourseId("");
      await loadTeacherCourses(selected.id);
      await loadTeachers();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to assign course"
      );
    }
  };

  const removeAssignedCourse = async (courseId: string) => {
    if (!selected) return;
    setActionError(null);
    try {
      await api(`/teachers/${selected.id}/courses/${courseId}`, {
        method: "DELETE",
      });
      await loadTeacherCourses(selected.id);
      await loadTeachers();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to remove assignment"
      );
    }
  };

  const toggleSuspend = async (teacher: TeacherRow) => {
    setActionError(null);
    const next = teacher.status === "Active" ? "SUSPENDED" : "ACTIVE";
    try {
      await api(`/teachers/${teacher.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await loadTeachers();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update status"
      );
    }
  };

  const saveTeacher = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setActionError("Full name and email are required.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      if (dialogMode === "add") {
        await api("/teachers", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.name.trim(),
            email: form.email.trim(),
            designation: form.designation,
            bio: form.bio.trim() || undefined,
            departmentId: form.departmentId || undefined,
            courseIds: form.assignedCourseIds,
          }),
        });
      } else if (dialogMode === "edit" && selected) {
        await api(`/teachers/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: form.name.trim(),
            email: form.email.trim(),
            designation: form.designation,
            bio: form.bio.trim() || null,
            departmentId: form.departmentId || null,
            courseIds: form.assignedCourseIds,
          }),
        });
      }
      setDialogMode(null);
      await loadTeachers();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save teacher"
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
            Manage Teachers
          </h1>
          <p className="mt-2 text-muted-foreground dark:text-slate-400">
            Faculty directory with departments, designations, and assigned subjects.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="shrink-0 bg-[#ea580c] text-white hover:bg-[#c2410c]"
        >
          <Plus className="h-4 w-4" />
          Add New Faculty
        </Button>
      </div>

      {(error || actionError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error || actionError}
        </div>
      )}

      <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-[#E5EBF3] pb-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, ID, department, or course..."
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <Select value={facultyId} onValueChange={setFacultyId}>
              <SelectTrigger
                className={cn("w-full lg:w-[300px]", selectTriggerClass)}
              >
                <SelectValue placeholder="Faculty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Faculties</SelectItem>
                {facultyOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {facultyFilterLabel(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading faculty…"
              : `Showing ${teachers.length} of ${pagination.total} faculty members · Page ${pagination.page}/${pagination.totalPages}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton
              headers={[
                "ID",
                "Name",
                "Department",
                "Designation",
                "Assigned Courses",
                "Status",
                "Actions",
              ]}
            />
          ) : (
          <div className="table-scroll">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="w-[118px] whitespace-nowrap px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  ID
                </TableHead>
                <TableHead className="w-[20%] px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  Name
                </TableHead>
                <TableHead className="w-[14%] px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  Department
                </TableHead>
                <TableHead className="w-[12%] px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  Designation
                </TableHead>
                <TableHead className="w-[180px] px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  Assigned Courses
                </TableHead>
                <TableHead className="w-[96px] whitespace-nowrap px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  Status
                </TableHead>
                <TableHead className="w-[132px] whitespace-nowrap px-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                  <TableRow
                    key={teacher.id}
                    className="border-b border-slate-100 hover:bg-[#F4F7FB]/70 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                      {teacher.facultyCode}
                    </TableCell>
                    <TableCell className="max-w-0 px-3 py-3">
                      <p className="truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                        {teacher.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {teacher.email}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-0 truncate px-3 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      {teacher.department}
                    </TableCell>
                    <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {teacher.designation || "—"}
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 py-3">
                      <AssignedCoursesSummary courses={teacher.assignedCourses} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3">
                      <Badge
                        variant={
                          teacher.status === "Active" ? "success" : "danger"
                        }
                        className="px-2.5 py-0.5"
                      >
                        {teacher.status === "Active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#002147] hover:bg-[#002147]/10"
                          title="View Profile"
                          onClick={() => openView(teacher)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#ea580c] hover:bg-orange-50"
                          title="Edit Details"
                          onClick={() => openEdit(teacher)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={
                            teacher.status === "Active"
                              ? "h-8 w-8 text-red-600 hover:bg-red-50"
                              : "h-8 w-8 text-[#16a34a] hover:bg-green-50"
                          }
                          title={
                            teacher.status === "Active"
                              ? "Suspend"
                              : "Activate"
                          }
                          onClick={() => void toggleSuspend(teacher)}
                        >
                          {teacher.status === "Active" ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {teachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-6">
                    <EmptyState
                      icon={GraduationCap}
                      title="No Teachers Found"
                      description="No teachers match your search."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          )}
          {pagination.totalPages > 1 && (
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
              <span className="text-xs font-semibold text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto !bg-white !text-[#002147]">
          <DialogHeader>
            <DialogTitle className="!text-[#002147]">
              {dialogMode === "view" && "Faculty Profile"}
              {dialogMode === "edit" && "Edit Faculty"}
              {dialogMode === "add" && "Add New Faculty"}
            </DialogTitle>
            <DialogDescription className="!text-slate-500">
              Register faculty details and assign active courses from the academic catalog.
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}

          {dialogMode === "view" && selected && (
            <div className="space-y-4 text-sm">
              <Row label="Faculty ID" value={selected.facultyCode} />
              <Row label="Name" value={selected.name} />
              <Row label="Department" value={selected.department} />
              <Row label="Designation" value={selected.designation} />
              <Row label="Email" value={selected.email} />
              <div className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/80 px-3 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#002147]/70">
                  Assigned Courses ({viewCourses.length})
                </p>
                <div className="mb-3 space-y-2">
                  {viewCourses.length === 0 ? (
                    <span className="text-sm text-slate-500">
                      No courses have been assigned yet.
                    </span>
                  ) : (
                    viewCourses.map((course) => (
                      <div
                        key={course.courseId || course.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#E5EBF3] bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                            {course.code}
                          </p>
                          <p className="font-semibold text-[#002147]">
                            {course.title}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() =>
                            void removeAssignedCourse(
                              course.courseId || course.id || ""
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={assignCourseId}
                    onValueChange={setAssignCourseId}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select course to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseOptions
                        .filter(
                          (c) =>
                            !viewCourses.some(
                              (v) => (v.courseId || v.id) === c.id
                            )
                        )
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                    disabled={!assignCourseId}
                    onClick={() => void assignCourseToTeacher()}
                  >
                    <Plus className="h-4 w-4" />
                    Assign Course
                  </Button>
                </div>
              </div>
              {selected.bio && (
                <div className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/80 px-3 py-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#002147]/70">
                    Bio
                  </p>
                  <p className="font-medium leading-relaxed text-[#002147]">
                    {selected.bio}
                  </p>
                </div>
              )}
            </div>
          )}

          {(dialogMode === "edit" || dialogMode === "add") && (
            <div className="flex flex-col gap-y-5">
              <div className="space-y-2">
                <label className={labelClass}>Full Name</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Dr. Amina Warsame"
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>Faculty</label>
                  <Select
                    value={form.facultyId}
                    onValueChange={(v) => {
                      const firstDept =
                        departmentOptions.find((d) => d.facultyId === v)?.id ??
                        "";
                      setForm((f) => ({
                        ...f,
                        facultyId: v,
                        departmentId: firstDept,
                      }));
                    }}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      {facultyOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {facultyFilterLabel(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Department</label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, departmentId: v }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentsForFaculty.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>Designation</label>
                  <Select
                    value={form.designation}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, designation: v }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Email</label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="name@dhapti.edu.so"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className={labelClass}>Assigned Courses</label>
                  <span className="text-xs font-bold text-[#ea580c]">
                    {form.assignedCourseIds.length} selected
                  </span>
                </div>
                <Input
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder="Search courses..."
                  className={fieldClass}
                />

                {form.assignedCourseIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3">
                    {form.assignedCourseIds.map((courseId) => {
                      const course = courseOptions.find((c) => c.id === courseId);
                      const label = course
                        ? `${course.code} — ${course.title}`
                        : courseId;
                      return (
                        <span
                          key={courseId}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#ea580c]/30 bg-white px-2 py-1 text-xs font-bold text-[#002147]"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => removeCourseFromForm(courseId)}
                            className="rounded-full p-0.5 text-[#ea580c] hover:bg-[#ea580c]/10"
                            aria-label={`Remove ${label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[#E5EBF3] bg-white p-2 shadow-sm">
                  {courseOptions
                    .filter((course) => {
                      const q = courseQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        course.code.toLowerCase().includes(q) ||
                        course.title.toLowerCase().includes(q)
                      );
                    })
                    .map((course) => {
                      const checked = form.assignedCourseIds.includes(course.id);
                      return (
                        <label
                          key={course.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                            checked
                              ? "bg-[#002147]/5 ring-1 ring-[#002147]/15"
                              : "hover:bg-[#F4F7FB]"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2",
                              checked
                                ? "border-[#002147] bg-[#002147] text-white"
                                : "border-[#CBD5E1] bg-white"
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleCourse(course.id)}
                          />
                          <span className="text-sm font-semibold text-[#002147]">
                            <span className="mr-2 text-xs font-bold text-[#ea580c]">
                              {course.code}
                            </span>
                            {course.title}
                          </span>
                        </label>
                      );
                    })}
                  {courseOptions.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No active courses available. Create courses in Faculties &amp;
                      Departments first.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Bio / Short Description</label>
                <textarea
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  rows={3}
                  placeholder="Brief academic profile or teaching focus..."
                  className={cn(
                    "w-full resize-none rounded-xl border border-[#E5EBF3] px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#ea580c]/20",
                    fieldClass
                  )}
                />
              </div>
              {dialogMode === "add" && (
                <p className="text-xs text-muted-foreground">
                  Initial password defaults to DHAPTI@2026 (hashed server-side).
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="border border-slate-200 bg-slate-100 font-semibold text-[#002147] hover:bg-slate-200 hover:text-[#002147] dark:border-slate-200 dark:bg-slate-100 dark:text-[#002147] dark:hover:bg-slate-200 dark:hover:text-[#002147]"
              onClick={() => setDialogMode(null)}
            >
              {dialogMode === "view" ? "Close" : "Cancel"}
            </Button>
            {dialogMode !== "view" && (
              <Button
                className="bg-[#002147] text-white hover:bg-[#003366]"
                onClick={() => void saveTeacher()}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : dialogMode === "add"
                    ? "Create Faculty"
                    : "Save Changes"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignedCoursesSummary({ courses }: { courses: string[] }) {
  if (courses.length === 0) {
    return (
      <span className="text-xs font-medium text-slate-400">No courses</span>
    );
  }

  const preview = courses.slice(0, 2).join(", ");
  const extra = courses.length > 2 ? ` +${courses.length - 2}` : "";

  return (
    <div className="flex max-w-[180px] flex-col gap-1" title={courses.join(", ")}>
      <span className="w-fit rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
        {courses.length} {courses.length === 1 ? "Course" : "Courses"}
      </span>
      <span className="max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400">
        {preview}
        {extra}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/80 px-3 py-2.5">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-bold text-[#002147]">{value}</span>
    </div>
  );
}
