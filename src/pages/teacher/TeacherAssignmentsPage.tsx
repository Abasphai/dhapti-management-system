import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Archive,
  Download,
  Eye,
  Pencil,
  PenLine,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";

import { FileDropzone } from "@/components/common/FileDropzone";
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
import { api, apiDownload, apiUpload, ApiError } from "@/lib/api";

type AccountStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type DialogMode = "create" | "edit" | "view" | "submissions" | null;

interface SubmissionRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  status: "SUBMITTED" | "LATE" | "MISSING";
  uiStatus: string;
  submittedAt: string | null;
  fileName: string | null;
  fileSize: number | null;
  submissionId: string | null;
  fileUrl?: string | null;
  studentNotes?: string | null;
  score?: number | null;
  feedback?: string | null;
  teacherFeedback?: string | null;
  maxMarks?: number;
  gradeStatus?: string;
  gradeUiStatus?: string;
  canEditGrade?: boolean;
  canSubmitGrade?: boolean;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueAt: string;
  maxMarks: number;
  status: string;
  accountStatus: AccountStatus;
  createdAt: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  classSectionId: string;
  course: { id: string; code: string; title: string };
  classSection: {
    id: string;
    section: string;
    academicYear: string;
    semester: string;
  };
}

interface ClassOption {
  id: string;
  courseId: string;
  section: string;
  academicYear: string;
  semester: string;
  courseCode: string;
  courseTitle: string;
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

const emptyForm = {
  classSectionId: "",
  title: "",
  description: "",
  instructions: "",
  dueAt: "",
  maxMarks: "5",
  status: "DRAFT" as AccountStatus,
};

function statusVariant(
  status: AccountStatus
): "secondary" | "success" | "warning" {
  if (status === "PUBLISHED") return "success";
  if (status === "ARCHIVED") return "warning";
  return "secondary";
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TeacherAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [instructionFile, setInstructionFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submissionRows, setSubmissionRows] = useState<SubmissionRow[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("ALL");
  const [submissionQuery, setSubmissionQuery] = useState("");
  const [submissionPagination, setSubmissionPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [gradingRow, setGradingRow] = useState<SubmissionRow | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradeSaving, setGradeSaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedQuery, statusFilter, classFilter, courseFilter]);

  useEffect(() => {
    void api<{ data: ClassOption[] }>("/teachers/me/classes")
      .then((res) => setClasses(res.data))
      .catch(() => setClasses([]));
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (classFilter !== "ALL") params.set("classSectionId", classFilter);
      if (courseFilter !== "ALL") params.set("courseId", courseFilter);

      const res = await api<ListResponse<AssignmentRow>>(
        `/assignments/me?${params}`
      );
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load assignments"
      );
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    statusFilter,
    classFilter,
    courseFilter,
  ]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; code: string; title: string }>();
    for (const c of classes) {
      map.set(c.courseId, {
        id: c.courseId,
        code: c.courseCode,
        title: c.courseTitle,
      });
    }
    return Array.from(map.values());
  }, [classes]);

  const stats = useMemo(() => {
    const draft = rows.filter((r) => r.accountStatus === "DRAFT").length;
    const published = rows.filter((r) => r.accountStatus === "PUBLISHED").length;
    const archived = rows.filter((r) => r.accountStatus === "ARCHIVED").length;
    return { draft, published, archived };
  }, [rows]);

  const openCreate = () => {
    setSelected(null);
    setActionError(null);
    setSuccessMessage(null);
    setInstructionFile(null);
    setUploadProgress(null);
    setForm({
      ...emptyForm,
      classSectionId: classes[0]?.id ?? "",
    });
    setDialogMode("create");
  };

  const openEdit = (row: AssignmentRow) => {
    setSelected(row);
    setActionError(null);
    setInstructionFile(null);
    setUploadProgress(null);
    setForm({
      classSectionId: row.classSectionId,
      title: row.title,
      description: row.description ?? "",
      instructions: row.instructions ?? "",
      dueAt: toLocalInput(row.dueAt),
      maxMarks: String(row.maxMarks),
      status: row.accountStatus,
    });
    setDialogMode("edit");
  };

  const openView = (row: AssignmentRow) => {
    setSelected(row);
    setActionError(null);
    setDialogMode("view");
  };

  const loadSubmissions = useCallback(
    async (assignmentId: string) => {
      setSubmissionsLoading(true);
      setActionError(null);
      try {
        const params = new URLSearchParams({
          page: String(submissionPagination.page),
          pageSize: String(submissionPagination.pageSize),
        });
        if (submissionQuery.trim()) params.set("q", submissionQuery.trim());
        if (submissionStatusFilter !== "ALL") {
          params.set("status", submissionStatusFilter);
        }
        const res = await api<ListResponse<SubmissionRow>>(
          `/assignments/${assignmentId}/submissions?${params}`
        );
        setSubmissionRows(res.data);
        setSubmissionPagination(res.pagination);
      } catch (err) {
        setSubmissionRows([]);
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Failed to load submissions"
        );
      } finally {
        setSubmissionsLoading(false);
      }
    },
    [
      submissionPagination.page,
      submissionPagination.pageSize,
      submissionQuery,
      submissionStatusFilter,
    ]
  );

  const openSubmissions = (row: AssignmentRow) => {
    setSelected(row);
    setActionError(null);
    setSuccessMessage(null);
    setSubmissionQuery("");
    setSubmissionStatusFilter("ALL");
    setSubmissionPagination((p) => ({ ...p, page: 1 }));
    setGradingRow(null);
    setGradeScore("");
    setGradeFeedback("");
    setDialogMode("submissions");
  };

  const openGradeModal = (row: SubmissionRow) => {
    if (!row.submissionId || !row.canEditGrade) return;
    setGradingRow(row);
    setGradeScore(row.score != null ? String(row.score) : "");
    setGradeFeedback(row.teacherFeedback || row.feedback || "");
    setActionError(null);
    setSuccessMessage(null);
  };

  const submitGrade = async () => {
    if (!gradingRow?.submissionId || !selected) return;
    const max = gradingRow.maxMarks ?? selected.maxMarks;
    const numeric = Number(gradeScore);
    if (gradeScore === "" || Number.isNaN(numeric) || numeric < 0 || numeric > max) {
      setActionError(`Score must be between 0 and ${max}`);
      return;
    }
    setGradeSaving(true);
    setActionError(null);
    try {
      await api(`/submissions/${gradingRow.submissionId}/grade`, {
        method: "PATCH",
        body: JSON.stringify({
          score: numeric,
          teacherFeedback: gradeFeedback.trim() || null,
        }),
      });
      setSuccessMessage(
        `Grade saved for ${gradingRow.studentName}: ${numeric}/${max}`
      );
      setGradingRow(null);
      setGradeScore("");
      setGradeFeedback("");
      await loadSubmissions(selected.id);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save grade"
      );
    } finally {
      setGradeSaving(false);
    }
  };

  useEffect(() => {
    if (dialogMode === "submissions" && selected) {
      void loadSubmissions(selected.id);
    }
  }, [dialogMode, selected, loadSubmissions]);

  const save = async () => {
    if (!form.title.trim() || form.title.trim().length < 2) {
      setActionError("Title is required (min 2 characters).");
      return;
    }
    if (dialogMode === "create" && !form.classSectionId) {
      setActionError("Class section is required.");
      return;
    }
    if (!form.dueAt) {
      setActionError("Due date is required.");
      return;
    }
    const maxMarks = Number(form.maxMarks);
    if (!Number.isInteger(maxMarks) || maxMarks <= 0) {
      setActionError("Maximum marks must be a positive whole number.");
      return;
    }

    setSaving(true);
    setActionError(null);
    setUploadProgress(null);
    try {
      const dueAt = new Date(form.dueAt).toISOString();
      let assignmentId: string | null = selected?.id ?? null;
      if (dialogMode === "create") {
        const created = await api<{ id: string }>("/assignments", {
          method: "POST",
          body: JSON.stringify({
            classSectionId: form.classSectionId,
            title: form.title.trim(),
            description: form.description.trim() || null,
            instructions: form.instructions.trim() || null,
            dueAt,
            maxMarks,
            status: form.status,
          }),
        });
        assignmentId = created.id;
        setSuccessMessage("Assignment created.");
      } else if (dialogMode === "edit" && selected) {
        await api(`/assignments/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim() || null,
            instructions: form.instructions.trim() || null,
            dueAt,
            maxMarks,
            status: form.status,
          }),
        });
        assignmentId = selected.id;
        setSuccessMessage("Assignment updated.");
      }

      if (instructionFile && assignmentId) {
        const formData = new FormData();
        formData.append("file", instructionFile);
        setUploadProgress(0);
        await apiUpload(
          `/assignments/${assignmentId}/materials`,
          formData,
          (p) => setUploadProgress(p)
        );
        setSuccessMessage((prev) =>
          prev
            ? `${prev} Instruction material attached.`
            : "Instruction material attached."
        );
      }

      setInstructionFile(null);
      setUploadProgress(null);
      setDialogMode(null);
      await loadAssignments();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save assignment"
      );
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (row: AssignmentRow, status: AccountStatus) => {
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api(`/assignments/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccessMessage(
        status === "PUBLISHED"
          ? "Assignment published."
          : status === "ARCHIVED"
            ? "Assignment archived."
            : "Status updated."
      );
      await loadAssignments();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update status"
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl">
            Assignments
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage assignments for your class sections.
          </p>
        </div>
        <Button
          className="shrink-0 bg-[#16a34a] text-white hover:bg-[#15803d]"
          onClick={openCreate}
          disabled={classes.length === 0}
        >
          <Plus className="h-4 w-4" />
          Create Assignment
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

      {classes.length === 0 && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have no active class sections yet. An admin must create a class
          for you before you can add assignments.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Draft</p>
            <p className="text-xl font-bold text-[#002147]">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Published</p>
            <p className="text-xl font-bold text-[#16a34a]">{stats.published}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Archived</p>
            <p className="text-xl font-bold text-[#E85D04]">{stats.archived}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="space-y-4 border-b border-[#E5EBF3] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, course, or section…"
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl lg:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl lg:w-48">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl lg:w-48">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.courseCode} Sec {c.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="px-6">Assignment Title</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      Loading assignments…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="space-y-3 py-12 text-center text-muted-foreground"
                    >
                      <p>No assignments yet.</p>
                      <Button
                        className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                        onClick={openCreate}
                        disabled={classes.length === 0}
                      >
                        <Plus className="h-4 w-4" />
                        Create Assignment
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="px-6 font-semibold text-[#002147]">
                        {row.title}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-bold uppercase text-[#16a34a]">
                          {row.courseCode || row.course.code}
                        </p>
                        <p className="text-sm">
                          {row.courseTitle || row.course.title}
                        </p>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {row.section || row.classSection.section}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDue(row.dueAt)}
                      </TableCell>
                      <TableCell>{row.maxMarks}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.accountStatus)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="View"
                            onClick={() => openView(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="View submissions"
                            onClick={() => openSubmissions(row)}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {row.accountStatus === "DRAFT" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Publish"
                              onClick={() => void setStatus(row, "PUBLISHED")}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {row.accountStatus !== "ARCHIVED" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Archive"
                              onClick={() => void setStatus(row, "ARCHIVED")}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
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
          className={`max-h-[90vh] overflow-y-auto bg-white text-[#002147] ${
            dialogMode === "submissions" ? "max-w-3xl" : "max-w-lg"
          }`}
        >
          <DialogHeader>
            <DialogTitle className="font-bold text-[#002147]">
              {dialogMode === "create"
                ? "Create Assignment"
                : dialogMode === "edit"
                  ? "Edit Assignment"
                  : dialogMode === "submissions"
                    ? "Submissions"
                    : "Assignment Details"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-slate-600">
              {dialogMode === "submissions" && selected
                ? `${selected.title} · ${selected.courseCode} Section ${selected.section}`
                : "Assignments belong to a class section. Students only see published assignments for classes they are enrolled in."}
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}

          {dialogMode === "view" && selected && (
            <div className="space-y-2 text-sm">
              <Detail label="Title" value={selected.title} />
              <Detail
                label="Course"
                value={`${selected.course.code} — ${selected.course.title}`}
              />
              <Detail label="Section" value={selected.classSection.section} />
              <Detail label="Due" value={formatDue(selected.dueAt)} />
              <Detail label="Max Marks" value={String(selected.maxMarks)} />
              <Detail label="Status" value={selected.status} />
              <Detail
                label="Description"
                value={selected.description || "—"}
              />
              <Detail
                label="Instructions"
                value={selected.instructions || "—"}
              />
              <DialogFooter className="pt-2 sm:justify-start">
                <Button
                  variant="outline"
                  onClick={() => openSubmissions(selected)}
                >
                  <Users className="h-4 w-4" />
                  View Submissions
                </Button>
              </DialogFooter>
            </div>
          )}

          {dialogMode === "submissions" && selected && (
            <div className="space-y-3">
              {gradingRow ? (
                <div className="space-y-4 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-4">
                  <div>
                    <p className="text-base font-bold text-[#002147]">
                      Grade Submission
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {gradingRow.studentName} · {gradingRow.studentCode}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    {gradingRow.studentNotes ? (
                      <blockquote className="min-w-0 flex-1 rounded-xl border-l-4 border-[#ea580c] bg-white px-3 py-2 text-xs italic text-slate-700">
                        <span className="mb-0.5 block text-[10px] font-bold not-italic uppercase tracking-wide text-[#002147]">
                          Student Notes
                        </span>
                        <span className="whitespace-pre-wrap not-italic font-medium">
                          {gradingRow.studentNotes}
                        </span>
                      </blockquote>
                    ) : (
                      <p className="flex-1 text-xs text-muted-foreground">
                        No submission notes
                      </p>
                    )}
                    {gradingRow.submissionId ? (
                      <a
                        href={
                          gradingRow.fileUrl ||
                          `/api/submissions/${gradingRow.submissionId}/file`
                        }
                        download={gradingRow.fileName || true}
                        onClick={(e) => {
                          e.preventDefault();
                          void apiDownload(
                            `/submissions/${gradingRow.submissionId}/file`,
                            gradingRow.fileName || "submission"
                          ).catch((err) =>
                            setActionError(
                              err instanceof ApiError
                                ? err.message
                                : "Download failed"
                            )
                          );
                        }}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#002147] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#16a34a]"
                      >
                        <Download size={14} />
                        Download Student Solution
                      </a>
                    ) : (
                      <Badge variant="secondary">No File Attached</Badge>
                    )}
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Marks / Score (out of{" "}
                      {gradingRow.maxMarks ?? selected.maxMarks})
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={gradingRow.maxMarks ?? selected.maxMarks}
                      step={0.5}
                      value={gradeScore}
                      onChange={(e) => setGradeScore(e.target.value)}
                      className="h-10 rounded-xl border-[#E5EBF3] bg-white"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Teacher Feedback / Evaluation Comments
                    </span>
                    <textarea
                      value={gradeFeedback}
                      onChange={(e) => setGradeFeedback(e.target.value)}
                      rows={4}
                      placeholder="Share constructive feedback with the student…"
                      className="w-full resize-none rounded-xl border border-[#E5EBF3] bg-white px-3 py-2.5 text-sm text-[#002147] outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                      disabled={gradeSaving}
                      onClick={() => void submitGrade()}
                    >
                      {gradeSaving ? "Saving…" : "Submit Grade"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={gradeSaving}
                      onClick={() => {
                        setGradingRow(null);
                        setGradeScore("");
                        setGradeFeedback("");
                      }}
                    >
                      Back to list
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={submissionQuery}
                      onChange={(e) => {
                        setSubmissionQuery(e.target.value);
                        setSubmissionPagination((p) => ({ ...p, page: 1 }));
                      }}
                      placeholder="Search student ID or name…"
                      className="h-9"
                    />
                    <Select
                      value={submissionStatusFilter}
                      onValueChange={(v) => {
                        setSubmissionStatusFilter(v);
                        setSubmissionPagination((p) => ({ ...p, page: 1 }));
                      }}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="SUBMITTED">Submitted</SelectItem>
                        <SelectItem value="MISSING">Missing</SelectItem>
                        <SelectItem value="LATE">Late</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-96 space-y-3 overflow-auto pr-1">
                    {submissionsLoading && (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Loading submissions…
                      </p>
                    )}
                    {!submissionsLoading && submissionRows.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No students match this filter.
                      </p>
                    )}
                    {!submissionsLoading &&
                      submissionRows.map((s) => (
                        <div
                          key={s.studentId}
                          className="rounded-xl border border-[#E5EBF3] bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-[#002147]">
                                {s.studentName}
                              </p>
                              <p className="text-xs font-semibold text-muted-foreground">
                                ID: {s.studentCode}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant={
                                  s.status === "SUBMITTED"
                                    ? "success"
                                    : s.status === "LATE"
                                      ? "warning"
                                      : "secondary"
                                }
                              >
                                {s.uiStatus}
                              </Badge>
                              <Badge
                                variant={
                                  s.gradeStatus === "APPROVED"
                                    ? "success"
                                    : s.gradeStatus === "PENDING_APPROVAL"
                                      ? "warning"
                                      : s.gradeStatus === "RETURNED"
                                        ? "danger"
                                        : "secondary"
                                }
                              >
                                {s.gradeUiStatus || "Not Graded"}
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Submitted:{" "}
                            {s.submittedAt ? formatDue(s.submittedAt) : "—"}
                            {s.score != null
                              ? ` · Score ${s.score}/${s.maxMarks ?? selected.maxMarks}`
                              : ""}
                          </p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                            {s.studentNotes ? (
                              <blockquote className="min-w-0 flex-1 rounded-xl border-l-4 border-[#ea580c] bg-[#F4F7FB] px-3 py-2 text-xs italic text-slate-700">
                                <span className="mb-0.5 block text-[10px] font-bold not-italic uppercase tracking-wide text-[#002147]">
                                  Student Notes
                                </span>
                                <span className="whitespace-pre-wrap not-italic font-medium">
                                  {s.studentNotes}
                                </span>
                              </blockquote>
                            ) : s.submissionId ? (
                              <p className="flex-1 text-xs text-muted-foreground">
                                No submission notes
                              </p>
                            ) : null}
                            <div className="flex shrink-0 flex-wrap gap-2">
                              {s.submissionId ? (
                                <a
                                  href={
                                    s.fileUrl ||
                                    `/api/submissions/${s.submissionId}/file`
                                  }
                                  download={s.fileName || true}
                                  title={s.fileName || "Download student solution"}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    void apiDownload(
                                      `/submissions/${s.submissionId}/file`,
                                      s.fileName || "submission"
                                    ).catch((err) =>
                                      setActionError(
                                        err instanceof ApiError
                                          ? err.message
                                          : "Download failed"
                                      )
                                    );
                                  }}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#16a34a]"
                                >
                                  <Download size={14} />
                                  Download Student Solution
                                </a>
                              ) : (
                                <Badge variant="secondary">No File Attached</Badge>
                              )}
                              {s.submissionId && s.canEditGrade && (
                                <Button
                                  size="sm"
                                  className="bg-[#E85D04] text-white hover:bg-[#c2410c]"
                                  onClick={() => openGradeModal(s)}
                                >
                                  <PenLine className="h-3.5 w-3.5" />
                                  Grade
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={submissionPagination.page <= 1}
                      onClick={() =>
                        setSubmissionPagination((p) => ({
                          ...p,
                          page: p.page - 1,
                        }))
                      }
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {submissionPagination.page} of{" "}
                      {submissionPagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        submissionPagination.page >=
                        submissionPagination.totalPages
                      }
                      onClick={() =>
                        setSubmissionPagination((p) => ({
                          ...p,
                          page: p.page + 1,
                        }))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {(dialogMode === "create" || dialogMode === "edit") && (
            <div className="space-y-3">
              {dialogMode === "create" && (
                <Field label="Class Section">
                  <Select
                    value={form.classSectionId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, classSectionId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.courseTitle} ({c.courseCode}) · Sec {c.section} ·{" "}
                          {c.academicYear} · {c.semester}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Title">
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Database Assignment 1"
                  className="assignment-modal-input"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="assignment-modal-input w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#002147] shadow-sm placeholder:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/35"
                  placeholder="Optional short description"
                />
              </Field>
              <Field label="Instructions">
                <textarea
                  value={form.instructions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, instructions: e.target.value }))
                  }
                  rows={3}
                  className="assignment-modal-input w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#002147] shadow-sm placeholder:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/35"
                  placeholder="Optional instructions for students"
                />
              </Field>
              <FileDropzone
                label="Attach Instruction Material (PDF, DOCX, ZIP - Max 500MB)"
                file={instructionFile}
                onFileChange={setInstructionFile}
                progress={uploadProgress}
                disabled={saving}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Due Date / Time">
                  <Input
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueAt: e.target.value }))
                    }
                    className="assignment-modal-input assignment-modal-datetime"
                  />
                </Field>
                <Field label="Maximum Marks (Dhapti: Max 5 total / 2.5 each if two)">
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={form.maxMarks}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const capped =
                        Number.isFinite(n) && n > 5 ? "5" : e.target.value;
                      setForm((f) => ({ ...f, maxMarks: capped }));
                    }}
                    className="assignment-modal-input"
                  />
                </Field>
              </div>
              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as AccountStatus,
                    }))
                  }
                >
                  <SelectTrigger className="assignment-modal-input border-slate-200 bg-white font-bold text-[#002147]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  onClick={() => setDialogMode(null)}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-6 py-2.5 font-bold text-[#002147] transition-all hover:bg-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-xl bg-[#16a34a] px-6 py-2.5 font-bold text-white hover:bg-[#15803d]"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save Assignment"}
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
      <span className="text-xs font-bold uppercase tracking-wider text-[#002147]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#E5EBF3] py-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap text-right font-semibold text-[#002147]">
        {value}
      </span>
    </div>
  );
}
