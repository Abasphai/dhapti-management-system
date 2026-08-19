import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  MapPin,
  Upload,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { DrilldownCard, drilldownHoverClass } from "@/components/common/DrilldownCard";
import { Badge } from "@/components/ui/badge";
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

type TeacherStats = {
  teacherName: string;
  department: string;
  academicYear: string;
  activeCourses: number;
  totalStudents: number;
  pendingGrading: number;
  avgAttendanceLabel: string;
  todayClasses: Array<{
    subject: string;
    code: string;
    time: string;
    room: string;
    section: string;
  }>;
  todayLabel: string;
};

export function TeacherDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<TeacherStats>("/teacher/dashboard/stats")
      .then(setStats)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load stats")
      );
  }, []);

  const cards = [
    {
      title: "Total Students",
      value: stats ? String(stats.totalStudents) : "—",
      description: "Across all classes",
      icon: Users,
      accent: "bg-[#002147]/10 text-[#002147]",
      href: "/teacher/students",
    },
    {
      title: "Active Courses",
      value: stats ? String(stats.activeCourses) : "—",
      description: "This semester",
      icon: BookOpen,
      accent: "bg-[#16a34a]/10 text-[#16a34a]",
      href: "/teacher/courses",
    },
    {
      title: "Pending to Grade",
      value: stats ? String(stats.pendingGrading) : "—",
      description: "Assignments awaiting review",
      icon: FileText,
      accent: "bg-[#E85D04]/10 text-[#E85D04]",
      href: "/teacher/grading",
    },
    {
      title: "Avg. Class Attendance",
      value: stats?.avgAttendanceLabel ?? "—",
      description: "Marked sessions",
      icon: ClipboardCheck,
      accent: "bg-[#002147]/10 text-[#002147]",
      href: "/teacher/attendance",
    },
  ];

  const todayClasses = stats?.todayClasses ?? [];
  const pendingTasks = [
    {
      title: "Grade pending submissions",
      detail: `${stats?.pendingGrading ?? 0} submissions awaiting review`,
      tag: "Grading",
      tagColor: "bg-[#E85D04]/10 text-[#E85D04]",
      icon: FileText,
      href: "/teacher/grading",
    },
    {
      title: "Review course materials",
      detail: "Keep published materials up to date for your sections",
      tag: "Materials",
      tagColor: "bg-[#002147]/10 text-[#002147]",
      icon: Upload,
      href: "/teacher/materials",
    },
    {
      title: "Mark today's attendance",
      detail: `${todayClasses.length} class session(s) scheduled today`,
      tag: "Attendance",
      tagColor: "bg-[#16a34a]/10 text-[#16a34a]",
      icon: ClipboardCheck,
      href: "/teacher/attendance",
    },
    {
      title: "Check grading approvals",
      detail: "Follow up on submitted grade batches",
      tag: "Approvals",
      tagColor: "bg-sky-500/10 text-sky-700",
      icon: CheckCircle2,
      href: "/teacher/grading",
    },
  ];

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
              Faculty Portal · Academic Year {stats?.academicYear ?? "—"}
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Welcome, {stats?.teacherName ?? "Faculty"}!
            </h2>
            <p className="mt-2 text-sm text-white/70 md:text-base">
              You have{" "}
              <span className="font-semibold text-white">
                {todayClasses.length} classes today
              </span>{" "}
              and{" "}
              <span className="font-semibold text-white">
                {stats?.pendingGrading ?? 0} assignments to grade
              </span>
              .
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              Department
            </p>
            <p className="text-sm font-semibold">
              {stats?.department ?? "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat, index) => (
          <motion.div
            key={stat.title}
            custom={index + 1}
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
          custom={5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-3"
        >
          <DrilldownCard to="/teacher/classes" className="h-full">
            <Card className="h-full border-[#E5EBF3] shadow-sm transition-colors group-hover:border-orange-500/40">
              <CardHeader className="border-b border-[#E5EBF3] pb-4 pr-10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-[#002147]">
                      Today&apos;s Classes
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {stats?.todayLabel ?? "Loading…"}
                    </CardDescription>
                  </div>
                  <Badge className="bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10">
                    {todayClasses.length} sessions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-xs font-black uppercase tracking-wider text-[#002147] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                        <th className="px-6 py-3">Subject</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-6 py-3">Class Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayClasses.map((row, i) => (
                        <tr
                          key={`${row.code}-${row.section}-${i}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/teacher/attendance");
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
                              {row.subject}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {row.code} · Section {row.section}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 whitespace-nowrap font-medium text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0 text-[#E85D04]" />
                              {row.time}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 whitespace-nowrap font-medium text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
                              {row.room}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!todayClasses.length && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-6 py-10 text-center text-muted-foreground"
                          >
                            No classes scheduled for today.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </DrilldownCard>
        </motion.div>

        <motion.div
          custom={6}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-2"
        >
          <Card className="h-full border-[#E5EBF3] shadow-sm">
            <CardHeader className="border-b border-[#E5EBF3] pb-4">
              <CardTitle className="text-lg text-[#002147]">
                Pending Tasks
              </CardTitle>
              <CardDescription className="mt-1">
                Priority actions for this week
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {pendingTasks.map((task, index) => (
                <article
                  key={task.title}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(task.href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(task.href);
                    }
                  }}
                  className={cn(
                    "group border-b border-[#E5EBF3] p-5 last:border-0",
                    drilldownHoverClass,
                    "hover:translate-y-0 hover:bg-[#F4F7FB]/80 hover:shadow-none",
                    index === 0 && "bg-[#F4F7FB]/40"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge
                      className={cn(
                        "border-0 text-[10px] font-bold uppercase tracking-wide",
                        task.tagColor
                      )}
                    >
                      {task.tag}
                    </Badge>
                    <task.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[#002147]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#002147] transition-colors group-hover:text-[#16a34a]">
                    {task.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {task.detail}
                  </p>
                </article>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
