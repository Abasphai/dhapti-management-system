import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Download,
  GraduationCap,
  Percent,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAVY = "#002147";
const ORANGE = "#ea580c";
const GREEN = "#16a34a";
const GRADE_COLORS: Record<string, string> = {
  "A+": GREEN,
  A: "#22c55e",
  B: "#0ea5e9",
  C: ORANGE,
  F: "#dc2626",
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

type AnalyticsOverview = {
  generatedAt: string;
  filters: {
    facultyId: string | null;
    departmentId: string | null;
    academicYear: string | null;
  };
  filterOptions: {
    faculties: Array<{ id: string; name: string; code: string }>;
    departments: Array<{
      id: string;
      name: string;
      code: string;
      facultyId: string;
    }>;
    academicYears: string[];
  };
  kpis: {
    totalEnrollment: number;
    enrollmentGrowthPct: number;
    netRevenue: number;
    netRevenueLabel: string;
    outstandingDues: number;
    collectionRate: number;
    averageGpa: number | null;
    averageGpaLabel: string;
    gpaLetterHint: string;
    gpaConfigured: boolean;
    campusAttendance: number | null;
    campusAttendanceLabel: string;
    attendanceThreshold: number;
    overallPassRate: number;
  };
  revenueTrend: Array<{ month: string; key: string; amount: number }>;
  departmentBreakdown: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    facultyName: string;
    enrolledStudents: number;
    facultyCount: number;
    activeCourses: number;
    avgAttendance: number | null;
    avgGpa: number | null;
    passRate: number | null;
    collectionRate: number | null;
  }>;
  departmentPerformance: Array<{
    name: string;
    enrollment: number;
    passRate: number;
    activeCourses: number;
  }>;
  gradeDistribution: Array<{
    grade: string;
    count: number;
    percentage: number;
  }>;
  atRiskStudents: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    departmentName: string | null;
    facultyName: string | null;
    attendancePercent: number | null;
    gpa: number | null;
    reasons: string[];
  }>;
  atRiskCount: number;
};

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n}%`;
}

function escapeCsv(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facultyId, setFacultyId] = useState<string>("all");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [academicYear, setAcademicYear] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (facultyId !== "all") params.set("facultyId", facultyId);
      if (departmentId !== "all") params.set("departmentId", departmentId);
      if (academicYear !== "all") params.set("academicYear", academicYear);
      const qs = params.toString();
      const res = await api<AnalyticsOverview>(
        `/admin/analytics/overview${qs ? `?${qs}` : ""}`
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }, [facultyId, departmentId, academicYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const departments = useMemo(() => {
    if (!data) return [];
    if (facultyId === "all") return data.filterOptions.departments;
    return data.filterOptions.departments.filter(
      (d) => d.facultyId === facultyId
    );
  }, [data, facultyId]);

  const exportCsv = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push("Dhapti Analytics & Intelligence Report");
    lines.push(`Generated,${data.generatedAt}`);
    lines.push(
      `Filters,Faculty=${facultyId},Department=${departmentId},Year=${academicYear}`
    );
    lines.push("");
    lines.push("KPI,Value");
    lines.push(`Total Enrollment,${data.kpis.totalEnrollment}`);
    lines.push(`Enrollment Growth %,${data.kpis.enrollmentGrowthPct}`);
    lines.push(`Net Revenue,${data.kpis.netRevenue}`);
    lines.push(`Collection Rate %,${data.kpis.collectionRate}`);
    lines.push(`Average GPA,${data.kpis.averageGpaLabel}`);
    lines.push(`Campus Attendance %,${data.kpis.campusAttendance ?? ""}`);
    lines.push(`Overall Pass Rate %,${data.kpis.overallPassRate}`);
    lines.push(`At-Risk Count,${data.atRiskCount}`);
    lines.push("");
    lines.push(
      [
        "Department",
        "Faculty",
        "Enrolled",
        "Faculty Count",
        "Avg Attendance %",
        "Avg GPA",
        "Pass Rate %",
        "Collection %",
      ].join(",")
    );
    for (const row of data.departmentBreakdown) {
      lines.push(
        [
          escapeCsv(row.departmentName),
          escapeCsv(row.facultyName),
          row.enrolledStudents,
          row.facultyCount,
          row.avgAttendance ?? "",
          row.avgGpa ?? "",
          row.passRate ?? "",
          row.collectionRate ?? "",
        ].join(",")
      );
    }
    lines.push("");
    lines.push("Grade,Count,Percentage");
    for (const g of data.gradeDistribution) {
      lines.push(`${g.grade},${g.count},${g.percentage}`);
    }
    lines.push("");
    lines.push(
      "Student Code,Name,Department,Attendance %,GPA,Reasons"
    );
    for (const s of data.atRiskStudents) {
      lines.push(
        [
          escapeCsv(s.studentCode),
          escapeCsv(s.fullName),
          escapeCsv(s.departmentName),
          s.attendancePercent ?? "",
          s.gpa ?? "",
          escapeCsv(s.reasons.join("; ")),
        ].join(",")
      );
    }
    downloadBlob(
      `dhapti-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );
    toast.success("CSV report downloaded");
  };

  const exportPdf = () => {
    if (!data) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!w) {
      toast.error("Allow pop-ups to export PDF");
      return;
    }
    const deptRows = data.departmentBreakdown
      .map(
        (r) =>
          `<tr>
            <td>${r.departmentName}</td>
            <td>${r.enrolledStudents}</td>
            <td>${r.facultyCount}</td>
            <td>${pct(r.avgAttendance)}</td>
            <td>${r.avgGpa?.toFixed(2) ?? "—"}</td>
            <td>${pct(r.passRate)}</td>
            <td>${pct(r.collectionRate)}</td>
          </tr>`
      )
      .join("");
    w.document.write(`<!doctype html><html><head><title>Dhapti Analytics Report</title>
      <style>
        body{font-family:Segoe UI,system-ui,sans-serif;color:#002147;padding:24px}
        h1{margin:0 0 4px} .meta{color:#64748b;margin-bottom:20px}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .kpi{border:1px solid #e2e8f0;border-radius:12px;padding:12px}
        .kpi b{display:block;font-size:22px;margin-top:4px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
        th{background:#002147;color:#fff}
        @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()">Print / Save as PDF</button>
      <h1>Dhapti Analytics &amp; Intelligence</h1>
      <p class="meta">Generated ${new Date(data.generatedAt).toLocaleString()} · Year ${data.filters.academicYear ?? "All"}</p>
      <div class="kpis">
        <div class="kpi">Enrollment<b>${data.kpis.totalEnrollment.toLocaleString()}</b></div>
        <div class="kpi">Net Revenue<b>${data.kpis.netRevenueLabel}</b></div>
        <div class="kpi">Avg GPA<b>${data.kpis.averageGpaLabel}</b></div>
        <div class="kpi">Attendance<b>${data.kpis.campusAttendanceLabel}</b></div>
      </div>
      <h2>Department Deep-Dive</h2>
      <table>
        <thead><tr><th>Department</th><th>Enrolled</th><th>Faculty</th><th>Attendance</th><th>GPA</th><th>Pass</th><th>Collection</th></tr></thead>
        <tbody>${deptRows}</tbody>
      </table>
      <h2>At-Risk Cohort (${data.atRiskCount})</h2>
      <ul>${data.atRiskStudents
        .slice(0, 25)
        .map(
          (s) =>
            `<li><strong>${s.fullName}</strong> (${s.studentCode}) — ${s.reasons.join(", ")}</li>`
        )
        .join("")}</ul>
      </body></html>`);
    w.document.close();
    toast.success("Opened print preview — use Save as PDF");
  };

  const kpis = data?.kpis;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Analytics & Intelligence"
        description="University performance metrics, revenue trends, department comparisons, and at-risk student cohorts."
      />

      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="flex flex-col gap-3 rounded-2xl border border-[#E5EBF3] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Academic Year
            </label>
            <Select
              value={academicYear}
              onValueChange={(v) => setAcademicYear(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {(data?.filterOptions.academicYears ?? []).map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Faculty
            </label>
            <Select
              value={facultyId}
              onValueChange={(v) => {
                setFacultyId(v);
                setDepartmentId("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Faculty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All faculties</SelectItem>
                {(data?.filterOptions.faculties ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Department
            </label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!data}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#003366]"
            onClick={exportPdf}
            disabled={!data}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </motion.div>

      {error ? (
        <EmptyState
          icon={BarChart3}
          title="Analytics unavailable"
          description={error}
        />
      ) : null}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Student Enrollment",
            value: kpis ? kpis.totalEnrollment.toLocaleString() : "—",
            hint: kpis
              ? `${kpis.enrollmentGrowthPct >= 0 ? "+" : ""}${kpis.enrollmentGrowthPct}% vs prior cohort base`
              : "Loading…",
            icon: Users,
            accent: "text-[#002147] bg-[#002147]/10",
          },
          {
            title: "Net Revenue Collection",
            value: kpis?.netRevenueLabel ?? "—",
            hint: kpis
              ? `${kpis.collectionRate}% collection rate`
              : "Loading…",
            icon: Wallet,
            accent: "text-[#16a34a] bg-[#16a34a]/10",
          },
          {
            title: "University Average GPA",
            value: kpis?.averageGpaLabel ?? "—",
            hint: kpis?.gpaLetterHint ?? "Loading…",
            icon: GraduationCap,
            accent: "text-[#ea580c] bg-[#ea580c]/10",
          },
          {
            title: "Overall Campus Attendance",
            value: kpis?.campusAttendanceLabel ?? "—",
            hint: kpis
              ? kpis.campusAttendance != null &&
                kpis.campusAttendance >= kpis.attendanceThreshold
                ? `Above ${kpis.attendanceThreshold}% threshold`
                : `Threshold ${kpis.attendanceThreshold}%`
              : "Loading…",
            icon: Percent,
            accent: "text-[#0ea5e9] bg-sky-500/10",
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            custom={i + 1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {card.title}
                </CardTitle>
                <div className={cn("rounded-lg p-2", card.accent)}>
                  <card.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black tracking-tight text-[#002147] dark:text-white">
                  {loading && !kpis ? "…" : card.value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {card.hint}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div custom={5} initial="hidden" animate="visible" variants={fadeUp}>
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#002147] dark:text-white">
                <TrendingUp className="h-5 w-5 text-[#ea580c]" />
                Revenue Collection Trend
              </CardTitle>
              <CardDescription>Monthly fee collections (PAID)</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {data?.revenueTrend?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueTrend}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [
                        `$${Number(v ?? 0).toLocaleString()}`,
                        "Collected",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke={ORANGE}
                      strokeWidth={2.5}
                      fill="url(#revFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  No paid collections in range
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={6} initial="hidden" animate="visible" variants={fadeUp}>
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#002147] dark:text-white">
                <BarChart3 className="h-5 w-5 text-[#002147]" />
                Department Performance
              </CardTitle>
              <CardDescription>
                Enrollment vs pass rate by department
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {data?.departmentPerformance?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.departmentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      domain={[0, 100]}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="enrollment"
                      name="Enrollment"
                      fill={NAVY}
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="passRate"
                      name="Pass %"
                      fill={GREEN}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  No department data
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Grade + at-risk */}
      <div className="grid gap-4 lg:grid-cols-5">
        <motion.div
          custom={7}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-2"
        >
          <Card className="h-full border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-[#002147] dark:text-white">
                Grade Distribution
              </CardTitle>
              <CardDescription>
                Approved results · overall pass {pct(data?.kpis.overallPassRate)}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {data?.gradeDistribution.some((g) => g.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.gradeDistribution.filter((g) => g.count > 0)}
                      dataKey="count"
                      nameKey="grade"
                      innerRadius={58}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {data.gradeDistribution
                        .filter((g) => g.count > 0)
                        .map((g) => (
                          <Cell
                            key={g.grade}
                            fill={GRADE_COLORS[g.grade] ?? NAVY}
                          />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, _n, item) => {
                        const pctVal =
                          (item?.payload as { percentage?: number })
                            ?.percentage ?? 0;
                        return [`${v} (${pctVal}%)`, "Results"];
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  No approved letter grades yet
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={8}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-3"
        >
          <Card className="h-full border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-[#002147] dark:text-white">
                  <AlertTriangle className="h-5 w-5 text-[#ea580c]" />
                  At-Risk Student Cohort
                </CardTitle>
                <CardDescription>
                  Attendance &lt; 75% or GPA &lt; 2.0 · {data?.atRiskCount ?? 0}{" "}
                  flagged
                </CardDescription>
              </div>
              <Badge variant="warning">{data?.atRiskCount ?? 0}</Badge>
            </CardHeader>
            <CardContent className="max-h-80 space-y-2 overflow-y-auto">
              {!data?.atRiskStudents.length ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No at-risk students in the current filter scope.
                </p>
              ) : (
                data.atRiskStudents.map((s) => (
                  <div
                    key={s.studentId}
                    className="rounded-xl border border-[#E5EBF3] bg-[#F8FAFC] px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#002147] dark:text-white">
                          {s.fullName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.studentCode}
                          {s.departmentName ? ` · ${s.departmentName}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        <span className="rounded-md bg-white px-2 py-1 dark:bg-slate-950">
                          Att {pct(s.attendancePercent)}
                        </span>
                        <span className="rounded-md bg-white px-2 py-1 dark:bg-slate-950">
                          GPA {s.gpa?.toFixed(2) ?? "—"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-[#ea580c]">
                      {s.reasons.join(" · ")}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Department table */}
      <motion.div custom={9} initial="hidden" animate="visible" variants={fadeUp}>
        <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-[#002147] dark:text-white">
              Department Deep-Dive
            </CardTitle>
            <CardDescription>
              Enrollment, staffing, attendance, GPA, pass and collection rates
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="text-right">Faculty</TableHead>
                  <TableHead className="text-right">Avg Attendance</TableHead>
                  <TableHead className="text-right">Avg GPA</TableHead>
                  <TableHead className="text-right">Pass Rate</TableHead>
                  <TableHead className="text-right">Collection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.departmentBreakdown ?? []).map((row) => (
                  <TableRow key={row.departmentId}>
                    <TableCell>
                      <div className="font-semibold text-[#002147] dark:text-white">
                        {row.departmentName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.facultyName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.enrolledStudents}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.facultyCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(row.avgAttendance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.avgGpa?.toFixed(2) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(row.passRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(row.collectionRate)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !data?.departmentBreakdown.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-slate-500"
                    >
                      No departments in scope
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
