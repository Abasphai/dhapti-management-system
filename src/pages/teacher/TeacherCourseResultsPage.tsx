import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  ClipboardCheck,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  BIU_COMPONENT_CAPS,
  BIU_COMPONENT_FIELDS,
  attendancePercentToMarks,
  clampBiuMark,
  evaluateBiuMarksLive,
  type BiuComponentMarks,
} from "@/lib/gradingPolicy";
import { cn } from "@/lib/utils";

interface ClassOption {
  id: string;
  section: string;
  academicYear: string;
  semester: string;
  course: { code: string; title: string };
}

interface ResultRow {
  id: string;
  enrollmentId: string;
  status: string;
  biuComponents?: BiuComponentMarks | null;
}

interface GradebookRow {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  attendancePercent: number | null;
  resultId: string | null;
  status: string | null;
  locked: boolean;
  midterm: number;
  finalExam: number;
  quiz: number;
  presentation: number;
  assignment: number;
  attendance: number;
  dirty: boolean;
}

const headerRowClass =
  "border-b border-slate-700/50 bg-[#002147]/90 hover:bg-[#002147]/90 dark:bg-slate-800/90 dark:hover:bg-slate-800/90";
const headerCellClass =
  "h-10 px-2 text-left align-middle text-[10px] font-black uppercase tracking-wider text-slate-200 whitespace-nowrap";

const emptyComponents = (): BiuComponentMarks => ({
  midterm: 0,
  finalExam: 0,
  quiz: 0,
  presentation: 0,
  assignment: 0,
  attendance: 0,
});

function isLockedStatus(status: string | null | undefined) {
  return status === "PENDING_APPROVAL" || status === "APPROVED";
}

export function TeacherCourseResultsPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classSectionId, setClassSectionId] = useState("");
  const [rows, setRows] = useState<GradebookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ data: ClassOption[] }>("/teachers/me/classes")
      .then((res) => {
        setClasses(res.data);
        if (res.data[0]) setClassSectionId(res.data[0].id);
      })
      .catch(() => setClasses([]));
  }, []);

  const load = useCallback(async () => {
    if (!classSectionId) return;
    setLoading(true);
    try {
      const [students, results] = await Promise.all([
        api<{
          data: Array<{
            enrollmentId: string;
            studentId: string;
            studentCode: string;
            fullName?: string;
            name?: string;
            attendancePercent: number | null;
          }>;
        }>(`/classes/${classSectionId}/students?status=ACTIVE`),
        api<{ data: ResultRow[] }>(
          `/teachers/me/results?classSectionId=${classSectionId}&pageSize=100`
        ),
      ]);

      const byEnrollment = new Map(
        results.data.map((r) => [r.enrollmentId, r] as const)
      );

      setRows(
        students.data.map((s) => {
          const existing = byEnrollment.get(s.enrollmentId);
          const comps = existing?.biuComponents ?? emptyComponents();
          return {
            enrollmentId: s.enrollmentId,
            studentId: s.studentId,
            studentCode: s.studentCode,
            fullName: s.fullName || s.name || "Student",
            attendancePercent: s.attendancePercent,
            resultId: existing?.id ?? null,
            status: existing?.status ?? null,
            locked: isLockedStatus(existing?.status),
            midterm: comps.midterm,
            finalExam: comps.finalExam,
            quiz: comps.quiz,
            presentation: comps.presentation,
            assignment: comps.assignment,
            attendance: comps.attendance,
            dirty: false,
          };
        })
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load gradebook"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [classSectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classSectionId) ?? null,
    [classes, classSectionId]
  );

  const dirtyCount = rows.filter((r) => r.dirty && !r.locked).length;
  const submittableCount = rows.filter(
    (r) =>
      r.resultId &&
      (r.status === "CALCULATED" || r.status === "RETURNED") &&
      !r.dirty
  ).length;

  function setMark(
    enrollmentId: string,
    key: keyof BiuComponentMarks,
    raw: string,
    max: number
  ) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.enrollmentId !== enrollmentId || row.locked) return row;
        if (raw === "") {
          return { ...row, [key]: 0, dirty: true };
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return row;
        return {
          ...row,
          [key]: clampBiuMark(n, max),
          dirty: true,
        };
      })
    );
  }

  function autoFillAttendance() {
    let filled = 0;
    setRows((prev) =>
      prev.map((row) => {
        if (row.locked) return row;
        const marks = attendancePercentToMarks(row.attendancePercent);
        if (row.attendance === marks) return row;
        filled += 1;
        return { ...row, attendance: marks, dirty: true };
      })
    );
    toast.success(
      filled > 0
        ? `Auto-filled attendance marks for ${filled} student(s)`
        : "Attendance marks already match logged attendance %"
    );
  }

  async function saveGradebook() {
    if (!classSectionId) return;
    const entries = rows
      .filter((r) => !r.locked && (r.dirty || !r.resultId))
      .map((r) => ({
        enrollmentId: r.enrollmentId,
        midterm: r.midterm,
        finalExam: r.finalExam,
        quiz: r.quiz,
        presentation: r.presentation,
        assignment: r.assignment,
        attendance: r.attendance,
      }));

    if (entries.length === 0) {
      toast.message("No unsaved gradebook changes to save");
      return;
    }

    setBusy(true);
    try {
      const res = await api<{
        saved: number;
        failed: number;
        failures: Array<{ enrollmentId: string; message: string }>;
      }>("/results/gradebook", {
        method: "POST",
        body: JSON.stringify({ classSectionId, entries }),
      });
      if (res.failed > 0) {
        toast.error(
          `Saved ${res.saved}; ${res.failed} failed${
            res.failures[0] ? ` — ${res.failures[0].message}` : ""
          }`
        );
      } else {
        toast.success(`Saved Dhapti marks for ${res.saved} student(s)`);
      }
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save gradebook"
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitForApproval() {
    if (!classSectionId) return;
    if (dirtyCount > 0) {
      toast.error("Save gradebook changes before submitting for approval");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ submitted: number; status: string; message: string }>(
        "/results/bulk-submit",
        {
          method: "POST",
          body: JSON.stringify({ classSectionId }),
        }
      );
      toast.success(res.message || `Submitted ${res.submitted} result(s)`);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit marks"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl dark:text-slate-100">
            Automated Gradebook
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter Dhapti component marks — Total, Letter Grade, GPA, and Pass/Fail
            update in real time. Submit for admin approval before students see
            results.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#002147] text-white hover:bg-[#002147]">
            Max 100 · Mid 30 · Final 40 · Quiz 10 · Pres 5 · Assign 5 · Att 10
          </Badge>
        </div>
      </div>

      <Card className="border-[#E5EBF3]">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#002147]">
              Class / Subject
            </label>
            <Select value={classSectionId} onValueChange={setClassSectionId}>
              <SelectTrigger className="h-10 border-[#E5EBF3] bg-white font-semibold text-[#002147]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.course.code} — {c.course.title} · Sec {c.section} (
                    {c.academicYear} S{c.semester})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy || loading || rows.length === 0}
            className="border-[#E5EBF3] text-[#002147]"
            onClick={autoFillAttendance}
          >
            <ClipboardCheck className="h-4 w-4" />
            Auto-Fill Attendance Marks
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || dirtyCount === 0}
            className="border-[#E5EBF3] text-[#002147]"
            onClick={() => void saveGradebook()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Gradebook{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
          <Button
            type="button"
            disabled={busy || submittableCount === 0 || dirtyCount > 0}
            className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
            onClick={() => void submitForApproval()}
          >
            <Send className="h-4 w-4" />
            Submit Marks for Admin Approval
          </Button>
        </CardContent>
      </Card>

      {selectedClass && (
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Calculator className="mr-1 inline h-3.5 w-3.5" />
          {selectedClass.course.code} · {rows.length} enrolled ·{" "}
          {submittableCount} ready to submit
        </p>
      )}

      <Card className="overflow-hidden border-[#E5EBF3]">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className={headerRowClass}>
                  <TableHead className={cn(headerCellClass, "sticky left-0 z-10 bg-[#002147]/95 pl-3")}>
                    Student
                  </TableHead>
                  <TableHead className={headerCellClass}>ID</TableHead>
                  <TableHead className={headerCellClass}>
                    Mid/{BIU_COMPONENT_CAPS.MIDTERM}
                  </TableHead>
                  <TableHead className={headerCellClass}>
                    Final/{BIU_COMPONENT_CAPS.FINAL_EXAM}
                  </TableHead>
                  <TableHead className={headerCellClass}>
                    Quiz/{BIU_COMPONENT_CAPS.QUIZ}
                  </TableHead>
                  <TableHead className={headerCellClass}>
                    Pres/{BIU_COMPONENT_CAPS.PRESENTATION}
                  </TableHead>
                  <TableHead className={headerCellClass}>
                    Assign/{BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED}
                  </TableHead>
                  <TableHead className={headerCellClass}>
                    Att/{BIU_COMPONENT_CAPS.ATTENDANCE}
                  </TableHead>
                  <TableHead className={headerCellClass}>Att %</TableHead>
                  <TableHead className={headerCellClass}>Total</TableHead>
                  <TableHead className={headerCellClass}>GL</TableHead>
                  <TableHead className={headerCellClass}>GPA</TableHead>
                  <TableHead className={headerCellClass}>P/F</TableHead>
                  <TableHead className={cn(headerCellClass, "pr-3")}>
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={14}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading gradebook…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={14}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No active students in this class section.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => {
                    const live = evaluateBiuMarksLive({
                      midterm: row.midterm,
                      finalExam: row.finalExam,
                      quiz: row.quiz,
                      presentation: row.presentation,
                      assignment: row.assignment,
                      attendance: row.attendance,
                    });
                    return (
                      <TableRow
                        key={row.enrollmentId}
                        className={cn(
                          "border-b border-[#E5EBF3]",
                          row.dirty && "bg-orange-50/60 dark:bg-orange-950/20"
                        )}
                      >
                        <TableCell className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-slate-950">
                          <p className="max-w-[160px] truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                            {row.fullName}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-2 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {row.studentCode}
                        </TableCell>
                        {BIU_COMPONENT_FIELDS.map((field) => (
                          <TableCell key={field.key} className="px-1.5 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={field.max}
                              step={0.5}
                              disabled={row.locked || busy}
                              value={row[field.key]}
                              onChange={(e) =>
                                setMark(
                                  row.enrollmentId,
                                  field.key,
                                  e.target.value,
                                  field.max
                                )
                              }
                              className="h-8 w-[68px] rounded-lg border-[#E5EBF3] px-2 text-center text-xs font-bold text-[#002147]"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap px-2 py-2 text-xs font-semibold text-slate-600">
                          {row.attendancePercent == null
                            ? "—"
                            : `${Math.round(row.attendancePercent)}%`}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-sm font-black text-[#002147] dark:text-white">
                          {live.total}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge
                            className={cn(
                              "font-black",
                              live.letterGrade === "F"
                                ? "bg-red-600 text-white hover:bg-red-600"
                                : "bg-[#002147] text-white hover:bg-[#002147]"
                            )}
                          >
                            {live.letterGrade}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                          {live.gradePoint.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge
                            variant={
                              live.passFail === "PASS" ? "success" : "danger"
                            }
                          >
                            {live.passFail}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2 pr-3">
                          <Badge variant="secondary">
                            {row.dirty
                              ? "Unsaved"
                              : row.status ?? "Not saved"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
