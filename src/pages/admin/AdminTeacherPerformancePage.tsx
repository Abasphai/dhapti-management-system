import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Dept = { id: string; name: string; code: string; facultyId: string };
type Faculty = { id: string; name: string; code: string };

type RankRow = {
  rank: number;
  teacherId: string;
  facultyCode: string;
  teacherName: string;
  departmentName: string;
  totalReviews: number;
  averageOverall: number | null;
  averageTeachingQuality: number | null;
  averagePunctuality: number | null;
  averageEngagement: number | null;
  eligibleForRenewal: boolean;
  renewalLabel: string | null;
};

export function AdminTeacherPerformancePage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [facultyId, setFacultyId] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [rows, setRows] = useState<RankRow[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [f, d] = await Promise.all([
          api<{ data: Faculty[] }>("/faculties?pageSize=100"),
          api<{ data: Dept[] }>("/departments?pageSize=200"),
        ]);
        setFaculties(f.data ?? []);
        setDepartments(d.data ?? []);
      } catch {
        /* filters optional */
      }
    })();
  }, []);

  const filteredDepartments = departments.filter(
    (d) => facultyId === "all" || d.facultyId === facultyId
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (facultyId !== "all") params.set("facultyId", facultyId);
      if (departmentId !== "all") params.set("departmentId", departmentId);
      const res = await api<{ data: RankRow[]; eligibleCount: number }>(
        `/admin/ratings/report?${params}`
      );
      setRows(res.data);
      setEligibleCount(res.eligibleCount);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load report"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [facultyId, departmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("dhapti-auth-token");
      const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
      const params = new URLSearchParams({ format: "csv" });
      if (facultyId !== "all") params.set("facultyId", facultyId);
      if (departmentId !== "all") params.set("departmentId", departmentId);
      const res = await fetch(`${base}/admin/ratings/report?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhapti-teacher-performance-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Department performance report downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Teacher Performance"
        description="Rank lecturers by student evaluations and export department reports."
      />

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-lg text-[#002147]">
              Performance ranking
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {eligibleCount} teacher
              {eligibleCount === 1 ? "" : "s"} eligible for contract renewal
              (avg ≥ 4.5).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-[#16a34a] hover:bg-[#15803d]"
              disabled={exporting}
              onClick={() => void exportCsv()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting
                ? "Exporting…"
                : "Export Department Performance Report"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Select
              value={facultyId}
              onValueChange={(v) => {
                setFacultyId(v);
                setDepartmentId("all");
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Faculty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All faculties</SelectItem>
                {faculties.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {filteredDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100">
                    <TableHead className="w-[8%]">Rank</TableHead>
                    <TableHead className="w-[22%]">Teacher</TableHead>
                    <TableHead className="w-[18%]">Department</TableHead>
                    <TableHead className="w-[10%]">Reviews</TableHead>
                    <TableHead className="w-[12%]">Avg ★</TableHead>
                    <TableHead className="w-[30%]">Renewal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No teacher ratings yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.teacherId}>
                        <TableCell className="font-bold text-[#002147]">
                          #{row.rank}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-[#002147]">
                            {row.teacherName}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.facultyCode}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.departmentName}
                        </TableCell>
                        <TableCell>{row.totalReviews}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#002147]">
                            {row.averageOverall != null
                              ? row.averageOverall.toFixed(2)
                              : "—"}
                            <Star className="h-3.5 w-3.5 fill-[#ea580c] text-[#ea580c]" />
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.eligibleForRenewal ? (
                            <Badge className="bg-[#16a34a] text-white hover:bg-[#16a34a]">
                              Eligible for Contract Renewal (Next Semester)
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
