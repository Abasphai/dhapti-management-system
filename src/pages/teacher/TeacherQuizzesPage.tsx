import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Archive,
  ClipboardList,
  Lock,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
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

type QuizStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
type QuestionType =
  | "MULTIPLE_CHOICE_SINGLE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER";
type DialogMode = "create" | "edit" | "builder" | null;

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

interface ChoiceRow {
  id: string;
  label: string;
  orderIndex: number;
  isCorrect: boolean;
}

interface QuestionRow {
  id: string;
  type: QuestionType;
  prompt: string;
  marks: number;
  orderIndex: number;
  correctBoolean: boolean | null;
  acceptedAnswers: string[];
  choices: ChoiceRow[];
}

interface QuizRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: string;
  accountStatus: QuizStatus;
  totalMarks: number;
  durationMinutes: number;
  availableFrom: string | null;
  availableUntil: string | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  showResultAfterSubmit: boolean;
  classSectionId: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  questionCount: number;
  attemptCount?: number;
  course?: { id: string; code: string; title: string };
  classSection?: {
    id: string;
    section: string;
    academicYear: string;
    semester: string;
  };
  questions?: QuestionRow[];
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
  durationMinutes: "30",
  availableFrom: "",
  availableUntil: "",
  maxAttempts: "1",
  shuffleQuestions: false,
  shuffleChoices: false,
  showResultAfterSubmit: false,
};

const emptyQuestionForm = {
  type: "MULTIPLE_CHOICE_SINGLE" as QuestionType,
  prompt: "",
  marks: "5",
  correctBoolean: "true",
  acceptedAnswers: "",
  choices: [
    { label: "", isCorrect: true },
    { label: "", isCorrect: false },
  ],
};

function statusVariant(
  status: QuizStatus
): "secondary" | "success" | "warning" | "info" | "danger" {
  if (status === "PUBLISHED") return "success";
  if (status === "CLOSED") return "warning";
  if (status === "ARCHIVED") return "danger";
  return "secondary";
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function questionTypeLabel(type: QuestionType) {
  if (type === "MULTIPLE_CHOICE_SINGLE") return "Multiple choice";
  if (type === "TRUE_FALSE") return "True / False";
  return "Short answer";
}

export function TeacherQuizzesPage() {
  const [rows, setRows] = useState<QuizRow[]>([]);
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<QuizRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [builderQuiz, setBuilderQuiz] = useState<QuizRow | null>(null);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );
  const [questionSaving, setQuestionSaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [debouncedQuery, statusFilter, classFilter]);

  useEffect(() => {
    void api<{ data: ClassOption[] }>("/teachers/me/classes")
      .then((res) => setClasses(res.data))
      .catch(() => setClasses([]));
  }, []);

  const loadQuizzes = useCallback(async () => {
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

      const res = await api<ListResponse<QuizRow>>(`/quizzes/me?${params}`);
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    statusFilter,
    classFilter,
  ]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  const stats = useMemo(() => {
    const total = pagination.total;
    const draft = rows.filter((r) => r.accountStatus === "DRAFT").length;
    const published = rows.filter((r) => r.accountStatus === "PUBLISHED").length;
    return { total, draft, published };
  }, [rows, pagination.total]);

  const openCreate = () => {
    setSelected(null);
    setActionError(null);
    setSuccessMessage(null);
    setForm({
      ...emptyForm,
      classSectionId: classes[0]?.id ?? "",
    });
    setDialogMode("create");
  };

  const openEdit = (row: QuizRow) => {
    setSelected(row);
    setActionError(null);
    setSuccessMessage(null);
    setForm({
      classSectionId: row.classSectionId,
      title: row.title,
      description: row.description ?? "",
      instructions: row.instructions ?? "",
      durationMinutes: String(row.durationMinutes),
      availableFrom: toLocalInput(row.availableFrom),
      availableUntil: toLocalInput(row.availableUntil),
      maxAttempts: String(row.maxAttempts),
      shuffleQuestions: row.shuffleQuestions,
      shuffleChoices: row.shuffleChoices,
      showResultAfterSubmit: row.showResultAfterSubmit,
    });
    setDialogMode("edit");
  };

  const loadBuilder = async (quizId: string) => {
    setBuilderLoading(true);
    setActionError(null);
    try {
      const quiz = await api<QuizRow>(`/quizzes/${quizId}`);
      setBuilderQuiz(quiz);
      setSelected(quiz);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to load quiz questions"
      );
    } finally {
      setBuilderLoading(false);
    }
  };

  const openBuilder = (row: QuizRow) => {
    setActionError(null);
    setSuccessMessage(null);
    setQuestionForm(emptyQuestionForm);
    setEditingQuestionId(null);
    setDialogMode("builder");
    setBuilderQuiz(null);
    void loadBuilder(row.id);
  };

  const resetQuestionForm = () => {
    setQuestionForm(emptyQuestionForm);
    setEditingQuestionId(null);
  };

  const startEditQuestion = (q: QuestionRow) => {
    setEditingQuestionId(q.id);
    setQuestionForm({
      type: q.type,
      prompt: q.prompt,
      marks: String(q.marks),
      correctBoolean:
        q.correctBoolean === false
          ? "false"
          : q.type === "TRUE_FALSE" &&
              q.choices.find((c) => c.isCorrect)?.label?.toLowerCase() ===
                "false"
            ? "false"
            : "true",
      acceptedAnswers: (q.acceptedAnswers ?? []).join(", "),
      choices:
        q.type === "MULTIPLE_CHOICE_SINGLE" && q.choices.length >= 2
          ? q.choices.map((c) => ({
              label: c.label,
              isCorrect: c.isCorrect,
            }))
          : [
              { label: "", isCorrect: true },
              { label: "", isCorrect: false },
            ],
    });
  };

  const saveQuiz = async () => {
    if (!form.title.trim() || form.title.trim().length < 2) {
      setActionError("Title is required (min 2 characters).");
      return;
    }
    if (dialogMode === "create" && !form.classSectionId) {
      setActionError("Class section is required.");
      return;
    }
    const durationMinutes = Number(form.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setActionError("Duration must be a positive whole number of minutes.");
      return;
    }
    const maxAttempts = Number(form.maxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      setActionError("Max attempts must be a positive whole number.");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        durationMinutes,
        availableFrom: form.availableFrom
          ? new Date(form.availableFrom).toISOString()
          : null,
        availableUntil: form.availableUntil
          ? new Date(form.availableUntil).toISOString()
          : null,
        maxAttempts,
        shuffleQuestions: form.shuffleQuestions,
        shuffleChoices: form.shuffleChoices,
        showResultAfterSubmit: form.showResultAfterSubmit,
      };

      if (dialogMode === "create") {
        await api("/quizzes", {
          method: "POST",
          body: JSON.stringify({
            classSectionId: form.classSectionId,
            ...payload,
          }),
        });
        setSuccessMessage("Quiz created as draft.");
      } else if (dialogMode === "edit" && selected) {
        await api(`/quizzes/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Quiz updated.");
      }
      setDialogMode(null);
      await loadQuizzes();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save quiz"
      );
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (row: QuizRow, status: QuizStatus) => {
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api(`/quizzes/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSuccessMessage(
        status === "PUBLISHED"
          ? "Quiz published."
          : status === "CLOSED"
            ? "Quiz closed."
            : status === "ARCHIVED"
              ? "Quiz archived."
              : "Status updated."
      );
      await loadQuizzes();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update status"
      );
    }
  };

  const deleteQuiz = async (row: QuizRow) => {
    if (
      !window.confirm(
        `Delete draft quiz "${row.title}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    try {
      await api(`/quizzes/${row.id}`, { method: "DELETE" });
      setSuccessMessage("Draft quiz deleted.");
      await loadQuizzes();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to delete quiz"
      );
    }
  };

  const saveQuestion = async () => {
    if (!builderQuiz) return;
    if (!questionForm.prompt.trim()) {
      setActionError("Question prompt is required.");
      return;
    }
    const marks = Number(questionForm.marks);
    if (!Number.isInteger(marks) || marks <= 0) {
      setActionError("Marks must be a positive whole number.");
      return;
    }

    let body: Record<string, unknown> = {
      type: questionForm.type,
      prompt: questionForm.prompt.trim(),
      marks,
    };

    if (questionForm.type === "MULTIPLE_CHOICE_SINGLE") {
      const choices = questionForm.choices
        .map((c) => ({
          label: c.label.trim(),
          isCorrect: c.isCorrect,
        }))
        .filter((c) => c.label);
      if (choices.length < 2) {
        setActionError("Multiple choice needs at least 2 choices.");
        return;
      }
      if (choices.filter((c) => c.isCorrect).length !== 1) {
        setActionError("Select exactly one correct choice.");
        return;
      }
      body = { ...body, choices };
    } else if (questionForm.type === "TRUE_FALSE") {
      body = {
        ...body,
        correctBoolean: questionForm.correctBoolean === "true",
      };
    } else {
      const acceptedAnswers = questionForm.acceptedAnswers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      body = { ...body, acceptedAnswers };
    }

    setQuestionSaving(true);
    setActionError(null);
    try {
      const path = editingQuestionId
        ? `/quizzes/${builderQuiz.id}/questions/${editingQuestionId}`
        : `/quizzes/${builderQuiz.id}/questions`;
      const quiz = await api<QuizRow>(path, {
        method: editingQuestionId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setBuilderQuiz(quiz);
      resetQuestionForm();
      setSuccessMessage(
        editingQuestionId ? "Question updated." : "Question added."
      );
      await loadQuizzes();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save question"
      );
    } finally {
      setQuestionSaving(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!builderQuiz) return;
    if (!window.confirm("Delete this question?")) return;
    setQuestionSaving(true);
    setActionError(null);
    try {
      const quiz = await api<QuizRow>(
        `/quizzes/${builderQuiz.id}/questions/${questionId}`,
        { method: "DELETE" }
      );
      setBuilderQuiz(quiz);
      if (editingQuestionId === questionId) resetQuestionForm();
      setSuccessMessage("Question deleted.");
      await loadQuizzes();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to delete question"
      );
    } finally {
      setQuestionSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl">
            Quizzes
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create timed quizzes, build questions, and publish them to your
            classes.
          </p>
        </div>
        <Button
          className="shrink-0 bg-[#16a34a] text-white hover:bg-[#15803d]"
          onClick={openCreate}
          disabled={classes.length === 0}
        >
          <Plus className="h-4 w-4" />
          Create Quiz
        </Button>
      </div>

      {(error || actionError) && dialogMode === null && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error || actionError}
        </div>
      )}
      {successMessage && dialogMode === null && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {successMessage}
        </div>
      )}

      {classes.length === 0 && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have no active class sections yet. An admin must create a class
          for you before you can add quizzes.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-[#002147]">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Draft</p>
            <p className="text-xl font-bold text-[#E85D04]">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Published
            </p>
            <p className="text-xl font-bold text-[#16a34a]">{stats.published}</p>
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
              <SelectTrigger className="h-10 w-full rounded-xl lg:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
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
                  <TableHead className="px-6">Quiz Title</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      Loading quizzes…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="space-y-3 py-12 text-center text-muted-foreground"
                    >
                      <p>No quizzes yet.</p>
                      <Button
                        className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                        onClick={openCreate}
                        disabled={classes.length === 0}
                      >
                        <Plus className="h-4 w-4" />
                        Create Quiz
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
                          {row.courseCode || row.course?.code}
                        </p>
                        <p className="text-sm">
                          {row.courseTitle || row.course?.title}
                        </p>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {row.section || row.classSection?.section}
                      </TableCell>
                      <TableCell>{row.durationMinutes} min</TableCell>
                      <TableCell>{row.questionCount}</TableCell>
                      <TableCell>{row.totalMarks}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.accountStatus)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex justify-end gap-1">
                          {row.accountStatus === "DRAFT" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Question builder"
                                onClick={() => openBuilder(row)}
                              >
                                <ClipboardList className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Edit settings"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Publish"
                                onClick={() => void setStatus(row, "PUBLISHED")}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Delete draft"
                                onClick={() => void deleteQuiz(row)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {row.accountStatus === "PUBLISHED" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Edit limited settings"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Close quiz"
                                onClick={() => void setStatus(row, "CLOSED")}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {row.accountStatus === "CLOSED" && (
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
        open={dialogMode === "create" || dialogMode === "edit"}
        onOpenChange={(open) => !open && setDialogMode(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Create Quiz" : "Edit Quiz"}
            </DialogTitle>
            <DialogDescription>
              Quizzes belong to a class section. Students only see published
              quizzes during the availability window.
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}

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
                placeholder="e.g. Midterm Quiz 1"
                disabled={selected?.accountStatus === "PUBLISHED"}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Optional instructions for students"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Duration (minutes)">
                <Input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      durationMinutes: e.target.value,
                    }))
                  }
                  disabled={selected?.accountStatus === "PUBLISHED"}
                />
              </Field>
              <Field label="Max Attempts">
                <Input
                  type="number"
                  min={1}
                  value={form.maxAttempts}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxAttempts: e.target.value }))
                  }
                  disabled={selected?.accountStatus === "PUBLISHED"}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Available From">
                <Input
                  type="datetime-local"
                  value={form.availableFrom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, availableFrom: e.target.value }))
                  }
                  disabled={selected?.accountStatus === "PUBLISHED"}
                />
              </Field>
              <Field label="Available Until">
                <Input
                  type="datetime-local"
                  value={form.availableUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, availableUntil: e.target.value }))
                  }
                  disabled={selected?.accountStatus === "PUBLISHED"}
                />
              </Field>
            </div>
            <div className="space-y-2 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3">
              <ToggleRow
                label="Shuffle questions"
                checked={form.shuffleQuestions}
                disabled={selected?.accountStatus === "PUBLISHED"}
                onChange={(v) =>
                  setForm((f) => ({ ...f, shuffleQuestions: v }))
                }
              />
              <ToggleRow
                label="Shuffle choices"
                checked={form.shuffleChoices}
                disabled={selected?.accountStatus === "PUBLISHED"}
                onChange={(v) => setForm((f) => ({ ...f, shuffleChoices: v }))}
              />
              <ToggleRow
                label="Show result after submit"
                checked={form.showResultAfterSubmit}
                onChange={(v) =>
                  setForm((f) => ({ ...f, showResultAfterSubmit: v }))
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                disabled={saving}
                onClick={() => void saveQuiz()}
              >
                {saving ? "Saving…" : "Save Quiz"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogMode === "builder"}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setBuilderQuiz(null);
            resetQuestionForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Builder</DialogTitle>
            <DialogDescription>
              {builderQuiz
                ? `${builderQuiz.title} · Total marks: ${builderQuiz.totalMarks}`
                : "Load questions for this draft quiz."}
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {actionError}
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
              {successMessage}
            </p>
          )}

          {builderLoading && (
            <p className="py-8 text-center text-muted-foreground">
              Loading questions…
            </p>
          )}

          {!builderLoading && builderQuiz && (
            <div className="space-y-4">
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[#E5EBF3] p-3">
                {(builderQuiz.questions ?? []).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No questions yet. Add the first question below.
                  </p>
                )}
                {(builderQuiz.questions ?? []).map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#E5EBF3] bg-[#F4F7FB] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-[#E85D04]">
                        Q{idx + 1} · {questionTypeLabel(q.type)} · {q.marks}{" "}
                        marks
                      </p>
                      <p className="truncate text-sm font-medium text-[#002147]">
                        {q.prompt}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit"
                        onClick={() => startEditQuestion(q)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={() => void deleteQuestion(q.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-[#E5EBF3] p-4">
                <p className="text-sm font-bold text-[#002147]">
                  {editingQuestionId ? "Edit question" : "Add question"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Type">
                    <Select
                      value={questionForm.type}
                      onValueChange={(v) =>
                        setQuestionForm((f) => ({
                          ...f,
                          type: v as QuestionType,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MULTIPLE_CHOICE_SINGLE">
                          Multiple choice
                        </SelectItem>
                        <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                        <SelectItem value="SHORT_ANSWER">
                          Short answer
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Marks">
                    <Input
                      type="number"
                      min={1}
                      value={questionForm.marks}
                      onChange={(e) =>
                        setQuestionForm((f) => ({
                          ...f,
                          marks: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Prompt">
                  <textarea
                    value={questionForm.prompt}
                    onChange={(e) =>
                      setQuestionForm((f) => ({
                        ...f,
                        prompt: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Enter the question…"
                  />
                </Field>

                {questionForm.type === "MULTIPLE_CHOICE_SINGLE" && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-[#002147]">Choices</p>
                    {questionForm.choices.map((choice, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct-choice"
                          checked={choice.isCorrect}
                          onChange={() =>
                            setQuestionForm((f) => ({
                              ...f,
                              choices: f.choices.map((c, idx) => ({
                                ...c,
                                isCorrect: idx === i,
                              })),
                            }))
                          }
                        />
                        <Input
                          value={choice.label}
                          onChange={(e) =>
                            setQuestionForm((f) => ({
                              ...f,
                              choices: f.choices.map((c, idx) =>
                                idx === i
                                  ? { ...c, label: e.target.value }
                                  : c
                              ),
                            }))
                          }
                          placeholder={`Choice ${i + 1}`}
                        />
                        {questionForm.choices.length > 2 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setQuestionForm((f) => {
                                const next = f.choices.filter(
                                  (_, idx) => idx !== i
                                );
                                if (!next.some((c) => c.isCorrect) && next[0]) {
                                  next[0] = { ...next[0], isCorrect: true };
                                }
                                return { ...f, choices: next };
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {questionForm.choices.length < 8 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setQuestionForm((f) => ({
                            ...f,
                            choices: [
                              ...f.choices,
                              { label: "", isCorrect: false },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add choice
                      </Button>
                    )}
                  </div>
                )}

                {questionForm.type === "TRUE_FALSE" && (
                  <Field label="Correct answer">
                    <Select
                      value={questionForm.correctBoolean}
                      onValueChange={(v) =>
                        setQuestionForm((f) => ({
                          ...f,
                          correctBoolean: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {questionForm.type === "SHORT_ANSWER" && (
                  <Field label="Accepted answers (comma-separated)">
                    <Input
                      value={questionForm.acceptedAnswers}
                      onChange={(e) =>
                        setQuestionForm((f) => ({
                          ...f,
                          acceptedAnswers: e.target.value,
                        }))
                      }
                      placeholder="e.g. Paris, paris"
                    />
                  </Field>
                )}

                <div className="flex flex-wrap gap-2">
                  {editingQuestionId && (
                    <Button variant="outline" onClick={resetQuestionForm}>
                      Cancel edit
                    </Button>
                  )}
                  <Button
                    className="bg-[#002147] text-white hover:bg-[#003366]"
                    disabled={questionSaving}
                    onClick={() => void saveQuestion()}
                  >
                    {questionSaving
                      ? "Saving…"
                      : editingQuestionId
                        ? "Update Question"
                        : "Add Question"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Close
            </Button>
          </DialogFooter>
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

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-[#002147]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#E85D04]"
      />
    </label>
  );
}
