import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ScrollText } from "lucide-react";
import { toast } from "sonner";

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
import { ApiError, api } from "@/lib/api";

type AuditRow = {
  id: string;
  userName: string;
  userEmail: string | null;
  role: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

const MODULES = [
  "All",
  "Auth",
  "Marks",
  "Admissions",
  "Certificates",
  "CMS",
  "Q&A",
  "Settings",
] as const;

export function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [module, setModule] = useState<string>("All");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (module !== "All") params.set("module", module);
      if (q.trim()) params.set("q", q.trim());
      const res = await api<{
        data: AuditRow[];
        pagination: { totalPages: number };
      }>(`/admin/audit-logs?${params}`);
      setItems(res.data ?? []);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load audit logs"
      );
    } finally {
      setLoading(false);
    }
  }, [module, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="System Audit Logs"
          description="Immutable trail of sensitive actions across Auth, Marks, Admissions, Certificates, CMS, and Q&A."
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-[#002147]">
            <ScrollText className="h-4 w-4 text-[#ea580c]" />
            Activity log
          </CardTitle>
          <CardDescription>
            Filter by module or search by user name / email / action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder="Search user, action…"
              />
            </div>
            <Select
              value={module}
              onValueChange={(v) => {
                setPage(1);
                setModule(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.userName}</div>
                      {row.userEmail && (
                        <div className="text-xs text-muted-foreground">
                          {row.userEmail}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.role}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.action}
                    </TableCell>
                    <TableCell>{row.module}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {row.entityType}
                      {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ""}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No audit entries match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
