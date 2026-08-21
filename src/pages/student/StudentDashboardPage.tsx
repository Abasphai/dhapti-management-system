import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  ClipboardCheck,
  Clock,
  GraduationCap,
  MapPin,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { DrilldownCard, drilldownHoverClass } from "@/components/common/DrilldownCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

/** Demo GPA trend when API has no completed semester results yet */
const SAMPLE_SEMESTER_GRADES = [
  { semester: "Semester 1", gpa: 3.4 },
  { semester: "Semester 2", gpa: 3.55 },
  { semester: "Semester 3", gpa: 3.75 },
  { semester: "Semester 4", gpa: 3.85 },
];

/** Demo Monday routine when no class sessions are returned */
const SAMPLE_TODAY_SCHEDULE = [
  {
    subject: "Web Development",
    code: "CSC-301",
    time: "08:30 AM - 10:30 AM",
    room: "Lab 02",
    status: "Active - In Progress",
  },
  {
    subject: "Discrete Math",
    code: "MTH-201",
    time: "11:00 AM - 01:00 PM",
    room: "Hall 104",
    status: "Upcoming",
  },
];

const SAMPLE_FINANCE = {
  totalPaid: 1200,
  currentDue: 300,
  totalDue: 1500,
  currency: "$",
};

type StudentStats = {
  studentName: string;
  academicYear: string;
  semester: string;
  enrolledCourses: number;
  attendancePercent: number | null;
  attendanceLabel: string;
  pendingFeeDues: number;
  pendingAssignments: number;
  gpaLabel: string;
  finance: {
    totalPaid: number;
    currentDue: number;
    totalDue: number;
    currency: string;
  };
  semesterGrades: Array<{ semester: string; gpa: number }>;
  todaySchedule: Array<{
    subject: string;
    code: string;
    time: string;
    room: string;
    status: string;
  }>;
};

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("progress")) {
    return "bg-[#16a34a]/20 text-[#15803d] ring-1 ring-[#16a34a]/40 dark:bg-[#16a34a]/25 dark:text-[#86efac] dark:ring-[#16a34a]/50";
  }
  if (s.includes("upcoming")) {
    return "bg-sky-100 text-sky-800 ring-1 ring-sky-300 dark:bg-sky-500/25 dark:text-sky-200 dark:ring-sky-400/40";
  }
  if (s.includes("done") || s.includes("completed")) {
    return "bg-slate-200 text-slate-800 ring-1 ring-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-500";
  }
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600";
}

function AttendanceGauge({ value }: { value: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#E5EBF3"
          strokeWidth="12"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#16a34a"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-[#002147]">{value}%</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Attendance
        </p>
      </div>
    </div>
  );
}

export function StudentDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<StudentStats>("/student/dashboard/stats")
      .then(setStats)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load stats")
      );
  }, []);

  const rawFinance = stats?.finance;
  const financeEmpty =
    !rawFinance ||
    (rawFinance.totalPaid === 0 &&
      rawFinance.currentDue === 0 &&
      rawFinance.totalDue === 0);
  const finance = financeEmpty
    ? SAMPLE_FINANCE
    : {
        ...rawFinance,
        currency: rawFinance.currency || "$",
      };

  const financeCards = [
    {
      label: "Total Paid",
      value: finance.totalPaid,
      tone: "from-[#002147] to-[#0a3a6b]",
      ring: "#F68F3A",
      href: "/student/fees",
    },
    {
      label: "Current Due",
      value: finance.currentDue,
      tone: "from-[#E85D04] to-[#c2410c]",
      ring: "#fff",
      href: "/student/fees",
    },
    {
      label: "Total Due",
      value: finance.totalDue,
      tone: "from-[#16a34a] to-[#15803d]",
      ring: "#fff",
      href: "/student/fees",
    },
  ];

  const attendanceValue =
    stats?.attendancePercent === null || stats?.attendancePercent === undefined
      ? 82
      : Math.round(stats.attendancePercent);

  const cards = [
    {
      title: "Enrolled Courses",
      value: stats ? String(stats.enrolledCourses) : "—",
      description: "Current semester",
      icon: BookOpen,
      accent: "bg-[#002147]/10 text-[#002147]",
      href: "/student/courses",
    },
    {
      title: "Overall Attendance",
      value:
        stats?.attendancePercent != null
          ? stats.attendanceLabel
          : `${attendanceValue}%`,
      description: "Across enrolled classes",
      icon: ClipboardCheck,
      accent: "bg-[#16a34a]/10 text-[#16a34a]",
      href: "/student/attendance",
    },
    {
      title: "Pending Fee Dues",
      value: `${finance.currency}${finance.currentDue.toLocaleString()}`,
      description: "Outstanding balance",
      icon: Wallet,
      accent: "bg-[#E85D04]/10 text-[#E85D04]",
      href: "/student/fees",
    },
    {
      title: "Current GPA",
      value:
        stats?.gpaLabel && stats.gpaLabel !== "N/A" && stats.gpaLabel !== "—"
          ? stats.gpaLabel
          : "3.85",
      description:
        stats?.gpaLabel === "N/A"
          ? "Demo semester trend shown"
          : "Cumulative average",
      icon: GraduationCap,
      accent: "bg-[#002147]/10 text-[#002147]",
      href: "/student/results",
    },
  ];

  const apiGrades = stats?.semesterGrades ?? [];
  const hasRealGrades = apiGrades.some((g) => g.gpa > 0);
  const semesterGrades = hasRealGrades ? apiGrades : SAMPLE_SEMESTER_GRADES;

  const todaySchedule =
    stats?.todaySchedule && stats.todaySchedule.length > 0
      ? stats.todaySchedule
      : SAMPLE_TODAY_SCHEDULE;

  const todayLabel = "Monday, August 10, 2026";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-[#002147] p-6 text-white shadow-xl shadow-[#002147]/20 md:p-8"
      >
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#16a34a]/20 blur-3xl" />
        <div className="absolute -bottom-16 right-20 h-56 w-56 rounded-full bg-[#E85D04]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F68F3A]">
              Academic Year {stats?.academicYear ?? "2025/2026"} ·{" "}
              {stats?.semester ?? "Semester 4"}
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Welcome back, {stats?.studentName ?? "Student"}!
            </h2>
            <p className="mt-2 text-sm text-white/70 md:text-base">
              Your portal mirrors a full campus student information system —
              fees, results, routine, and support in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/student/results")}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm",
              "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-[#ea580c]/50 hover:bg-white/10"
            )}
          >
            <TrendingUp className="h-5 w-5 text-[#16a34a]" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Performance
              </p>
              <p className="text-sm font-semibold">
                GPA{" "}
                {stats?.gpaLabel && stats.gpaLabel !== "N/A"
                  ? stats.gpaLabel
                  : "3.85"}
              </p>
            </div>
          </button>
        </div>
      </motion.div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {financeCards.map((card, index) => (
          <motion.div
            key={card.label}
            custom={index + 1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <DrilldownCard
              to={card.href}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br p-5 text-white shadow-lg",
                card.tone
              )}
            >
              <div
                className="absolute -right-6 -top-6 h-28 w-28 rounded-full border-[10px] opacity-30"
                style={{ borderColor: card.ring }}
              />
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/30 bg-white/10 text-lg font-bold backdrop-blur-sm">
                  {finance.currency}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {finance.currency}
                    {card.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </DrilldownCard>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        {cards.map((stat, index) => (
          <motion.div
            key={stat.title}
            custom={index + 4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <DrilldownCard to={stat.href}>
              <Card className="h-full border-[#E5EBF3] shadow-sm transition-colors group-hover:border-orange-500/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-10">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div
                    className={cn(
                      "rounded-lg p-2 transition-transform duration-300 group-hover:scale-110",
                      stat.accent
                    )}
                  >
                    <stat.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#002147]">
                    {stat.value}
                  </div>
                  <CardDescription className="mt-1">
                    {stat.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </DrilldownCard>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div
          custom={8}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-3"
        >
          <DrilldownCard to="/student/results" className="h-full">
            <Card className="h-full border-[#E5EBF3] shadow-sm transition-colors group-hover:border-orange-500/40">
              <CardHeader className="border-b border-[#E5EBF3] pb-4 pr-10">
                <CardTitle className="text-lg text-[#002147]">
                  Semester&apos;s Grade
                </CardTitle>
                <CardDescription className="mt-1">
                  GPA trend across completed semesters
                  {!hasRealGrades ? " · sample trend" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={semesterGrades}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gpaGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                      </linearGradient>
                      <linearGradient id="gpaOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" />
                        <stop offset="100%" stopColor="#ea580c" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5EBF3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="semester"
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                      axisLine={{ stroke: "#E5EBF3" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 4]}
                      ticks={[0, 1, 2, 3, 4]}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,33,71,0.04)" }}
                      formatter={(value) => [
                        typeof value === "number"
                          ? value.toFixed(2)
                          : String(value ?? ""),
                        "GPA",
                      ]}
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#E5EBF3",
                        boxShadow: "0 8px 24px rgba(0,33,71,0.08)",
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="gpa" radius={[10, 10, 4, 4]} maxBarSize={56}>
                      {semesterGrades.map((entry, index) => (
                        <Cell
                          key={`gpa-${entry.semester}`}
                          fill={
                            index % 2 === 0
                              ? "url(#gpaGreen)"
                              : "url(#gpaOrange)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </DrilldownCard>
        </motion.div>

        <motion.div
          custom={9}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-2"
        >
          <DrilldownCard to="/student/attendance" className="h-full">
            <Card className="h-full border-[#E5EBF3] shadow-sm transition-colors group-hover:border-orange-500/40">
              <CardHeader className="border-b border-[#E5EBF3] pb-4 pr-10">
                <CardTitle className="text-lg text-[#002147]">
                  Attendance Overview
                </CardTitle>
                <CardDescription className="mt-1">
                  Overall class attendance percentage
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <AttendanceGauge value={attendanceValue} />
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Required minimum:{" "}
                  <span className="font-semibold text-[#E85D04]">75%</span>
                </p>
              </CardContent>
            </Card>
          </DrilldownCard>
        </motion.div>
      </div>

      <motion.div custom={10} initial="hidden" animate="visible" variants={fadeUp}>
        <DrilldownCard to="/student/routine">
          <Card className="overflow-hidden border-[#E5EBF3] bg-white shadow-sm transition-colors group-hover:border-orange-500/40 dark:border-slate-700 dark:bg-slate-900">
            <CardHeader className="border-b border-slate-200 pb-4 pr-10 dark:border-slate-700">
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Today&apos;s Routine
              </CardTitle>
              <CardDescription className="mt-1 text-slate-500 dark:text-slate-400">
                {todayLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-scroll border-0">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-xs font-black uppercase tracking-wider text-[#002147] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                      <th className="px-6 py-3">Subject</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySchedule.map((row, i) => (
                      <tr
                        key={`${row.code}-${i}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/student/routine");
                        }}
                        className={cn(
                          "border-b border-slate-200 last:border-0",
                          drilldownHoverClass,
                          "hover:translate-y-0 hover:shadow-none",
                          i % 2 === 1 && "bg-slate-50/70 dark:bg-slate-800/20"
                        )}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {row.code}: {row.subject}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                            <span className="font-medium">{row.time}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
                            <span className="font-medium">{row.room}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              statusBadgeClass(row.status)
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </DrilldownCard>
      </motion.div>
    </div>
  );
}
