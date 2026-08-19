import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Lock, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import {
  OfficialAcademicTranscript,
  type TranscriptStudentIdentity,
} from "@/components/student/OfficialAcademicTranscript";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Typical undergraduate program credit target for progress display */
const DEGREE_CREDIT_TARGET = 148;

interface FinancialHold {
  active: boolean;
  pendingDues: number;
  hasOverdue: boolean;
  currency: string;
  message: string | null;
}

interface AssessmentRow {
  id: string;
  assessmentType: string;
  assessmentTitle: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  teacherName: string;
  score: number | null;
  maxMarks: number;
  percentage: number | null;
  feedback: string | null;
  academicYear: string;
  semester: string;
}

interface CourseResultRow {
  id: string;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  marks: number | null;
  maxMarks: number;
  letterGradeDisplay: string;
  gradePointDisplay: string;
  academicYear: string;
  semester: string;
  status: string;
  componentDisplay?: {
    midterm: string;
    finalExam: string;
    assignment: string;
    quiz: string;
    presentation: string;
    attendance: string;
  } | null;
}

interface GpaSummary {
  status: string;
  message: string;
  cumulativeGpa: number | null;
  totalCredits: number;
  semesters: Array<{
    academicYear: string;
    semester: string;
    credits: number;
    gpa: number | null;
  }>;
}

interface TranscriptPayload {
  terms: Array<{
    academicYear: string;
    semester: string;
    credits: number;
    semesterGpa: number | null;
    courses: CourseResultRow[];
  }>;
  overall: {
    totalCredits: number;
    courseCount: number;
    cumulativeGpa: number | null;
    gpaStatus: string;
    gpaMessage: string;
  };
}

type Tab = "assessments" | "courses" | "gpa";

interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function letterGradeBadgeClass(letter: string) {
  const gl = letter.trim().toUpperCase();
  if (gl === "A+" || gl === "A" || gl === "A-") {
    return "bg-green-500/15 text-green-600 border border-green-500/30 dark:text-green-400";
  }
  if (gl.startsWith("B")) {
    return "bg-blue-500/15 text-blue-600 border border-blue-500/30 dark:text-blue-400";
  }
  if (gl.startsWith("C")) {
    return "bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:text-amber-400";
  }
  if (gl === "F" || gl === "—" || gl === "-") {
    return "bg-red-500/15 text-red-600 border border-red-500/30 dark:text-red-400";
  }
  return "bg-slate-500/15 text-slate-600 border border-slate-500/30 dark:text-slate-300";
}

function academicStanding(cgpa: number | null): {
  label: string;
  className: string;
} {
  if (cgpa == null) {
    return {
      label: "Pending",
      className:
        "bg-slate-500/15 text-slate-600 border border-slate-500/30 dark:text-slate-300",
    };
  }
  if (cgpa >= 2) {
    return {
      label: "Good Standing",
      className:
        "bg-green-500/15 text-green-700 border border-green-500/30 dark:text-green-400",
    };
  }
  if (cgpa >= 1) {
    return {
      label: "Academic Probation",
      className:
        "bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:text-amber-400",
    };
  }
  return {
    label: "Critical Standing",
    className:
      "bg-red-500/15 text-red-700 border border-red-500/30 dark:text-red-400",
  };
}

function ComponentPills({
  components,
}: {
  components: NonNullable<CourseResultRow["componentDisplay"]>;
}) {
  const pills = [
    { label: "Midterm", value: components.midterm },
    { label: "Final", value: components.finalExam },
    { label: "Assignments", value: components.assignment },
    { label: "Quiz", value: components.quiz },
    { label: "Presentation", value: components.presentation },
    { label: "Attendance", value: components.attendance },
  ];
  return (
    <div className="flex max-w-[320px] flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
        >
          {pill.label}: {pill.value}
        </span>
      ))}
    </div>
  );
}

function deriveRollNo(studentCode: string): string {
  const digits = studentCode.replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  if (digits.length === 1) return digits;
  return "—";
}

function deriveSession(
  academicYear?: string | null,
  batch?: string | null
): string {
  if (academicYear && /\d{4}/.test(academicYear)) return academicYear;
  if (batch && /^\d{4}$/.test(batch)) return `${batch}-${Number(batch) + 1}`;
  return "2025-2026";
}

export function StudentResultsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("assessments");
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [courseRows, setCourseRows] = useState<CourseResultRow[]>([]);
  const [gpa, setGpa] = useState<GpaSummary | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  const [transcriptStudent, setTranscriptStudent] =
    useState<TranscriptStudentIdentity | null>(null);
  const [hold, setHold] = useState<FinancialHold | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyHoldError = (err: unknown) => {
    if (err instanceof ApiError && err.code === "FINANCIAL_HOLD") {
      setHold({
        active: true,
        pendingDues: 0,
        hasOverdue: true,
        currency: "$",
        message: err.message,
      });
      return true;
    }
    return false;
  };

  const loadHold = useCallback(async () => {
    try {
      const status = await api<FinancialHold>("/students/me/financial-hold");
      setHold(status);
      return status;
    } catch {
      setHold(null);
      return null;
    }
  }, []);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await loadHold();
      if (status?.active) {
        setRows([]);
        return;
      }
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      const res = await api<ListResponse<AssessmentRow>>(
        `/students/me/results?${params}`
      );
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      if (!applyHoldError(err)) {
        setError(err instanceof ApiError ? err.message : "Failed to load results");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadHold, pagination.page, pagination.pageSize]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await loadHold();
      if (status?.active) {
        setCourseRows([]);
        return;
      }
      const [res, g, t] = await Promise.all([
        api<ListResponse<CourseResultRow>>(
          "/students/me/course-results?pageSize=50"
        ),
        api<GpaSummary>("/students/me/gpa").catch(() => null),
        api<TranscriptPayload>("/students/me/transcript").catch(() => null),
      ]);
      setCourseRows(res.data);
      if (g) setGpa(g);
      if (t) setTranscript(t);
    } catch (err) {
      if (!applyHoldError(err)) {
        setError(
          err instanceof ApiError ? err.message : "Failed to load course results"
        );
      }
      setCourseRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadHold]);

  const loadGpa = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await loadHold();
      if (status?.active) {
        setGpa(null);
        setTranscript(null);
        setTranscriptStudent(null);
        return;
      }
      const [g, t, me] = await Promise.all([
        api<GpaSummary>("/students/me/gpa"),
        api<TranscriptPayload>("/students/me/transcript"),
        api<{
          fullName?: string;
          name?: string;
          studentCode?: string;
          batch?: string | null;
          semester?: string | null;
        }>("/students/me").catch(() => null),
      ]);
      setGpa(g);
      setTranscript(t);

      const profile = (user?.profile ?? {}) as Record<string, unknown>;
      const fullName =
        me?.fullName ||
        me?.name ||
        (typeof profile.fullName === "string" ? profile.fullName : null) ||
        user?.email ||
        "Student";
      const registrationNo =
        me?.studentCode ||
        (typeof profile.studentCode === "string" ? profile.studentCode : null) ||
        "—";
      const latestYear =
        t.terms[t.terms.length - 1]?.academicYear ||
        (typeof profile.batch === "string" ? profile.batch : null) ||
        me?.batch ||
        null;

      setTranscriptStudent({
        fullName,
        registrationNo,
        rollNo: deriveRollNo(registrationNo),
        session: deriveSession(latestYear, me?.batch ?? null),
      });
    } catch (err) {
      if (!applyHoldError(err)) {
        setError(err instanceof ApiError ? err.message : "Failed to load GPA");
      }
      setGpa(null);
      setTranscript(null);
      setTranscriptStudent(null);
    } finally {
      setLoading(false);
    }
  }, [loadHold, user?.email, user?.profile]);

  useEffect(() => {
    if (tab === "assessments") void loadAssessments();
    if (tab === "courses") void loadCourses();
    if (tab === "gpa") void loadGpa();
  }, [tab, loadAssessments, loadCourses, loadGpa]);

  const reload = () => {
    if (tab === "assessments") void loadAssessments();
    if (tab === "courses") void loadCourses();
    if (tab === "gpa") void loadGpa();
  };

  const holdActive = Boolean(hold?.active);

  const summary = useMemo(() => {
    const cgpa =
      gpa?.cumulativeGpa ?? transcript?.overall.cumulativeGpa ?? null;
    const creditsCompleted =
      transcript?.overall.totalCredits ?? gpa?.totalCredits ?? 0;
    const terms = transcript?.terms ?? [];
    const semesterRows = gpa?.semesters ?? [];
    const latestTerm =
      terms[terms.length - 1] ??
      (semesterRows.length
        ? {
            semesterGpa: semesterRows[semesterRows.length - 1].gpa,
            academicYear: semesterRows[semesterRows.length - 1].academicYear,
            semester: semesterRows[semesterRows.length - 1].semester,
          }
        : null);
    const standing = academicStanding(cgpa);
    return {
      cgpa,
      creditsCompleted,
      semesterGpa: latestTerm?.semesterGpa ?? cgpa,
      standing,
    };
  }, [gpa, transcript]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b-4 border-[#F68F3A] bg-[#002147] px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <img
              src="/dhapti-logo.png"
              alt="DHAPTI"
              className="h-12 w-auto shrink-0 object-contain md:h-14 [filter:drop-shadow(0px_0px_8px_rgba(255,255,255,0.2))]"
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#F68F3A]">
                Official Academic Results
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Semester Result
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Assessments · Course finals · GPA / Transcript foundation
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/10 text-white hover:bg-white/20"
            onClick={reload}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {holdActive && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <div>
                <p className="font-bold tracking-tight">
                  FINANCIAL HOLD ACTIVE
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {hold?.message ??
                    `Your academic results and transcript are locked due to an outstanding tuition balance of $${(hold?.pendingDues ?? 0).toFixed(2)}. Please settle your dues at the Finance Office or via the Fees page.`}
                </p>
              </div>
            </div>
            <Button
              asChild
              className="shrink-0 rounded-xl bg-[#ea580c] hover:bg-[#c2410c]"
            >
              <Link to="/student/fees">Pay Now</Link>
            </Button>
          </div>
        </div>
      )}

      {!holdActive && (
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["assessments", "Assessments"],
            ["courses", "Course Results"],
            ["gpa", "GPA & Transcript"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      )}

      {error && !holdActive && (
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!holdActive && tab === "assessments" && (
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader className="border-b border-[#E5EBF3] pb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[#E85D04]" />
              <div>
                <h2 className="text-lg font-bold text-[#002147]">
                  Approved assessment results
                </h2>
                <p className="text-sm text-muted-foreground">
                  Assignments and quizzes after admin approval.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton
                headers={["Course", "Assessment", "Score", "Year / Semester"]}
              />
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={GraduationCap}
                  title="No Assessment Results"
                  description="Approved assignment and quiz results will appear here."
                />
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Course</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="pr-6">Year / Semester</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6">
                        <p className="font-semibold text-[#002147]">{row.courseCode}</p>
                        <p className="text-xs text-muted-foreground">{row.courseTitle}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{row.assessmentTitle}</p>
                        <Badge variant="secondary" className="mt-1">
                          {row.assessmentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-[#002147]">
                          {row.score}/{row.maxMarks}
                        </p>
                      </TableCell>
                      <TableCell className="pr-6 text-sm">
                        {row.academicYear} · {row.semester}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!holdActive && tab === "courses" && (
        <div className="space-y-4">
          {/* Executive academic summary */}
          <div className="grid gap-3 rounded-2xl border border-[#E5EBF3] bg-gradient-to-r from-[#002147] via-[#003366] to-[#0f172a] p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                Cumulative GPA (CGPA)
              </p>
              <div className="mt-2">
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 px-3 py-1 text-lg font-black text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  {summary.cgpa != null ? summary.cgpa.toFixed(2) : "—"}
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                Credits Completed
              </p>
              <p className="mt-2 text-lg font-black text-white">
                {summary.creditsCompleted}{" "}
                <span className="text-sm font-semibold text-slate-300">
                  / {DEGREE_CREDIT_TARGET} Credits
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                Academic Standing
              </p>
              <div className="mt-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-black",
                    summary.standing.className
                  )}
                >
                  {summary.standing.label}
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                Semester GPA
              </p>
              <p className="mt-2 text-lg font-black text-[#F68F3A]">
                {summary.semesterGpa != null
                  ? summary.semesterGpa.toFixed(2)
                  : "—"}
              </p>
            </div>
          </div>

          <Card className="overflow-hidden border-[#E5EBF3] shadow-sm">
            <CardHeader className="border-b border-[#E5EBF3] pb-4">
              <h2 className="text-lg font-bold text-[#002147] dark:text-slate-100">
                Course Finals
              </h2>
              <p className="text-sm text-muted-foreground">
                Official Dhapti letter grades with component breakdown — transcript
                quality view.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <TableSkeleton
                  headers={[
                    "Course",
                    "Credits",
                    "Final marks",
                    "Components",
                    "Letter",
                    "Grade point",
                    "Term",
                  ]}
                />
              ) : courseRows.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={GraduationCap}
                    title="No Course Results"
                    description="Approved course finals will appear here once published."
                  />
                </div>
              ) : (
                <Table className="results-transcript-table">
                  <TableHeader>
                    <TableRow className="border-b border-slate-700/50 bg-[#002147]/90 hover:bg-[#002147]/90 dark:bg-slate-800/90 dark:hover:bg-slate-800/90">
                      <TableHead className="pl-6 text-xs font-black uppercase tracking-wider text-slate-200">
                        Course
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Credits
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Final Marks
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Components
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Letter
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Grade Point
                      </TableHead>
                      <TableHead className="pr-6 text-xs font-black uppercase tracking-wider text-slate-200">
                        Term
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-b border-[#E5EBF3] border-l-4 border-l-transparent transition-all duration-200 hover:border-l-orange-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <TableCell className="py-4 pl-6">
                          <p className="font-bold text-[#002147] dark:text-slate-100">
                            {row.courseCode}
                          </p>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {row.courseTitle}
                          </p>
                        </TableCell>
                        <TableCell className="py-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                          {row.creditHours}
                        </TableCell>
                        <TableCell className="py-4 text-sm font-black text-[#002147] dark:text-white">
                          {row.marks != null
                            ? `${row.marks}/${row.maxMarks}`
                            : "—"}
                        </TableCell>
                        <TableCell className="py-4">
                          {row.componentDisplay ? (
                            <ComponentPills components={row.componentDisplay} />
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1 text-sm font-black",
                              letterGradeBadgeClass(row.letterGradeDisplay)
                            )}
                          >
                            {row.letterGradeDisplay}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-sm font-black tabular-nums text-[#002147] dark:text-slate-100">
                          {(() => {
                            const gp = Number(row.gradePointDisplay);
                            return Number.isFinite(gp) ? gp.toFixed(2) : "—";
                          })()}
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {row.academicYear} · {row.semester}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!holdActive && tab === "gpa" && (
        <div className="space-y-4">
          {loading && (
            <Card className="border-[#E5EBF3]">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Preparing official academic transcript…
              </CardContent>
            </Card>
          )}

          {!loading && gpa && (
            <div className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-[#E5EBF3] bg-white px-4 py-3 text-sm">
              <Badge variant={gpa.status === "OK" ? "success" : "warning"}>
                {gpa.status}
              </Badge>
              <span className="font-medium text-slate-600">{gpa.message}</span>
            </div>
          )}

          {!loading && transcriptStudent && transcript && (
            <OfficialAcademicTranscript
              student={transcriptStudent}
              terms={transcript.terms}
              overall={{
                totalCredits: transcript.overall.totalCredits,
                cumulativeGpa: transcript.overall.cumulativeGpa,
              }}
              creditRequired={DEGREE_CREDIT_TARGET}
              creditExempted={0}
            />
          )}

          {!loading && !transcript && !error && (
            <EmptyState
              icon={GraduationCap}
              title="Transcript Unavailable"
              description="Official transcript data could not be loaded."
            />
          )}
        </div>
      )}
    </div>
  );
}
