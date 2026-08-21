import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, RefreshCw, QrCode } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type LocationRow = {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  roomHint: string | null;
  status: "ACTIVE" | "INACTIVE";
  displayPath: string;
  department: { id: string; name: string; code: string };
};

type DeptOption = { id: string; name: string; code: string };

export function AdminAttendanceLocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    departmentId: "",
    name: "",
    code: "MAIN",
    roomHint: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locRes, deptRes] = await Promise.all([
        api<{ data: LocationRow[] }>("/admin/attendance-locations?pageSize=100"),
        api<{ data: DeptOption[] }>("/departments?pageSize=100&status=ACTIVE"),
      ]);
      setRows(locRes.data ?? []);
      setDepartments(deptRes.data ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load locations"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureDefaults() {
    setBusy(true);
    try {
      const res = await api<{ created: number; departments: number }>(
        "/admin/attendance-locations/ensure-defaults",
        { method: "POST" }
      );
      toast.success(
        `Ensured defaults: ${res.created} created across ${res.departments} departments`
      );
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to ensure defaults"
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row: LocationRow) {
    setBusy(true);
    try {
      await api(`/admin/attendance-locations/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      toast.success(
        row.status === "ACTIVE" ? "Location deactivated" : "Location activated"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(row: LocationRow) {
    setBusy(true);
    try {
      const res = await api<{ revokedActiveTokens: number }>(
        `/admin/attendance-locations/${row.id}/regenerate-tokens`,
        { method: "POST" }
      );
      toast.success(
        `Revoked ${res.revokedActiveTokens} active QR token(s). Display will mint a new token in Phase B.`
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Regenerate failed");
    } finally {
      setBusy(false);
    }
  }

  async function createLocation() {
    if (!form.departmentId || form.name.trim().length < 2) {
      toast.error("Department and name are required");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/attendance-locations", {
        method: "POST",
        body: JSON.stringify({
          departmentId: form.departmentId,
          name: form.name.trim(),
          code: form.code.trim() || "MAIN",
          roomHint: form.roomHint.trim() || null,
        }),
      });
      toast.success("Attendance location created");
      setCreateOpen(false);
      setForm({ departmentId: "", name: "", code: "MAIN", roomHint: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Attendance Locations"
          description="Department QR display locations for Dynamic QR Verified Attendance. Phase A manages locations; Phase B adds live rotating QR displays."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void ensureDefaults()}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Ensure defaults
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#003366]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add location
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="border-b border-[#E5EBF3] pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-[#002147]">
            <QrCode className="h-5 w-5 text-[#ea580c]" />
            Department displays
          </CardTitle>
          <CardDescription>
            One MAIN location per department is typical. Optional roomHint
            prepares room-level displays without redesigning attendance records.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading locations…
            </div>
          ) : (
            <div className="table-scroll">
              <Table className="w-full min-w-[720px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-700/50 bg-[#002147]/80 hover:bg-[#002147]/80">
                    <TableHead className="w-[18%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                      Department
                    </TableHead>
                    <TableHead className="w-[24%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                      Name
                    </TableHead>
                    <TableHead className="w-[10%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                      Code
                    </TableHead>
                    <TableHead className="w-[12%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                      Room hint
                    </TableHead>
                    <TableHead className="w-[10%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                      Status
                    </TableHead>
                    <TableHead className="w-[26%] px-3 text-right text-xs font-black uppercase tracking-wider text-slate-200">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-[#F4F7FB]/70"
                    >
                      <TableCell className="px-3 py-3">
                        <p className="truncate text-sm font-bold text-[#002147]">
                          {row.department.name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.department.code}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-0 truncate px-3 py-3 text-sm">
                        {row.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold">
                        {row.code}
                      </TableCell>
                      <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-muted-foreground">
                        {row.roomHint || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <Badge
                          variant={
                            row.status === "ACTIVE" ? "success" : "secondary"
                          }
                          className="uppercase"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void toggleStatus(row)}
                          >
                            {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void regenerate(row)}
                          >
                            Regenerate
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Open QR display"
                            onClick={() =>
                              window.open(row.displayPath, "_blank", "noopener")
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-muted-foreground"
                      >
                        No locations yet. Click “Ensure defaults” to create one
                        per active department.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">
              Add attendance location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-bold text-[#002147]">Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => {
                  const d = departments.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    departmentId: v,
                    name: d
                      ? `${d.name} Faculty Attendance`
                      : f.name,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-[#002147]">Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="font-bold text-[#002147]">Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="MAIN"
                />
              </div>
              <div>
                <Label className="font-bold text-[#002147]">
                  Room hint (optional)
                </Label>
                <Input
                  value={form.roomHint}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roomHint: e.target.value }))
                  }
                  placeholder="IT-2"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#002147] text-white hover:bg-[#003366]"
              disabled={busy}
              onClick={() => void createLocation()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
