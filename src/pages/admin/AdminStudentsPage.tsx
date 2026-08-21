import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Eye,
  Pencil,
  Plus,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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
  DHAPTI_SEMESTERS,
  facultyFilterLabel,
  normalizeSemesterLabel,
  sortFacultiesForFilter,
} from "@/lib/biuFaculties";
import { cn } from "@/lib/utils";

type StudentStatus = "Active" | "Inactive" | "Suspended" | "Graduated";

interface StudentRow {
  id: string;
  studentCode: string;
  name: string;
  faculty: string;
  facultyId?: string | null;
  department?: string | null;
  departmentId?: string | null;
  semester: string;
  status: StudentStatus;
  email: string;
  phone: string;
  motherName?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  program?: string;
}

interface StudentOverview {
  student: StudentRow;
  enrolledCourses: Array<{
    enrollmentId: string;
    status: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    academicYear: string;
    semester: string;
  }>;
  attendancePercent: number | null;
  attendanceRecords: number;
  fees: {
    totalPaid: number;
    currentDue: number;
    status: string;
    currency: string;
  };
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
  facultyId: string;
}

interface ListResponse {
  data: StudentRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const STATUS_API: Record<StudentStatus, string> = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
  Suspended: "SUSPENDED",
  Graduated: "GRADUATED",
};

const selectTriggerClass =
  "border-[#E5EBF3] bg-white text-[#002147] dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]";
const compactLabelClass = "text-xs font-bold uppercase text-[#002147]";
const compactFieldClass =
  "h-10 rounded-xl border-[#E5EBF3] bg-white text-sm font-medium text-[#002147] placeholder:text-slate-400 dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]";
const compactSelectClass = cn(selectTriggerClass, "h-10");

type DialogMode = "view" | "edit" | "add" | null;

function statusBadgeVariant(
  status: StudentStatus
): "success" | "danger" | "secondary" | "outline" {
  if (status === "Active") return "success";
  if (status === "Suspended") return "danger";
  if (status === "Graduated") return "secondary";
  return "outline";
}

export function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<
    DepartmentOption[]
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [facultyId, setFacultyId] = useState("ALL");
  const [semester, setSemester] = useState("All Semesters");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    facultyId: "",
    departmentId: "",
    semester: "Semester 1",
    email: "",
    phone: "",
    address: "",
    status: "Active" as StudentStatus,
  });
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

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
    ])
      .then(([facRes, deptRes]) => {
        setFacultyOptions(sortFacultiesForFilter(facRes.data));
        setDepartmentOptions(deptRes.data);
      })
      .catch(() => {
        setFacultyOptions([]);
        setDepartmentOptions([]);
      });
  }, []);

  const departmentsForFaculty = useMemo(
    () =>
      departmentOptions.filter(
        (d) => !form.facultyId || d.facultyId === form.facultyId
      ),
    [departmentOptions, form.facultyId]
  );

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (facultyId !== "ALL") params.set("facultyId", facultyId);
      if (semester !== "All Semesters") params.set("semester", semester);

      const res = await api<ListResponse>(`/students?${params}`);
      setStudents(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load students"
      );
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    facultyId,
    semester,
  ]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedQuery, facultyId, semester]);

  const openView = (student: StudentRow) => {
    setSelected(student);
    setActionError(null);
    setOverview(null);
    setDialogMode("view");
    setOverviewLoading(true);
    void api<StudentOverview>(`/students/${student.id}/overview`)
      .then((res) => {
        setOverview(res);
        setSelected(res.student);
      })
      .catch((err) =>
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Failed to load student details"
        )
      )
      .finally(() => setOverviewLoading(false));
  };

  const openEdit = (student: StudentRow) => {
    setSelected(student);
    setOverview(null);
    setActionError(null);
    const facId = student.facultyId ?? facultyOptions[0]?.id ?? "";
    setForm({
      name: student.name,
      facultyId: facId,
      departmentId:
        student.departmentId ??
        departmentOptions.find((d) => d.facultyId === facId)?.id ??
        "",
      semester: normalizeSemesterLabel(student.semester) || "Semester 1",
      email: student.email,
      phone: student.phone,
      address: student.address ?? "",
      status: student.status,
    });
    setDialogMode("edit");
  };

  const openAdd = () => {
    setSelected(null);
    setOverview(null);
    setActionError(null);
    const facId = facultyOptions[0]?.id ?? "";
    setForm({
      name: "",
      facultyId: facId,
      departmentId:
        departmentOptions.find((d) => d.facultyId === facId)?.id ?? "",
      semester: "Semester 1",
      email: "",
      phone: "",
      address: "",
      status: "Active",
    });
    setDialogMode("add");
  };

  const toggleSuspend = async (student: StudentRow) => {
    setActionError(null);
    const next = student.status === "Active" ? "SUSPENDED" : "ACTIVE";
    const label = next === "SUSPENDED" ? "suspended" : "activated";
    try {
      await api(`/students/${student.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(`${student.name} ${label} successfully.`);
      await loadStudents();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update status";
      setActionError(message);
      toast.error(message);
    }
  };

  const saveStudent = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setActionError("Full name and email are required.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const selectedFaculty = facultyOptions.find(
        (f) => f.id === form.facultyId
      );
      if (dialogMode === "add") {
        await api("/students", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            address: form.address.trim() || undefined,
            semester: form.semester,
            facultyId: form.facultyId || undefined,
            departmentId: form.departmentId || undefined,
            program: selectedFaculty?.name,
          }),
        });
        toast.success("Student created successfully.");
      } else if (dialogMode === "edit" && selected) {
        await api(`/students/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            semester: form.semester,
            facultyId: form.facultyId || null,
            departmentId: form.departmentId || null,
            program: selectedFaculty?.name ?? null,
          }),
        });
        if (form.status !== selected.status) {
          await api(`/students/${selected.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: STATUS_API[form.status] }),
          });
        }
        toast.success("Student updated successfully.");
      }
      setDialogMode(null);
      await loadStudents();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to save student";
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl dark:text-slate-100">
            Manage Students
          </h1>
          <p className="mt-2 text-muted-foreground dark:text-slate-400">
            Search, filter, and manage student records across all faculties.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="shrink-0 bg-[#ea580c] text-white hover:bg-[#c2410c]"
        >
          <Plus className="h-4 w-4" />
          Add New Student
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
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
                placeholder="Search by name, student ID, or email..."
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9 text-[#002147] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <Select value={facultyId} onValueChange={setFacultyId}>
              <SelectTrigger
                className={cn("w-full lg:w-[260px]", selectTriggerClass)}
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
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger
                className={cn("w-full lg:w-[180px]", selectTriggerClass)}
              >
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Semesters">All Semesters</SelectItem>
                {DHAPTI_SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading students…"
              : `Showing ${students.length} of ${pagination.total} students · Page ${pagination.page} of ${pagination.totalPages}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton
              headers={[
                "Student ID",
                "Name",
                "Faculty",
                "Semester",
                "Status",
                "Actions",
              ]}
            />
          ) : (
            <div className="table-scroll">
              <Table className="w-full min-w-[720px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                    <TableHead className="w-[130px] whitespace-nowrap px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                      Student ID
                    </TableHead>
                    <TableHead className="w-[24%] px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                      Name
                    </TableHead>
                    <TableHead className="w-[22%] px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                      Faculty
                    </TableHead>
                    <TableHead className="w-[120px] whitespace-nowrap px-3 text-[11px] font-bold uppercase tracking-wider text-[#002147]">
                      Semester
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
                  {students.map((student) => (
                    <TableRow
                      key={student.id}
                      className="border-b border-slate-100 hover:bg-[#F4F7FB]/70 dark:border-slate-800 dark:hover:bg-slate-900/50"
                    >
                      <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {student.studentCode}
                      </TableCell>
                      <TableCell className="max-w-0 px-3 py-3">
                        <p className="truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                          {student.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {student.email}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 truncate px-3 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {student.faculty}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {student.semester || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3">
                        <Badge
                          variant={statusBadgeVariant(student.status)}
                          className="px-2.5 py-0.5"
                        >
                          {student.status === "Active"
                            ? "Active"
                            : student.status === "Graduated"
                              ? "Graduated"
                              : "Inactive"}
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
                            onClick={() => openView(student)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#ea580c] hover:bg-orange-50"
                            title="Edit Details"
                            onClick={() => openEdit(student)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={
                              student.status === "Active"
                                ? "h-8 w-8 text-red-600 hover:bg-red-50"
                                : "h-8 w-8 text-[#16a34a] hover:bg-green-50"
                            }
                            title={
                              student.status === "Active"
                                ? "Suspend"
                                : "Activate"
                            }
                            onClick={() => void toggleSuspend(student)}
                          >
                            {student.status === "Active" ? (
                              <Ban className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-6">
                        <EmptyState
                          icon={Users}
                          title="No Students Found"
                          description="No students match your search or filters."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && pagination.total > 0 && (
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
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setOverview(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto !bg-white !text-[#002147]",
            dialogMode === "add"
              ? "mx-auto max-w-xl rounded-[28px] border border-slate-100 p-6 shadow-2xl md:p-8"
              : "max-w-lg"
          )}
        >
          <DialogHeader className={dialogMode === "add" ? "space-y-1" : undefined}>
            <DialogTitle className="!text-[#002147]">
              {dialogMode === "view" && "Student Details"}
              {dialogMode === "edit" && "Edit Student"}
              {dialogMode === "add" && "Add New Student"}
            </DialogTitle>
            <DialogDescription className="!text-slate-500">
              {dialogMode === "view"
                ? "Profile, enrollments, attendance, and fee status."
                : dialogMode === "add"
                  ? "Create a student record across faculty, department, and semester."
                  : "Update faculty, department, semester, contact details, or status."}
            </DialogDescription>
          </DialogHeader>

          {actionError && dialogMode !== null && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}

          {dialogMode === "view" && selected && (
            <div className="space-y-4 text-sm">
              {overviewLoading ? (
                <p className="text-muted-foreground">Loading details…</p>
              ) : (
                <>
                  <div className="flex items-center gap-4 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3">
                    {selected.profilePhoto ? (
                      <img
                        src={selected.profilePhoto}
                        alt={selected.name}
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#002147] text-lg font-bold text-white">
                        {initials(selected.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-[#002147]">
                        {selected.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {selected.studentCode}
                      </p>
                      <Badge
                        variant={statusBadgeVariant(selected.status)}
                        className="mt-1"
                      >
                        {selected.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <DetailRow label="Email" value={selected.email} />
                    <DetailRow label="Phone" value={selected.phone || "—"} />
                    <DetailRow
                      label="Address"
                      value={selected.address || "—"}
                    />
                    <DetailRow label="Faculty" value={selected.faculty} />
                    <DetailRow
                      label="Department"
                      value={selected.department || "—"}
                    />
                    <DetailRow
                      label="Semester"
                      value={selected.semester || "—"}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#E5EBF3] bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-500">
                        Attendance
                      </p>
                      <p className="mt-1 text-xl font-bold text-[#002147]">
                        {overview?.attendancePercent != null
                          ? `${overview.attendancePercent}%`
                          : "N/A"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {overview?.attendanceRecords ?? 0} records
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5EBF3] bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-500">
                        Fees
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#002147]">
                        {overview?.fees.status ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Paid {overview?.fees.currency ?? "$"}
                        {(overview?.fees.totalPaid ?? 0).toLocaleString()} · Due{" "}
                        {overview?.fees.currency ?? "$"}
                        {(overview?.fees.currentDue ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Enrolled Courses
                    </p>
                    {(overview?.enrolledCourses?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No active enrollments.
                      </p>
                    ) : (
                      <ul className="max-h-40 space-y-2 overflow-y-auto">
                        {overview!.enrolledCourses.map((c) => (
                          <li
                            key={c.enrollmentId}
                            className="rounded-lg border border-[#E5EBF3] px-3 py-2"
                          >
                            <p className="font-semibold text-[#002147]">
                              {c.courseCode}: {c.courseTitle}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Sec {c.section} · {c.academicYear} · {c.semester}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {dialogMode === "add" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className={compactLabelClass}>Full Name</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Ahmed Mohamed Ali"
                  className={compactFieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={compactLabelClass}>Faculty</label>
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
                  <SelectTrigger className={compactSelectClass}>
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
              <div className="space-y-1.5">
                <label className={compactLabelClass}>Department</label>
                <Select
                  value={form.departmentId || undefined}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, departmentId: v }))
                  }
                >
                  <SelectTrigger className={compactSelectClass}>
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
              <div className="space-y-1.5">
                <label className={compactLabelClass}>Semester</label>
                <Select
                  value={form.semester}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, semester: v }))
                  }
                >
                  <SelectTrigger className={compactSelectClass}>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {DHAPTI_SEMESTERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={compactLabelClass}>Phone Number</label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+252 61 ..."
                  className={compactFieldClass}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className={compactLabelClass}>Email</label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="student@dhapti.edu.so"
                  className={compactFieldClass}
                />
              </div>
              <p className="text-[11px] font-medium text-slate-500 sm:col-span-2">
                Initial password defaults to DHAPTI@2026 (hashed server-side).
              </p>
            </div>
          )}

          {dialogMode === "edit" && (
            <div className="flex flex-col gap-y-5">
              <Field
                label="Full Name"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Ahmed Mohamed Ali"
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#002147]">
                    Faculty
                  </label>
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
                  <label className="text-xs font-bold uppercase text-[#002147]">
                    Department
                  </label>
                  <Select
                    value={form.departmentId || undefined}
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
                  <label className="text-xs font-bold uppercase text-[#002147]">
                    Semester
                  </label>
                  <Select
                    value={form.semester}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, semester: v }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {DHAPTI_SEMESTERS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#002147]">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        status: v as StudentStatus,
                      }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                      <SelectItem value="Graduated">Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Field
                label="Email"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="student@dhapti.edu.so"
              />
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="+252 61 ..."
              />
              <Field
                label="Address"
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="Campus / city address"
              />
            </div>
          )}

          <DialogFooter className={dialogMode === "add" ? "gap-3 sm:gap-3" : undefined}>
            <Button
              variant="outline"
              className={
                dialogMode === "add"
                  ? "rounded-xl border border-slate-200 bg-slate-100 px-6 py-2.5 font-bold text-[#002147] hover:bg-slate-200 hover:text-[#002147]"
                  : "border border-slate-200 bg-slate-100 font-semibold text-[#002147] hover:bg-slate-200 hover:text-[#002147] dark:border-slate-200 dark:bg-slate-100 dark:text-[#002147] dark:hover:bg-slate-200 dark:hover:text-[#002147]"
              }
              onClick={() => setDialogMode(null)}
            >
              {dialogMode === "view" ? "Close" : "Cancel"}
            </Button>
            {dialogMode !== "view" && (
              <Button
                className={
                  dialogMode === "add"
                    ? "rounded-xl bg-[#16a34a] px-8 py-2.5 font-bold text-white shadow-lg transition active:scale-95 hover:bg-[#15803d]"
                    : "bg-[#002147] text-white hover:bg-[#003366]"
                }
                onClick={() => void saveStudent()}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : dialogMode === "add"
                    ? "Create Student"
                    : "Save Changes"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] px-3 py-2.5">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-bold text-[#002147]">
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase text-[#002147]">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border-[#E5EBF3] bg-white text-[#002147] placeholder:text-slate-400 dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]"
      />
    </div>
  );
}
