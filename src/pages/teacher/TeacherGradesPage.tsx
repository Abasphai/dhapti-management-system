import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CheckCircle2,
  Download,
  PenLine,
  Send,
  X,
} from "lucide-react";

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
import { api, apiDownload, ApiError } from "@/lib/api";

interface AssignmentOption {
  id: string;
  title: string;
  maxMarks: number;
  accountStatus: string;
  courseCode: string;
  courseTitle: string;
  section: string;
}

interface GradeRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  submissionId: string | null;
  fileName: string | null;
  fileUrl?: string | null;
  submittedAt: string | null;
  hasSubmission: boolean;
  studentNotes?: string | null;
  score: number | null;
  feedback: string | null;
  teacherFeedback?: string | null;
  maxMarks: number;
  percentage: number | null;
  gradeStatus: string;
  status: string;
  returnReason: string | null;
  canEdit: boolean;
  canSubmit: boolean;
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

export function TeacherGradesPage() {
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [maxMarks, setMaxMarks] = useState(100);
  const [loading, setLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    void api<ListResponse<AssignmentOption>>(
      "/assignments/me?page=1&pageSize=100&status=PUBLISHED"
    )
      .then((res) => {
        setAssignments(res.data);
        if (res.data[0]) setAssignmentId(res.data[0].id);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Failed to load assignments"
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const loadGrades = useCallback(async () => {
    if (!assignmentId) {
      setRows([]);
      return;
    }
    setGradesLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (query.trim()) params.set("q", query.trim());
      const res = await api<
        ListResponse<GradeRow> & {
          assignment: { maxMarks: number; title: string };
        }
      >(`/assignments/${assignmentId}/grades?${params}`);
      setRows(res.data);
      setMaxMarks(res.assignment.maxMarks);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to load grades"
      );
      setRows([]);
    } finally {
      setGradesLoading(false);
    }
  }, [assignmentId, query]);

  useEffect(() => {
    void loadGrades();
    setActiveId(null);
    setMarks("");
    setFeedback("");
  }, [loadGrades]);

  const active = useMemo(
    () => rows.find((r) => r.submissionId === activeId) ?? null,
    [activeId, rows]
  );

  const stats = useMemo(() => {
    const withFile = rows.filter((r) => r.hasSubmission).length;
    const pending = rows.filter((r) => r.gradeStatus === "PENDING_APPROVAL").length;
    const returned = rows.filter((r) => r.gradeStatus === "RETURNED").length;
    return { withFile, pending, returned, total: rows.length };
  }, [rows]);

  const openGrading = (row: GradeRow) => {
    if (!row.submissionId || !row.canEdit) return;
    setActiveId(row.submissionId);
    setMarks(row.score != null ? String(row.score) : "");
    setFeedback(row.teacherFeedback || row.feedback || "");
    setSuccessMessage(null);
    setActionError(null);
  };

  const closeGrading = () => {
    setActiveId(null);
    setMarks("");
    setFeedback("");
  };

  const saveGrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!active?.submissionId || marks === "") return;
    const numeric = Number(marks);
    if (Number.isNaN(numeric) || numeric < 0 || numeric > maxMarks) {
      setActionError(`Score must be between 0 and ${maxMarks}`);
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await api(`/submissions/${active.submissionId}/grade`, {
        method: "PATCH",
        body: JSON.stringify({
          score: numeric,
          teacherFeedback: feedback.trim() || null,
        }),
      });
      setSuccessMessage(
        `Grade saved for ${active.studentName}: ${numeric}/${maxMarks}`
      );
      closeGrading();
      await loadGrades();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save grade"
      );
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async (submissionId: string, name: string) => {
    setSubmitting(true);
    setActionError(null);
    try {
      await api(`/submissions/${submissionId}/grade/submit`, {
        method: "POST",
      });
      setSuccessMessage(`Submitted ${name}'s grade for admin approval`);
      await loadGrades();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to submit grade"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Grading Interface"
        description="Enter marks, submit for admin approval. Students only see approved grades."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Enrolled</p>
            <p className="text-xl font-bold text-[#002147]">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Submitted files</p>
            <p className="text-xl font-bold text-[#E85D04]">{stats.withFile}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Pending approval</p>
            <p className="text-xl font-bold text-[#ca8a04]">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Returned</p>
            <p className="text-xl font-bold text-[#dc2626]">{stats.returned}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={assignmentId || undefined} onValueChange={setAssignmentId}>
          <SelectTrigger className="h-10 w-full sm:max-w-md">
            <SelectValue placeholder="Select assignment" />
          </SelectTrigger>
          <SelectContent>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.title} · {a.courseCode} · Sec {a.section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search student…"
          className="h-10 sm:max-w-xs"
        />
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading assignments…</p>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-[#16a34a]/20 bg-[#16a34a]/10 px-4 py-3 text-sm font-medium text-[#16a34a]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader className="border-b border-[#E5EBF3] pb-4">
            <h2 className="text-lg font-bold text-[#002147]">
              {selectedAssignment?.title ?? "Assignment grades"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Assignment (Max 5.0 total or 2.5 per assignment). Effective cap:{" "}
              {maxMarks}. Approved grades cannot be edited.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Student</TableHead>
                  <TableHead className="min-w-[280px]">Submission</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradesLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Loading grades…
                    </TableCell>
                  </TableRow>
                )}
                {!gradesLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No enrolled students for this assignment.
                    </TableCell>
                  </TableRow>
                )}
                {!gradesLoading &&
                  rows.map((row) => (
                    <TableRow
                      key={row.studentId}
                      className={
                        activeId === row.submissionId ? "bg-[#F4F7FB]" : undefined
                      }
                    >
                      <TableCell className="pl-6 align-top">
                        <p className="font-semibold text-[#002147]">
                          {row.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.studentCode}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          {row.studentNotes ? (
                            <blockquote className="min-w-0 flex-1 rounded-xl border-l-4 border-[#ea580c] bg-[#F4F7FB] px-3 py-2 text-xs italic text-slate-700">
                              <span className="mb-0.5 block text-[10px] font-bold not-italic uppercase tracking-wide text-[#002147]">
                                Student Notes
                              </span>
                              <span className="whitespace-pre-wrap not-italic font-medium">
                                {row.studentNotes}
                              </span>
                            </blockquote>
                          ) : (
                            <p className="flex-1 text-xs text-muted-foreground">
                              No submission notes
                            </p>
                          )}
                          {row.hasSubmission && row.submissionId ? (
                            <a
                              href={
                                row.fileUrl ||
                                `/api/submissions/${row.submissionId}/file`
                              }
                              download={row.fileName || true}
                              title={row.fileName || "Download student solution"}
                              onClick={(e) => {
                                e.preventDefault();
                                void apiDownload(
                                  `/submissions/${row.submissionId}/file`,
                                  row.fileName || "submission"
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
                            <Badge variant="secondary" className="shrink-0">
                              No File Attached
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.score != null ? `${row.score}/${row.maxMarks}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={gradeBadgeVariant(row.gradeStatus)}>
                          {row.status}
                        </Badge>
                        {row.returnReason && (
                          <p className="mt-1 max-w-[140px] text-[11px] text-red-600">
                            {row.returnReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          {row.canEdit && row.submissionId && (
                            <Button
                              size="sm"
                              className="bg-[#E85D04] text-white hover:bg-[#c2410c]"
                              onClick={() => openGrading(row)}
                            >
                              <PenLine className="h-4 w-4" />
                              Grade
                            </Button>
                          )}
                          {row.canSubmit && row.submissionId && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={submitting}
                              onClick={() =>
                                void submitForApproval(
                                  row.submissionId!,
                                  row.studentName
                                )
                              }
                            >
                              <Send className="h-4 w-4" />
                              Submit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-fit border-[#E5EBF3] shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between border-b border-[#E5EBF3] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#002147]">Grade Submission</h2>
              <p className="text-sm text-muted-foreground">
                {active
                  ? "Save marks, then submit for admin approval."
                  : "Select a student with a submission."}
              </p>
            </div>
            {active && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={closeGrading}
                aria-label="Close grading panel"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-6">
            {!active ? (
              <div className="rounded-xl border border-dashed border-[#E5EBF3] bg-[#F4F7FB] px-4 py-10 text-center text-sm text-muted-foreground">
                Click <span className="font-semibold text-[#E85D04]">Grade</span> on a
                submitted student to enter marks.
              </div>
            ) : (
              <form onSubmit={(e) => void saveGrade(e)} className="space-y-4">
                <div className="space-y-2 rounded-xl bg-[#F4F7FB] p-4">
                  <p className="text-base font-bold text-[#002147]">
                    {active.studentName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {active.studentCode} · {active.fileName}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary">
                      Assignment (Max {maxMarks})
                    </Badge>
                    <Badge variant={gradeBadgeVariant(active.gradeStatus)}>
                      {active.status}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    {active.studentNotes ? (
                      <blockquote className="rounded-xl border-l-4 border-[#ea580c] bg-white px-3 py-2 text-xs italic text-slate-700">
                        <span className="mb-0.5 block text-[10px] font-bold not-italic uppercase tracking-wide text-[#002147]">
                          Student Notes
                        </span>
                        <span className="whitespace-pre-wrap not-italic font-medium">
                          {active.studentNotes}
                        </span>
                      </blockquote>
                    ) : null}
                    {active.submissionId ? (
                      <a
                        href={
                          active.fileUrl ||
                          `/api/submissions/${active.submissionId}/file`
                        }
                        download={active.fileName || true}
                        onClick={(e) => {
                          e.preventDefault();
                          void apiDownload(
                            `/submissions/${active.submissionId}/file`,
                            active.fileName || "submission"
                          ).catch((err) =>
                            setActionError(
                              err instanceof ApiError
                                ? err.message
                                : "Download failed"
                            )
                          );
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#002147] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#16a34a]"
                      >
                        <Download size={14} />
                        Download Student Solution
                      </a>
                    ) : (
                      <Badge variant="secondary" className="w-fit">
                        No File Attached
                      </Badge>
                    )}
                  </div>
                  {active.returnReason && (
                    <p className="text-xs text-red-600">
                      Return reason: {active.returnReason}
                    </p>
                  )}
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assignment (Max 5.0 total or 2.5 per assignment) — cap {maxMarks}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={maxMarks}
                    step={0.5}
                    value={marks}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setMarks("");
                        return;
                      }
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setMarks(String(Math.min(maxMarks, Math.max(0, n))));
                    }}
                    placeholder={`0 – ${maxMarks}`}
                    className="h-10 rounded-xl border-[#E5EBF3] bg-white"
                    required
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Teacher Feedback / Evaluation Comments
                  </span>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={5}
                    placeholder="Share constructive feedback…"
                    className="w-full resize-none rounded-xl border border-[#E5EBF3] bg-white px-3 py-2.5 text-sm text-[#002147] outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                  />
                </label>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#16a34a] text-white hover:bg-[#15803d]"
                  >
                    {saving ? "Saving…" : "Submit Grade"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#E5EBF3]"
                    onClick={closeGrading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
