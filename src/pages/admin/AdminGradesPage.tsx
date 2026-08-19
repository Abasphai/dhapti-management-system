import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  Eye,
  RotateCcw,
  Search,
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

type AssessmentType = "ASSIGNMENT" | "QUIZ";

interface GradeRow {
  id: string;
  score: number | null;
  feedback: string | null;
  maxMarks: number;
  percentage: number | null;
  gradeStatus: string;
  status: string;
  returnReason: string | null;
  submittedAt: string;
  gradedAt: string | null;
  submittedForApprovalAt: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  studentCode: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  assignmentTitle: string;
  academicYear: string;
  semester: string;
  faculty?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string; code: string } | null;
}

interface QuizAttemptRow {
  id: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  gradeStatus: string;
  gradeUiStatus?: string;
  status: string;
  returnReason: string | null;
  submittedAt: string | null;
  attemptNumber: number;
  studentCode: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  quizTitle: string;
  academicYear: string;
  semester: string;
}

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

function gradeBadgeVariant(
  status: string
): "secondary" | "warning" | "success" | "danger" | "info" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING_APPROVAL") return "warning";
  if (status === "RETURNED") return "danger";
  if (status === "GRADED") return "info";
  return "secondary";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function AdminGradesPage() {
  const [assessmentType, setAssessmentType] =
    useState<AssessmentType>("ASSIGNMENT");

  const [rows, setRows] = useState<GradeRow[]>([]);
  const [quizRows, setQuizRows] = useState<QuizAttemptRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING_APPROVAL");
  const [facultyId, setFacultyId] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [courseId, setCourseId] = useState("ALL");
  const [academicYear, setAcademicYear] = useState("ALL");
  const [semester, setSemester] = useState("ALL");

  const [faculties, setFaculties] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [selectedGrade, setSelectedGrade] = useState<GradeRow | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizAttemptRow | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "approve" | "return" | null>(
    null
  );
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [
    debouncedQuery,
    statusFilter,
    facultyId,
    departmentId,
    courseId,
    academicYear,
    semester,
    assessmentType,
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
      if (facultyId !== "ALL") params.set("facultyId", facultyId);
      if (departmentId !== "ALL") params.set("departmentId", departmentId);
      if (courseId !== "ALL") params.set("courseId", courseId);
      if (academicYear !== "ALL") params.set("academicYear", academicYear);
      if (semester !== "ALL") params.set("semester", semester);

      const res = await api<ListResponse<GradeRow>>(`/grades?${params}`);
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load grades");
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    statusFilter,
    facultyId,
    departmentId,
    courseId,
    academicYear,
    semester,
  ]);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (statusFilter !== "ALL") params.set("gradeStatus", statusFilter);
      if (facultyId !== "ALL") params.set("facultyId", facultyId);
      if (departmentId !== "ALL") params.set("departmentId", departmentId);
      if (courseId !== "ALL") params.set("courseId", courseId);
      if (academicYear !== "ALL") params.set("academicYear", academicYear);
      if (semester !== "ALL") params.set("semester", semester);

      const res = await api<ListResponse<QuizAttemptRow>>(
        `/quiz-attempts?${params}`
      );
      setQuizRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load quiz attempts"
      );
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    statusFilter,
    facultyId,
    departmentId,
    courseId,
    academicYear,
    semester,
  ]);

  useEffect(() => {
    if (assessmentType === "ASSIGNMENT") {
      void loadAssignments();
    } else {
      void loadQuizzes();
    }
  }, [assessmentType, loadAssignments, loadQuizzes]);

  const filteredDepartments = departments.filter(
    (d) => facultyId === "ALL" || d.facultyId === facultyId
  );

  const reload = () =>
    assessmentType === "ASSIGNMENT" ? loadAssignments() : loadQuizzes();

  const openViewGrade = (row: GradeRow) => {
    setSelectedGrade(row);
    setSelectedQuiz(null);
    setDialogMode("view");
    setActionError(null);
  };

  const openApproveGrade = (row: GradeRow) => {
    setSelectedGrade(row);
    setSelectedQuiz(null);
    setDialogMode("approve");
    setActionError(null);
  };

  const openReturnGrade = (row: GradeRow) => {
    setSelectedGrade(row);
    setSelectedQuiz(null);
    setDialogMode("return");
    setReturnReason("");
    setActionError(null);
  };

  const openViewQuiz = (row: QuizAttemptRow) => {
    setSelectedQuiz(row);
    setSelectedGrade(null);
    setDialogMode("view");
    setActionError(null);
  };

  const openApproveQuiz = (row: QuizAttemptRow) => {
    setSelectedQuiz(row);
    setSelectedGrade(null);
    setDialogMode("approve");
    setActionError(null);
  };

  const openReturnQuiz = (row: QuizAttemptRow) => {
    setSelectedQuiz(row);
    setSelectedGrade(null);
    setDialogMode("return");
    setReturnReason("");
    setActionError(null);
  };

  const confirmApprove = async () => {
    setActing(true);
    setActionError(null);
    try {
      if (selectedGrade) {
        await api(`/grades/${selectedGrade.id}/approve`, { method: "POST" });
        setSuccessMessage(`Approved grade for ${selectedGrade.studentName}`);
      } else if (selectedQuiz) {
        await api(`/quiz-attempts/${selectedQuiz.id}/approve`, {
          method: "POST",
        });
        setSuccessMessage(
          `Approved quiz attempt for ${selectedQuiz.studentName}`
        );
      }
      setDialogMode(null);
      setSelectedGrade(null);
      setSelectedQuiz(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to approve"
      );
    } finally {
      setActing(false);
    }
  };

  const confirmReturn = async () => {
    setActing(true);
    setActionError(null);
    try {
      if (selectedGrade) {
        await api(`/grades/${selectedGrade.id}/return`, {
          method: "POST",
          body: JSON.stringify({ reason: returnReason.trim() || null }),
        });
        setSuccessMessage(`Returned grade for ${selectedGrade.studentName}`);
      } else if (selectedQuiz) {
        await api(`/quiz-attempts/${selectedQuiz.id}/return`, {
          method: "POST",
          body: JSON.stringify({ reason: returnReason.trim() || null }),
        });
        setSuccessMessage(
          `Returned quiz attempt for ${selectedQuiz.studentName}`
        );
      }
      setDialogMode(null);
      setSelectedGrade(null);
      setSelectedQuiz(null);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to return"
      );
    } finally {
      setActing(false);
    }
  };

  const dialogSubject =
    selectedGrade?.studentName || selectedQuiz?.studentName || "";
  const dialogTitleText =
    selectedGrade?.assignmentTitle || selectedQuiz?.quizTitle || "";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#002147]">
          Grade Review
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve or return teacher-submitted marks and quiz attempts. Students
          see scores only after approval.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={assessmentType === "ASSIGNMENT" ? "default" : "outline"}
          className={
            assessmentType === "ASSIGNMENT"
              ? "bg-[#002147] text-white hover:bg-[#003366]"
              : ""
          }
          onClick={() => setAssessmentType("ASSIGNMENT")}
        >
          Assignments
        </Button>
        <Button
          variant={assessmentType === "QUIZ" ? "default" : "outline"}
          className={
            assessmentType === "QUIZ"
              ? "bg-[#002147] text-white hover:bg-[#003366]"
              : ""
          }
          onClick={() => setAssessmentType("QUIZ")}
        >
          Quiz attempts
        </Button>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="space-y-3 border-b border-[#E5EBF3] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student, ID, course, teacher…"
                className="h-10 pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="RETURNED">Returned</SelectItem>
                {assessmentType === "ASSIGNMENT" && (
                  <SelectItem value="GRADED">Graded (draft)</SelectItem>
                )}
                <SelectItem value="ALL">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
                    {formatCourseOptionLabel(c.code, c.title ?? c.name ?? "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Academic year" />
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
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All semesters</SelectItem>
                {DHAPTI_SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {successMessage && (
            <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-[#16a34a]/20 bg-[#16a34a]/10 px-4 py-3 text-sm text-[#16a34a]">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          )}
          {error && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => void reload()}
              >
                Retry
              </Button>
            </div>
          )}

          {assessmentType === "ASSIGNMENT" ? (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Loading grades…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No grades match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6">
                        <p className="font-semibold">{row.studentName}</p>
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
                      <TableCell className="max-w-[160px] truncate">
                        {row.assignmentTitle}
                      </TableCell>
                      <TableCell>{row.teacherName}</TableCell>
                      <TableCell className="font-semibold">
                        {row.score}/{row.maxMarks}
                        {row.percentage != null ? ` (${row.percentage}%)` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={gradeBadgeVariant(row.gradeStatus)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="View"
                            onClick={() => openViewGrade(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {row.gradeStatus === "PENDING_APPROVAL" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                                onClick={() => openApproveGrade(row)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReturnGrade(row)}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Loading quiz attempts…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && quizRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No quiz attempts match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  quizRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6">
                        <p className="font-semibold">{row.studentName}</p>
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
                      <TableCell className="max-w-[160px] truncate">
                        {row.quizTitle}
                        <p className="text-xs text-muted-foreground">
                          Attempt #{row.attemptNumber}
                        </p>
                      </TableCell>
                      <TableCell>{row.teacherName}</TableCell>
                      <TableCell className="font-semibold">
                        {row.score}/{row.maxScore}
                        {row.percentage != null ? ` (${row.percentage}%)` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={gradeBadgeVariant(row.gradeStatus)}>
                          {row.gradeUiStatus || row.gradeStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="View"
                            onClick={() => openViewQuiz(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {row.gradeStatus === "PENDING_APPROVAL" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                                onClick={() => openApproveQuiz(row)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReturnQuiz(row)}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      <Dialog
        open={dialogMode != null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setSelectedGrade(null);
            setSelectedQuiz(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "approve"
                ? assessmentType === "QUIZ"
                  ? "Approve quiz attempt"
                  : "Approve grade"
                : dialogMode === "return"
                  ? assessmentType === "QUIZ"
                    ? "Reject quiz attempt"
                    : "Reject grade"
                  : assessmentType === "QUIZ"
                    ? "Quiz attempt details"
                    : "Grade details"}
            </DialogTitle>
            <DialogDescription>
              {dialogSubject
                ? `${dialogSubject} · ${dialogTitleText}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedGrade && (
            <div className="space-y-2 text-sm">
              <Detail
                label="Course"
                value={`${selectedGrade.courseCode} — ${selectedGrade.courseTitle}`}
              />
              <Detail label="Section" value={selectedGrade.section} />
              <Detail label="Teacher" value={selectedGrade.teacherName} />
              <Detail
                label="Score"
                value={`${selectedGrade.score}/${selectedGrade.maxMarks} (${selectedGrade.percentage}%)`}
              />
              <Detail label="Feedback" value={selectedGrade.feedback || "—"} />
              <Detail
                label="Submitted"
                value={formatDate(selectedGrade.submittedAt)}
              />
              <Detail
                label="Graded"
                value={formatDate(selectedGrade.gradedAt)}
              />
              <Detail
                label="For approval"
                value={formatDate(selectedGrade.submittedForApprovalAt)}
              />
              <Detail label="Status" value={selectedGrade.status} />
              <Detail
                label="Year / Semester"
                value={`${selectedGrade.academicYear} · ${selectedGrade.semester}`}
              />
            </div>
          )}

          {selectedQuiz && (
            <div className="space-y-2 text-sm">
              <Detail
                label="Course"
                value={`${selectedQuiz.courseCode} — ${selectedQuiz.courseTitle}`}
              />
              <Detail label="Section" value={selectedQuiz.section} />
              <Detail label="Teacher" value={selectedQuiz.teacherName} />
              <Detail label="Quiz" value={selectedQuiz.quizTitle} />
              <Detail
                label="Attempt"
                value={`#${selectedQuiz.attemptNumber}`}
              />
              <Detail
                label="Score"
                value={`${selectedQuiz.score}/${selectedQuiz.maxScore}${
                  selectedQuiz.percentage != null
                    ? ` (${selectedQuiz.percentage}%)`
                    : ""
                }`}
              />
              <Detail
                label="Submitted"
                value={formatDate(selectedQuiz.submittedAt)}
              />
              <Detail
                label="Status"
                value={selectedQuiz.gradeUiStatus || selectedQuiz.gradeStatus}
              />
              <Detail
                label="Year / Semester"
                value={`${selectedQuiz.academicYear} · ${selectedQuiz.semester}`}
              />
              {selectedQuiz.returnReason && (
                <Detail label="Return reason" value={selectedQuiz.returnReason} />
              )}
            </div>
          )}

          {dialogMode === "return" && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Return reason (optional)
              </span>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#E5EBF3] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E85D04]/20"
                placeholder="Explain what should be corrected…"
              />
            </label>
          )}

          {actionError && (
            <p className="text-sm text-red-600">{actionError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogMode(null);
                setSelectedGrade(null);
                setSelectedQuiz(null);
              }}
            >
              {dialogMode === "view" ? "Close" : "Cancel"}
            </Button>
            {dialogMode === "approve" && (
              <Button
                disabled={acting}
                className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                onClick={() => void confirmApprove()}
              >
                {acting ? "Approving…" : "Confirm approve"}
              </Button>
            )}
            {dialogMode === "return" && (
              <Button
                disabled={acting}
                variant="destructive"
                onClick={() => void confirmReturn()}
              >
                {acting ? "Rejecting…" : "Confirm reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#E5EBF3]/80 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-[#002147]">{value}</span>
    </div>
  );
}
