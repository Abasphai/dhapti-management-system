import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  DollarSign,
  GraduationCap,
  TrendingUp,
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

type AdminStats = {
  totalStudents: number;
  activeFaculty: number;
  currentRevenue: number;
  currentRevenueLabel: string;
  activePrograms: number;
  maintenanceMode: boolean;
  recentRegistrations: Array<{
    name: string;
    id: string;
    faculty: string;
    status: "Approved" | "Pending" | "Rejected";
  }>;
  financeSummary: Array<{
    day: string;
    label: string;
    amount: number;
    pct: number;
  }>;
};

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<AdminStats>("/admin/dashboard/stats")
      .then(setStats)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load stats")
      );
  }, []);

  const cards = [
    {
      title: "Total Registered Students",
      value: stats ? String(stats.totalStudents) : "—",
      description: "All undergraduate & postgraduate",
      icon: GraduationCap,
      accent: "bg-[#002147]/10 text-[#002147]",
      href: "/admin/students",
    },
    {
      title: "Active Faculty Members",
      value: stats ? String(stats.activeFaculty) : "—",
      description: "Full-time & adjunct staff",
      icon: Users,
      accent: "bg-[#16a34a]/10 text-[#16a34a]",
      href: "/admin/teachers",
    },
    {
      title: "Total Revenue",
      value: stats?.currentRevenueLabel ?? "—",
      description: "Collected fee payments",
      icon: DollarSign,
      accent: "bg-[#ea580c]/10 text-[#ea580c]",
      href: "/admin/finance",
    },
    {
      title: "Active Programs",
      value: stats ? String(stats.activePrograms) : "—",
      description: "Active academic programs",
      icon: BookOpen,
      accent: "bg-[#002147]/10 text-[#002147]",
      href: "/admin/faculties",
    },
  ];

  const recent = stats?.recentRegistrations ?? [];
  const financeSummary = stats?.financeSummary ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-[#002147] p-6 text-white shadow-xl shadow-[#002147]/20 md:p-8"
      >
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#ea580c]/20 blur-3xl" />
        <div className="absolute -bottom-16 right-20 h-56 w-56 rounded-full bg-[#16a34a]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              Administrative Control Center
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Welcome, System Administrator
            </h2>
            <p className="mt-2 text-sm text-white/70 md:text-base">
              Oversee admissions, faculty, finance, and university operations from one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/settings")}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm",
              "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-[#ea580c]/50 hover:bg-white/10"
            )}
          >
            <TrendingUp className="h-5 w-5 text-[#16a34a]" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                System Health
              </p>
              <p className="text-sm font-semibold">
                {stats?.maintenanceMode
                  ? "Maintenance mode"
                  : "All services online"}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
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
                  <div className="text-3xl font-bold text-[#002147]">{stat.value}</div>
                  <CardDescription className="mt-1">{stat.description}</CardDescription>
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
          <DrilldownCard to="/admin/admissions" className="h-full">
            <Card className="h-full border-[#E5EBF3] shadow-sm transition-colors group-hover:border-orange-500/40">
              <CardHeader className="border-b border-[#E5EBF3] pb-4 pr-10">
                <CardTitle className="text-lg text-[#002147]">
                  Recent Student Registrations
                </CardTitle>
                <CardDescription className="mt-1">
                  Latest admission applications awaiting review
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-xs font-black uppercase tracking-wider text-[#002147] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Faculty</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((row, i) => (
                        <tr
                          key={`${row.id}-${i}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/admin/admissions");
                          }}
                          className={cn(
                            "border-b border-slate-200 last:border-0",
                            drilldownHoverClass,
                            "hover:translate-y-0 hover:shadow-none",
                            i % 2 === 1 && "bg-slate-50/70 dark:bg-slate-800/20"
                          )}
                        >
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                            {row.name}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{row.id}</td>
                          <td className="px-4 py-4 text-muted-foreground">{row.faculty}</td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                row.status === "Approved"
                                  ? "success"
                                  : row.status === "Rejected"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {!recent.length && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-10 text-center text-muted-foreground"
                          >
                            No recent applications yet.
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
          <DrilldownCard to="/admin/finance" className="h-full">
            <Card className="h-full border-[#E5EBF3] shadow-sm transition-colors group-hover:border-orange-500/40">
              <CardHeader className="border-b border-[#E5EBF3] pb-4 pr-10">
                <CardTitle className="text-lg text-[#002147]">Finance Summary</CardTitle>
                <CardDescription className="mt-1">
                  Fee collections — last 5 days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                {financeSummary.map((item) => (
                  <div key={item.day + item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-[#002147]">{item.day}</p>
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      </div>
                      <p className="font-bold text-[#ea580c]">
                        ${item.amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#E5EBF3]">
                      <div
                        className="h-full rounded-full bg-[#ea580c] transition-all duration-500"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    5-Day Total
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#002147]">
                    $
                    {financeSummary
                      .reduce((sum, d) => sum + d.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </DrilldownCard>
        </motion.div>
      </div>
    </div>
  );
}
