import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Award,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldOff,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";

type CertificateRow = {
  id: string;
  verificationCode: string;
  studentId: string;
  studentCode: string | null;
  studentName: string;
  degreeTitle: string;
  facultyName: string;
  programName: string;
  graduationDate: string;
  issuedAt: string;
  status: string;
  verifyUrl: string;
};

type StudentOption = {
  id: string;
  fullName: string;
  studentCode: string;
  program?: string | null;
  faculty?: { name: string } | null;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-[#002147]">{label}</Label>
      {children}
    </div>
  );
}

function publicVerifyAbsolute(code: string) {
  return `${window.location.origin}/verify/certificate/${code}`;
}

export function AdminCertificatesPage() {
  const [items, setItems] = useState<CertificateRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [form, setForm] = useState({
    studentId: "",
    degreeTitle: "",
    facultyName: "",
    programName: "",
    graduationDate: "",
    issuedAt: new Date().toISOString().slice(0, 10),
  });
  const [printCert, setPrintCert] = useState<CertificateRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await api<{ data: CertificateRow[] }>(
        `/admin/certificates${qs}`
      );
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load certificates"
      );
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openIssue = async () => {
    setForm({
      studentId: "",
      degreeTitle: "",
      facultyName: "",
      programName: "",
      graduationDate: "",
      issuedAt: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
    try {
      const res = await api<{ data: StudentOption[] }>(
        "/students?pageSize=100&status=GRADUATED"
      );
      let list = res.data ?? [];
      if (list.length === 0) {
        const all = await api<{ data: StudentOption[] }>(
          "/students?pageSize=100"
        );
        list = all.data ?? [];
      }
      setStudents(list);
    } catch {
      setStudents([]);
    }
  };

  const onStudentPick = (studentId: string) => {
    const s = students.find((x) => x.id === studentId);
    setForm((f) => ({
      ...f,
      studentId,
      programName: s?.program ?? f.programName,
      facultyName: s?.faculty?.name ?? f.facultyName,
      degreeTitle:
        f.degreeTitle ||
        (s?.program ? `Bachelor — ${s.program}` : f.degreeTitle),
    }));
  };

  const onIssue = async () => {
    if (!form.studentId || !form.degreeTitle || !form.graduationDate) {
      toast.error("Student, degree title, and graduation date are required");
      return;
    }
    setSaving(true);
    try {
      const created = await api<CertificateRow>("/admin/certificates", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success(`Issued — code ${created.verificationCode}`);
      setDialogOpen(false);
      setPrintCert(created);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to issue certificate"
      );
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (row: CertificateRow) => {
    if (!window.confirm(`Revoke certificate ${row.verificationCode}?`)) return;
    try {
      await api(`/admin/certificates/${row.id}/revoke`, { method: "POST" });
      toast.success("Certificate revoked");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke");
    }
  };

  const printOfficial = (row: CertificateRow) => {
    const url = publicVerifyAbsolute(row.verificationCode);
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
    const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=1000");
    if (!w) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>Dhapti Certificate</title>
      <style>
        body{font-family:Georgia,serif;color:#002147;padding:40px;text-align:center}
        .badge{display:inline-block;background:#16a34a;color:#fff;padding:6px 14px;border-radius:999px;font:700 12px sans-serif;letter-spacing:.08em}
        h1{font-size:28px;margin:24px 0 8px}
        .meta{margin-top:28px;text-align:left;max-width:480px;margin-left:auto;margin-right:auto;font-size:14px;line-height:1.7}
        .code{font-family:ui-monospace,monospace;font-size:18px;letter-spacing:.12em;margin-top:20px}
        img{margin-top:24px}
      </style></head><body>
      <div class="badge">OFFICIAL CERTIFICATE</div>
      <h1>Dhapti University</h1>
      <p>This certifies that</p>
      <h2>${row.studentName}</h2>
      <p>has been awarded</p>
      <h3>${row.degreeTitle}</h3>
      <div class="meta">
        <div><strong>Faculty:</strong> ${row.facultyName}</div>
        ${row.programName ? `<div><strong>Program:</strong> ${row.programName}</div>` : ""}
        <div><strong>Graduation date:</strong> ${row.graduationDate}</div>
        <div><strong>Issued:</strong> ${row.issuedAt.slice(0, 10)}</div>
      </div>
      <div class="code">${row.verificationCode}</div>
      <img src="${qr}" alt="Verification QR" width="160" height="160" />
      <p style="font-size:12px;color:#64748b">${url}</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Certificates"
          description="Issue graduation certificates and generate public verification codes. Public verify shows name, degree, faculty, and dates only."
        />
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#003366]"
            onClick={() => void openIssue()}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Issue Certificate
          </Button>
        </div>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="border-b border-[#E5EBF3] pb-4">
          <CardTitle className="text-lg text-[#002147]">Issued certificates</CardTitle>
          <CardDescription>
            Search by student name, student ID, or verification code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pt-4">
          <div className="relative max-w-md px-6">
            <Search className="pointer-events-none absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
            />
          </div>
          {loading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="w-full overflow-x-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="border-b border-slate-700/50 bg-[#002147]/80 hover:bg-[#002147]/80">
                  <TableHead className="w-[24%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                    Student
                  </TableHead>
                  <TableHead className="w-[22%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                    Degree
                  </TableHead>
                  <TableHead className="w-[18%] whitespace-nowrap px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                    Code
                  </TableHead>
                  <TableHead className="w-[12%] whitespace-nowrap px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                    Status
                  </TableHead>
                  <TableHead className="w-[14%] whitespace-nowrap px-3 text-right text-xs font-black uppercase tracking-wider text-slate-200">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-[#F4F7FB]/70"
                  >
                    <TableCell className="max-w-0 px-3 py-3">
                      <div className="truncate text-sm font-bold text-[#002147]">
                        {row.studentName}
                      </div>
                      <div className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {row.studentCode}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-slate-600">
                      {row.degreeTitle}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold text-slate-700">
                      {row.verificationCode}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3">
                      <Badge
                        variant={
                          row.status === "VALID" || row.status === "ISSUED"
                            ? "success"
                            : row.status === "REVOKED"
                              ? "danger"
                              : "warning"
                        }
                        className="px-2.5 py-0.5 uppercase"
                      >
                        {row.status === "VALID" ? "ISSUED" : row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#002147] hover:bg-[#002147]/10"
                          title="Print / Download"
                          onClick={() => printOfficial(row)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {row.status === "VALID" && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                            title="Revoke"
                            onClick={() => void onRevoke(row)}
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No certificates yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#002147]">
              <Award className="h-5 w-5 text-[#ea580c]" />
              Issue Certificate
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Student">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.studentId}
                onChange={(e) => onStudentPick(e.target.value)}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.studentCode})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Degree title">
              <Input
                value={form.degreeTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, degreeTitle: e.target.value }))
                }
              />
            </Field>
            <Field label="Faculty">
              <Input
                value={form.facultyName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, facultyName: e.target.value }))
                }
              />
            </Field>
            <Field label="Program">
              <Input
                value={form.programName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, programName: e.target.value }))
                }
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Graduation date">
                <Input
                  type="date"
                  value={form.graduationDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, graduationDate: e.target.value }))
                  }
                />
              </Field>
              <Field label="Issue date">
                <Input
                  type="date"
                  value={form.issuedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issuedAt: e.target.value }))
                  }
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              A unique 12-character verification code and QR URL are generated
              automatically on issue.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#002147] text-white hover:bg-[#003366]"
              disabled={saving}
              onClick={() => void onIssue()}
            >
              Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printCert && (
        <Card className="border-[#16a34a]/40 bg-[#F0FDF4]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold text-[#002147]">
                Ready to print: {printCert.verificationCode}
              </p>
              <p className="text-sm text-slate-600">
                {publicVerifyAbsolute(printCert.verificationCode)}
              </p>
            </div>
            <Button type="button" onClick={() => printOfficial(printCert)}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print / Download
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
