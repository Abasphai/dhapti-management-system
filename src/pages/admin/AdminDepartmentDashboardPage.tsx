import { useEffect, useState } from "react";
import { Building2, BookOpen, GraduationCap, Users } from "lucide-react";

import { PageHeader, PortalStatCard } from "@/components/portals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";

type DeptStats = {
  department: {
    id: string;
    name: string;
    code: string;
    facultyName: string;
    facultyCode: string;
  };
  totalStudents: number;
  totalTeachers: number;
  totalFaculty: number;
  totalCourses: number;
  activeCourses: number;
};

export function AdminDepartmentDashboardPage() {
  const [stats, setStats] = useState<DeptStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await api<DeptStats>("/admin/department-dashboard/stats");
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load department dashboard"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Dashboard"
        description={
          stats
            ? `${stats.department.name} (${stats.department.code}) · ${stats.department.facultyName}`
            : "Scoped statistics for your department only."
        }
      />

      {loading && (
        <p className="text-sm text-muted-foreground">Loading department stats…</p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PortalStatCard
              title="Dept Students"
              value={stats.totalStudents}
              icon={<Users className="h-4 w-4" />}
            />
            <PortalStatCard
              title="Dept Faculty"
              value={stats.totalFaculty}
              icon={<GraduationCap className="h-4 w-4" />}
            />
            <PortalStatCard
              title="Dept Courses"
              value={stats.totalCourses}
              icon={<BookOpen className="h-4 w-4" />}
            />
            <PortalStatCard
              title="Active Courses"
              value={stats.activeCourses}
              icon={<Building2 className="h-4 w-4" />}
            />
          </div>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Scope notice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Access is limited to{" "}
              <strong className="text-[#002147]">{stats.department.name}</strong>.
              Finance, global settings, other departments, and university-wide
              records are blocked by the API.
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
