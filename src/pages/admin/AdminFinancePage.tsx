import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  DollarSign,
  Loader2,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
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
import { cn } from "@/lib/utils";

interface FinanceSummary {
  totalRevenue: number;
  outstandingDues: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  collectedLast24h: number;
  monthlyRevenue: Array<{ month: string; amount: number }>;
  currency: string;
}

interface TxnRow {
  id: string;
  studentId: string;
  studentCode: string | null;
  studentName: string | null;
  amount: number;
  description: string;
  receiptNumber: string | null;
  paymentMethod: string | null;
  status: string;
  statusLabel: string;
  paidAt: string | null;
  createdAt: string;
}

interface StudentOption {
  id: string;
  studentCode: string;
  name: string;
  fullName: string;
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString()}`;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    amount: "",
    description: "Tuition Fee",
    semester: "",
    paymentMethod: "Cash Desk",
    status: "PAID" as "PAID" | "PENDING",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);

      const [sum, tx] = await Promise.all([
        api<FinanceSummary>("/admin/finance/summary"),
        api<{
          data: TxnRow[];
          pagination: { totalPages: number };
        }>(`/admin/finance/transactions?${params}`),
      ]);
      setSummary(sum);
      setRows(tx.data);
      setTotalPages(tx.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load finance");
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api<{ data: StudentOption[] }>("/students?pageSize=100")
      .then((res) => setStudents(res.data))
      .catch(() => setStudents([]));
  }, []);

  const monthlyRevenue = summary?.monthlyRevenue ?? [];
  const maxRevenue = useMemo(
    () => Math.max(1, ...monthlyRevenue.map((m) => m.amount)),
    [monthlyRevenue]
  );

  const stats = [
    {
      title: "Total Revenue",
      value: formatMoney(summary?.totalRevenue ?? 0),
      description: "Collected fee payments",
      icon: DollarSign,
      accent: "bg-[#16a34a]/10 text-[#16a34a]",
    },
    {
      title: "Outstanding Dues",
      value: formatMoney(summary?.outstandingDues ?? 0),
      description: "Pending student fee balances",
      icon: Wallet,
      accent: "bg-[#ea580c]/10 text-[#ea580c]",
    },
    {
      title: "Paid Transactions",
      value: String(summary?.paidCount ?? 0),
      description: `${summary?.pendingCount ?? 0} pending · ${summary?.overdueCount ?? 0} overdue`,
      icon: Receipt,
      accent: "bg-[#002147]/10 text-[#002147]",
    },
  ];

  async function submitRecord() {
    const amount = Number(form.amount);
    if (!form.studentId || !Number.isFinite(amount) || amount <= 0) {
      setError("Select a student and enter a valid amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/admin/finance/record-payment", {
        method: "POST",
        body: JSON.stringify({
          studentId: form.studentId,
          amount,
          description: form.description.trim() || "Tuition Fee",
          semester: form.semester.trim() || null,
          paymentMethod: form.paymentMethod.trim() || "Cash Desk",
          status: form.status,
        }),
      });
      toast.success(`Payment of $${amount.toLocaleString()} recorded!`);
      setRecordOpen(false);
      setForm((f) => ({ ...f, amount: "", description: "Tuition Fee" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Finance & Fees"
          description="Monitor tuition collections, outstanding balances, and payment activity."
        />
        <Button
          type="button"
          className="bg-[#002147] text-white hover:bg-[#003366]"
          onClick={() => setRecordOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="border-[#E5EBF3] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={cn("rounded-lg p-2", stat.accent)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#002147] dark:text-slate-100">
                {loading ? "…" : stat.value}
              </div>
              <CardDescription className="mt-1">
                {stat.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-[#E5EBF3] pb-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Revenue Collection
              </CardTitle>
              <CardDescription className="mt-1">
                Last 6 months fee intake
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#16a34a]/10 px-3 py-1.5 text-xs font-semibold text-[#16a34a]">
              <TrendingUp className="h-3.5 w-3.5" />
              {summary?.paidCount ?? 0} paid
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {monthlyRevenue.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No paid collections yet to chart.
            </p>
          ) : (
            <div className="flex h-56 items-end gap-3 sm:gap-5">
              {monthlyRevenue.map((item) => {
                const height = Math.max(12, (item.amount / maxRevenue) * 100);
                return (
                  <div
                    key={`${item.month}-${item.amount}`}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[11px] font-semibold text-[#002147] dark:text-slate-200">
                      ${(item.amount / 1000).toFixed(item.amount >= 1000 ? 0 : 1)}
                      {item.amount >= 1000 ? "k" : ""}
                    </span>
                    <div className="flex h-44 w-full items-end justify-center rounded-t-lg bg-[#F4F7FB] dark:bg-slate-900">
                      <div
                        className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-[#002147] to-[#ea580c] transition-all duration-500"
                        style={{ height: `${height}%` }}
                        title={formatMoney(item.amount)}
                      />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-[#E5EBF3] pb-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Recent Transactions
              </CardTitle>
              <CardDescription className="mt-1">
                Student fee payments and outstanding charges
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <Clock className="h-4 w-4 text-[#ea580c]" />
              <span className="font-semibold text-[#002147] dark:text-slate-100">
                {formatMoney(summary?.collectedLast24h ?? 0)}
              </span>
              <span className="text-muted-foreground">collected (24h)</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Input
              className="max-w-xs"
              placeholder="Search student or receipt…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton
              headers={[
                "Transaction",
                "Student",
                "Amount",
                "Method",
                "Time",
                "Status",
              ]}
            />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Receipt}
                title="No Transactions Found"
                description="Fee payments and outstanding charges will appear here once recorded."
              />
            </div>
          ) : (
          <div className="table-scroll">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-b border-slate-700/50 bg-[#002147]/80 hover:bg-[#002147]/80 dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="w-[18%] whitespace-nowrap px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Transaction
                </TableHead>
                <TableHead className="w-[22%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Student
                </TableHead>
                <TableHead className="w-[12%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Amount
                </TableHead>
                <TableHead className="w-[14%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Method
                </TableHead>
                <TableHead className="w-[12%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Time
                </TableHead>
                <TableHead className="w-[12%] whitespace-nowrap px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {
                rows.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="border-b border-slate-100 hover:bg-[#F4F7FB]/70 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    <TableCell className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                      {tx.receiptNumber ?? tx.id.slice(0, 12)}
                      <p className="mt-0.5 truncate font-sans text-xs font-normal text-muted-foreground">
                        {tx.description}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-0 px-3 py-3">
                      <p className="truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                        {tx.studentName ?? "—"}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {tx.studentCode}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-[#002147] dark:text-slate-100">
                      {formatMoney(tx.amount)}
                    </TableCell>
                    <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-muted-foreground">
                      {tx.paymentMethod ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">
                      {formatTime(tx.paidAt ?? tx.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-3">
                      <Badge
                        variant={
                          tx.status === "PAID"
                            ? "success"
                            : tx.status === "OVERDUE"
                              ? "danger"
                              : "warning"
                        }
                        className="px-2.5 py-0.5 uppercase"
                      >
                        {tx.status === "PAID"
                          ? "PAID"
                          : tx.status === "OVERDUE"
                            ? "OVERDUE"
                            : "PENDING"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
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
      )}

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#002147]">
                Student
              </label>
              <Select
                value={form.studentId}
                onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.studentCode} — {s.fullName || s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#002147]">
                Amount
              </label>
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="1200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#002147]">
                Description
              </label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#002147]">
                  Method
                </label>
                <Input
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentMethod: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#002147]">
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as "PAID" | "PENDING",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="PENDING">Pending charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#002147]">
                Semester
              </label>
              <Input
                value={form.semester}
                onChange={(e) =>
                  setForm((f) => ({ ...f, semester: e.target.value }))
                }
                placeholder="Semester 3"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#002147] text-white hover:bg-[#003366]"
              disabled={busy}
              onClick={() => void submitRecord()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
