import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ClipboardList,
  Download,
  Hourglass,
  RefreshCw,
  Target,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { FileDropzone } from "@/components/common/FileDropzone";
import { CardGridSkeleton } from "@/components/common/TableSkeleton";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, apiDownload, apiUpload, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AssignmentMaterial {
  id: string;
  fileName: string;
  fileSize: number;
  attachmentUrl: string;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueAt: string;
  maxMarks: number;
  maxFileMb?: number;
  status: string;
  accountStatus: string;
  attachmentUrl?: string | null;
  materials?: AssignmentMaterial[];
  course: { id: string; code: string; title: string };
  teacher: { name: string; fullName?: string };
  classSection: {
    section: string;
    academicYear: string;
    semester: string;
  };
  /** Enriched client-side */
  mySubmission?: SubmissionMeta | null;
  submissionOpen?: boolean;
}

type CardStatus = "pending" | "submitted" | "graded" | "overdue";

interface SubmissionMeta {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  accountStatus: string;
  submittedAt: string;
  studentNotes?: string | null;
  score?: number | null;
  feedback?: string | null;
  teacherFeedback?: string | null;
  gradeStatus?: string;
  gradeUiStatus?: string;
  percentage?: number | null;
  gradedAt?: string | null;
}

interface SubmissionResponse {
  submission: SubmissionMeta | null;
  submissionOpen: boolean;
  dueAt: string;
}

interface ListResponse {
  data: AssignmentRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Title-case assignment names; expand bare "assignment N" using description when present */
function formatAssignmentTitle(title: string, description?: string | null) {
  const trimmed = title.trim();
  const cased = trimmed.replace(/\w\S*/g, (word) => {
    if (/^\d+$/.test(word)) return word;
    if (/^[A-Z]{2,}\d+$/i.test(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  const bare = /^assignment\s+(\d+)$/i.exec(trimmed);
  if (bare && description?.trim()) {
    const snippet = description
      .trim()
      .split(/[.\n]/)[0]
      .trim()
      .slice(0, 48);
    if (snippet.length > 3) {
      const snipCased = snippet.replace(/\w\S*/g, (w) =>
        /^\d+$/.test(w)
          ? w
          : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      );
      return `Assignment ${bare[1]}: ${snipCased}`;
    }
  }
  return cased;
}

function formatCountdown(dueAt: string, nowMs: number) {
  const diff = new Date(dueAt).getTime() - nowMs;
  if (diff <= 0) {
    return { overdue: true as const, label: "Deadline Passed / Closed" };
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) {
    return {
      overdue: false as const,
      label: `${days} Day${days === 1 ? "" : "s"} ${hours} Hour${hours === 1 ? "" : "s"} Left`,
    };
  }
  if (hours > 0) {
    return {
      overdue: false as const,
      label: `${hours} Hour${hours === 1 ? "" : "s"} Left`,
    };
  }
  return {
    overdue: false as const,
    label: `${Math.max(1, minutes)} Minute${minutes === 1 ? "" : "s"} Left`,
  };
}

function resolveCardStatus(
  assignment: AssignmentRow,
  nowMs: number
): CardStatus {
  const sub = assignment.mySubmission;
  if (sub?.gradeStatus === "APPROVED" && sub.score != null) return "graded";
  if (sub) return "submitted";
  if (new Date(assignment.dueAt).getTime() < nowMs) return "overdue";
  return "pending";
}

const STATUS_BADGE: Record<
  CardStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending Submission",
    className:
      "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40",
  },
  submitted: {
    label: "Submitted",
    className: "bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40",
  },
  graded: {
    label: "Graded",
    className: "bg-[#16a34a]/25 text-[#86efac] ring-1 ring-[#16a34a]/45",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-500/20 text-red-300 ring-1 ring-red-400/40",
  },
};

export function StudentAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [submissionInfo, setSubmissionInfo] =
    useState<SubmissionResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [studentNotes, setStudentNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ListResponse>(
        "/students/me/assignments?page=1&pageSize=50"
      );
      const enriched = await Promise.all(
        res.data.map(async (row) => {
          try {
            const sub = await api<SubmissionResponse>(
              `/assignments/${row.id}/submission`
            );
            return {
              ...row,
              mySubmission: sub.submission,
              submissionOpen: sub.submissionOpen,
            };
          } catch {
            return { ...row, mySubmission: null, submissionOpen: true };
          }
        })
      );
      setRows(enriched);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load assignments"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const openDetail = async (assignment: AssignmentRow) => {
    setSelected(assignment);
    setFile(null);
    setStudentNotes("");
    setSubError(null);
    setSuccess(null);
    setProgress(null);
    setSubLoading(true);
    try {
      const res = await api<SubmissionResponse>(
        `/assignments/${assignment.id}/submission`
      );
      setSubmissionInfo(res);
      setStudentNotes(res.submission?.studentNotes ?? "");
      setRows((prev) =>
        prev.map((r) =>
          r.id === assignment.id
            ? {
                ...r,
                mySubmission: res.submission,
                submissionOpen: res.submissionOpen,
              }
            : r
        )
      );
    } catch (err) {
      setSubmissionInfo(null);
      setSubError(
        err instanceof ApiError
          ? err.message
          : "Failed to load submission"
      );
    } finally {
      setSubLoading(false);
    }
  };

  const submitFile = async () => {
    if (!selected || !file) {
      setSubError("Choose a file to submit.");
      return;
    }
    const maxMb = selected.maxFileMb ?? 500;
    if (file.size > maxMb * 1024 * 1024) {
      setSubError(`File exceeds ${maxMb}MB limit`);
      return;
    }
    setUploading(true);
    setSubError(null);
    setSuccess(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("studentNotes", studentNotes.trim());
      await apiUpload(`/assignments/${selected.id}/submission`, form, (p) =>
        setProgress(p)
      );
      setFile(null);
      setSuccess("Submission saved successfully.");
      toast.success("Assignment submitted successfully!");
      const res = await api<SubmissionResponse>(
        `/assignments/${selected.id}/submission`
      );
      setSubmissionInfo(res);
      setStudentNotes(res.submission?.studentNotes ?? "");
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? {
                ...r,
                mySubmission: res.submission,
                submissionOpen: res.submissionOpen,
              }
            : r
        )
      );
    } catch (err) {
      setSubError(
        err instanceof ApiError ? err.message : "Failed to upload submission"
      );
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const downloadMaterial = async (assignment: AssignmentRow) => {
    const isPastDeadline = new Date(assignment.dueAt).getTime() < Date.now();
    if (isPastDeadline) {
      toast.error(
        "Assignment deadline has passed. Document download is closed."
      );
      return;
    }
    const material =
      assignment.materials?.[0] ??
      (assignment.attachmentUrl
        ? {
            id: "primary",
            fileName: "instruction-material",
            attachmentUrl: assignment.attachmentUrl,
          }
        : null);
    if (!material) return;
    try {
      const path = material.attachmentUrl.replace(/^\/api/, "");
      await apiDownload(path, material.fileName || "instruction-material");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to download material";
      toast.error(message);
      setSubError(message);
    }
  };

  const download = async () => {
    if (!submissionInfo?.submission) return;
    try {
      await apiDownload(
        `/submissions/${submissionInfo.submission.id}/file`,
        submissionInfo.submission.fileName
      );
    } catch (err) {
      setSubError(
        err instanceof ApiError ? err.message : "Failed to download file"
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Assignments"
        description="Published assignments from your active class enrollments."
      />

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            className="shrink-0 border-red-200 bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {loading && <CardGridSkeleton count={3} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No Pending Assignments"
          description="You’re all caught up. New assignments from your enrolled courses will appear here."
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((assignment, index) => {
            const isPastDeadline =
              new Date(assignment.dueAt).getTime() < nowMs;
            const hasSubmitted = Boolean(assignment.mySubmission);
            const cardStatus = resolveCardStatus(assignment, nowMs);
            const countdown = formatCountdown(assignment.dueAt, nowMs);
            const statusMeta = STATUS_BADGE[cardStatus];
            const hasMaterial = Boolean(
              assignment.attachmentUrl ||
                (assignment.materials && assignment.materials.length > 0)
            );
            const displayTitle = formatAssignmentTitle(
              assignment.title,
              assignment.description
            );
            const lecturer =
              assignment.teacher.name ||
              assignment.teacher.fullName ||
              "Lecturer";
            const materialLocked = isPastDeadline && !hasSubmitted;
            const submissionClosed = isPastDeadline && !hasSubmitted;

            let countdownBadge: {
              label: string;
              className: string;
            };
            if (cardStatus === "graded" && assignment.mySubmission?.score != null) {
              countdownBadge = {
                label: `Graded (${assignment.mySubmission.score}/${assignment.maxMarks})`,
                className:
                  "bg-[#16a34a]/20 text-[#86efac] shadow-[0_0_16px_rgba(22,163,74,0.25)] ring-1 ring-[#16a34a]/40",
              };
            } else if (cardStatus === "submitted") {
              countdownBadge = {
                label: "Submitted",
                className:
                  "bg-[#16a34a]/20 text-[#86efac] shadow-[0_0_16px_rgba(22,163,74,0.2)] ring-1 ring-[#16a34a]/35",
              };
            } else if (isPastDeadline) {
              countdownBadge = {
                label: "Deadline Passed - Access Closed",
                className:
                  "bg-red-500/25 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.3)] ring-1 ring-red-400/50",
              };
            } else {
              countdownBadge = {
                label: countdown.label,
                className:
                  "bg-amber-500/20 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.28)] ring-1 ring-amber-400/40",
              };
            }

            return (
              <motion.div
                key={assignment.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0f172a] p-5 shadow-lg shadow-[#0f172a]/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#16a34a]/10">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Badge className="bg-[#ea580c]/20 text-[#fdba74] hover:bg-[#ea580c]/25">
                      {assignment.course.code}
                    </Badge>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        statusMeta.className
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  {isPastDeadline && !hasSubmitted && (
                    <div className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-2 text-xs font-bold text-red-300 ring-1 ring-red-400/40">
                      🔴 Deadline Passed - Access Closed
                    </div>
                  )}

                  <h3 className="text-lg font-bold leading-snug text-white">
                    {displayTitle}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {assignment.course.title} — Section{" "}
                    {assignment.classSection.section}
                  </p>

                  <div className="mt-4 flex-1 space-y-2.5 text-sm">
                    <p className="flex items-start gap-2 text-slate-300">
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                      <span>
                        <span className="font-semibold text-slate-400">
                          Lecturer:{" "}
                        </span>
                        {lecturer}
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-slate-300">
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#ea580c]" />
                      <span>
                        <span className="font-semibold text-slate-400">
                          Due Date:{" "}
                        </span>
                        {formatDue(assignment.dueAt)}
                      </span>
                    </p>
                    <div className="flex items-start gap-2">
                      <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-slate-400">
                          Time Remaining
                        </p>
                        <span
                          className={cn(
                            "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                            countdownBadge.className
                          )}
                        >
                          {cardStatus === "graded"
                            ? "🎉"
                            : cardStatus === "submitted"
                              ? "✅"
                              : isPastDeadline
                                ? "🔴"
                                : "⏳"}{" "}
                          {countdownBadge.label}
                        </span>
                      </div>
                    </div>
                    <p className="flex items-start gap-2 text-slate-300">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <span>
                        <span className="font-semibold text-slate-400">
                          Maximum Marks:{" "}
                        </span>
                        {assignment.maxMarks} Points
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 space-y-2">
                    {hasMaterial && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={materialLocked || isPastDeadline}
                        className={cn(
                          "w-full rounded-xl border-slate-600 bg-transparent font-bold text-slate-200 hover:bg-slate-800 hover:text-white",
                          (materialLocked || isPastDeadline) &&
                            "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-200"
                        )}
                        onClick={() => {
                          if (materialLocked || isPastDeadline) return;
                          void downloadMaterial(assignment);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {materialLocked || isPastDeadline
                          ? "🔒 Material Locked (Deadline Passed)"
                          : "Download Material"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={submissionClosed}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-white",
                        submissionClosed
                          ? "cursor-not-allowed bg-slate-600 opacity-50"
                          : "bg-[#16a34a] hover:bg-[#15803d]"
                      )}
                      onClick={() => {
                        if (submissionClosed) return;
                        void openDetail(assignment);
                      }}
                    >
                      {submissionClosed
                        ? "Submission Closed"
                        : hasSubmitted
                          ? "View Submission"
                          : "View & Submit"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          className={cn(
            "mx-auto w-full max-w-2xl overflow-x-hidden overflow-y-auto",
            "max-h-[90vh] rounded-[32px] bg-white p-6 text-slate-900 shadow-2xl md:p-8",
            "gap-0 sm:rounded-[32px]"
          )}
        >
          {selected && (
            <div className="min-w-0 w-full max-w-full space-y-0 overflow-x-hidden">
              <DialogHeader className="mb-5 min-w-0 pr-8">
                <DialogTitle className="truncate font-bold text-slate-900">
                  {formatAssignmentTitle(
                    selected.title,
                    selected.description
                  )}
                </DialogTitle>
                <DialogDescription className="truncate font-medium text-slate-500">
                  {selected.course.code} — {selected.course.title} · Section{" "}
                  {selected.classSection.section}
                </DialogDescription>
              </DialogHeader>

              {/* Assignment details */}
              <div className="mb-6 min-w-0 max-w-full space-y-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 p-6">
                <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                  <p className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Subject
                    </span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-900">
                      {selected.course.code} — {selected.course.title}
                    </span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Teacher
                    </span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-900">
                      {selected.teacher.name || selected.teacher.fullName}
                    </span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Due Date
                    </span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-900">
                      {formatDue(selected.dueAt)}
                    </span>
                  </p>
                  <p className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Max Marks
                    </span>
                    <span className="mt-0.5 block font-semibold text-slate-900">
                      {selected.maxMarks}
                    </span>
                  </p>
                </div>

                <div className="min-w-0 border-t border-slate-200/80 pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-1 break-words whitespace-pre-wrap text-sm font-medium text-slate-700">
                    {selected.description || "No description provided."}
                  </p>
                </div>

                {selected.instructions && (
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Instructions
                    </p>
                    <p className="mt-1 break-words whitespace-pre-wrap text-sm font-medium text-slate-700">
                      {selected.instructions}
                    </p>
                  </div>
                )}

                {(selected.attachmentUrl ||
                  (selected.materials && selected.materials.length > 0)) && (
                  <Button
                    type="button"
                    disabled={new Date(selected.dueAt).getTime() < Date.now()}
                    onClick={() => {
                      if (new Date(selected.dueAt).getTime() < Date.now()) return;
                      void downloadMaterial(selected);
                    }}
                    title={
                      selected.materials?.[0]?.fileName || "Download material"
                    }
                    className={cn(
                      "flex w-full min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#002147]/15 bg-[#002147] px-4 font-bold text-white hover:bg-[#003366]",
                      new Date(selected.dueAt).getTime() < Date.now() &&
                        "cursor-not-allowed opacity-50 hover:bg-[#002147]"
                    )}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    {new Date(selected.dueAt).getTime() < Date.now() ? (
                      <span className="truncate">
                        Material Locked (Deadline Passed)
                      </span>
                    ) : (
                      <span className="min-w-0 max-w-full truncate">
                        Download Material
                        {selected.materials?.[0]?.fileName
                          ? ` · ${selected.materials[0].fileName}`
                          : ""}
                      </span>
                    )}
                  </Button>
                )}
              </div>

              {submissionInfo?.submission?.gradeStatus === "APPROVED" &&
                submissionInfo.submission.score != null && (
                  <div className="mb-6 min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#16a34a]/30 bg-[#16a34a]/10 p-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">Teacher Feedback</p>
                      <Badge variant="success">
                        {submissionInfo.submission.score}/{selected.maxMarks}
                        {submissionInfo.submission.percentage != null
                          ? ` · ${submissionInfo.submission.percentage}%`
                          : ""}
                      </Badge>
                    </div>
                    <p className="mt-2 break-words whitespace-pre-wrap text-sm font-medium text-slate-800">
                      {submissionInfo.submission.teacherFeedback ||
                        submissionInfo.submission.feedback ||
                        "No written comments from the lecturer."}
                    </p>
                  </div>
                )}

              {submissionInfo?.submission &&
                ["GRADED", "PENDING_APPROVAL"].includes(
                  submissionInfo.submission.gradeStatus || ""
                ) && (
                  <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    Your submission has been graded and is pending university
                    approval. Marks and feedback will appear here once approved.
                  </div>
                )}

              {/* Your submission */}
              <div className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">Your Submission</p>
                  {submissionInfo?.submission && (
                    <Badge variant="success">Submitted</Badge>
                  )}
                </div>

                {subLoading && (
                  <p className="text-sm font-medium text-slate-500">
                    Loading submission…
                  </p>
                )}
                {subError && (
                  <p className="break-words rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {subError}
                  </p>
                )}
                {success && (
                  <p className="break-words rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
                    {success}
                  </p>
                )}

                {!subLoading && submissionInfo && (
                  <>
                    {submissionInfo.submission ? (
                      <div className="min-w-0 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p
                          className="max-w-full truncate text-sm font-bold text-slate-900"
                          title={submissionInfo.submission.fileName}
                        >
                          {submissionInfo.submission.fileName}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          {formatBytes(submissionInfo.submission.fileSize)} ·{" "}
                          Submitted{" "}
                          {formatDue(submissionInfo.submission.submittedAt)}
                        </p>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => void download()}
                          className="rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-700 hover:bg-slate-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-slate-600">
                        No file submitted yet.
                      </p>
                    )}

                    {submissionInfo.submissionOpen ? (
                      <div className="min-w-0 space-y-3 border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-[#16a34a]">
                          Submission open
                          {selected.maxFileMb
                            ? ` · Max ${selected.maxFileMb}MB`
                            : " · Max 500MB"}
                        </p>
                        <FileDropzone
                          label="Attach your submission file (PDF, DOCX, ZIP - Max 500MB)"
                          file={file}
                          onFileChange={setFile}
                          progress={progress}
                          disabled={uploading}
                          error={null}
                          className="min-w-0 max-w-full [&_label]:border-slate-300 [&_label]:bg-white [&_label]:hover:bg-slate-50"
                        />
                        <label className="block min-w-0 space-y-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Submission Notes / Comment for Lecturer
                          </span>
                          <textarea
                            value={studentNotes}
                            onChange={(e) => setStudentNotes(e.target.value)}
                            rows={3}
                            disabled={uploading}
                            placeholder="Optional message to your lecturer about this submission…"
                            className="w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]/20"
                          />
                        </label>
                        {submissionInfo.submission?.studentNotes && !file && (
                          <p className="break-words text-xs font-medium text-slate-500">
                            Last notes:{" "}
                            {submissionInfo.submission.studentNotes}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="font-bold text-red-700">
                          Submission closed
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          Due: {formatDue(submissionInfo.dueAt)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200"
                >
                  Cancel
                </Button>
                {submissionInfo?.submissionOpen && (
                  <Button
                    type="button"
                    disabled={uploading || !file}
                    onClick={() => void submitFile()}
                    className="rounded-xl bg-[#16a34a] px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#15803d] active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading
                      ? "Please wait…"
                      : submissionInfo.submission
                        ? "Replace & Confirm Submit"
                        : "Confirm Submit"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
