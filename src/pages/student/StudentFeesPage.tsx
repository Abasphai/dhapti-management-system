import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Download, Loader2, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  DocumentPreviewModal,
  type DocumentPreviewData,
} from "@/components/common/DocumentPreviewModal";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";

interface FeeSummary {
  totalPaid: number;
  currentDue: number;
  totalDue: number;
  currency: string;
  nextDueDate: string | null;
}

interface FeeRow {
  id: string;
  amount: number;
  description: string;
  semester: string | null;
  receiptNumber: string | null;
  paymentMethod: string | null;
  status: "PAID" | "PENDING" | "OVERDUE";
  statusLabel: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildReceiptDoc(row: FeeRow): DocumentPreviewData {
  return {
    title: "Official Fee Receipt",
    subtitle: `Receipt ${row.receiptNumber ?? row.id}`,
    meta: [
      { label: "Description", value: row.description },
      { label: "Semester", value: row.semester ?? "—" },
      { label: "Method", value: row.paymentMethod ?? "—" },
      { label: "Paid At", value: formatDate(row.paidAt) },
      { label: "Status", value: "PAID" },
    ],
    amountLabel: formatMoney(row.amount),
    footerNote:
      "This is an official Dhapti fee receipt. Print or save as PDF for your records.",
  };
}

function printReceipt(row: FeeRow) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!win) return;
  win.document.write(`<!doctype html>
<html><head><title>Receipt ${row.receiptNumber ?? row.id}</title>
<style>
  body{font-family:Georgia,serif;color:#002147;padding:40px;max-width:640px;margin:0 auto}
  h1{margin:0 0 8px;font-size:28px} .muted{color:#64748b;font-size:13px}
  .box{border:1px solid #E5EBF3;border-radius:12px;padding:20px;margin-top:24px}
  .row{display:flex;justify-content:space-between;margin:8px 0}
  .amount{font-size:28px;font-weight:700;margin-top:16px}
  @media print{button{display:none}}
</style></head><body>
  <h1>Dhapti University</h1>
  <p class="muted">Official Fee Receipt</p>
  <div class="box">
    <div class="row"><span>Receipt No.</span><strong>${row.receiptNumber ?? row.id}</strong></div>
    <div class="row"><span>Description</span><strong>${row.description}</strong></div>
    <div class="row"><span>Semester</span><strong>${row.semester ?? "—"}</strong></div>
    <div class="row"><span>Method</span><strong>${row.paymentMethod ?? "—"}</strong></div>
    <div class="row"><span>Paid At</span><strong>${formatDate(row.paidAt)}</strong></div>
    <p class="amount">${formatMoney(row.amount)}</p>
    <p class="muted">Status: PAID</p>
  </div>
  <p style="margin-top:24px"><button onclick="window.print()">Print / Save PDF</button></p>
</body></html>`);
  win.document.close();
}

export function StudentFeesPage() {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<FeeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ summary: FeeSummary; data: FeeRow[] }>(
        "/payments/me"
      );
      setSummary(res.summary);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load fees");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const payable = useMemo(
    () =>
      rows
        .filter((r) => r.status === "PENDING" || r.status === "OVERDUE")
        .sort((a, b) => {
          const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return ad - bd;
        })[0] ?? null,
    [rows]
  );

  async function confirmPay() {
    if (!payable) return;
    setPaying(true);
    setError(null);
    try {
      const res = await api<{ receiptNumber: string | null; message: string }>(
        "/payments/pay",
        {
          method: "POST",
          body: JSON.stringify({
            paymentId: payable.id,
            paymentMethod: "Campus Gateway",
          }),
        }
      );
      toast.success(`Payment of ${formatMoney(payable.amount)} recorded!`);
      if (res.receiptNumber) {
        toast.message(`Receipt ${res.receiptNumber} issued.`);
      }
      setPayOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002147] md:text-3xl">
          Fees & Payments
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review your financial statement, outstanding balances, and receipts.
        </p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="mt-2 text-3xl font-bold text-[#16a34a]">
              {loading ? "…" : formatMoney(summary?.totalPaid ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Current Due</p>
            <p className="mt-2 text-3xl font-bold text-[#E85D04]">
              {loading ? "…" : formatMoney(summary?.currentDue ?? 0)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#E85D04]">
              {summary?.nextDueDate
                ? `Due by ${formatDate(summary.nextDueDate)}`
                : "No upcoming due date"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="flex flex-col justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="mt-2 text-3xl font-bold text-[#002147]">
                {loading ? "…" : formatMoney(summary?.totalDue ?? 0)}
              </p>
            </div>
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button
                  className="mt-4 w-full bg-[#16a34a] text-white hover:bg-[#15803d]"
                  disabled={!payable || loading}
                >
                  <Wallet className="h-4 w-4" />
                  Pay Now
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm campus payment</DialogTitle>
                  <DialogDescription>
                    {payable
                      ? `Pay ${formatMoney(payable.amount)} for ${payable.description}`
                      : "No outstanding balance."}
                  </DialogDescription>
                </DialogHeader>
                <Button
                  className="bg-[#002147] text-white hover:bg-[#003366]"
                  disabled={!payable || paying}
                  onClick={() => void confirmPay()}
                >
                  {paying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Confirm {payable ? formatMoney(payable.amount) : ""}
                </Button>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="border-b border-[#E5EBF3] pb-4">
          <h2 className="font-bold text-[#002147]">Financial Statement</h2>
          <p className="text-sm text-muted-foreground">
            Date, description, amount, status, and receipt preview.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton
              headers={["Date", "Description", "Amount", "Status", "Receipt"]}
            />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Receipt}
                title="No Fee Records Yet"
                description="Your tuition charges and payment receipts will appear in this statement."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="px-6 text-[11px] font-bold uppercase tracking-wider">
                    Date
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                    Description
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                    Amount
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="px-6 text-right text-[11px] font-bold uppercase tracking-wider">
                    Receipt
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-[#F4F7FB]/60">
                    <TableCell className="px-6 text-muted-foreground">
                      {formatDate(row.paidAt ?? row.dueDate ?? row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#002147]">
                        {row.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.receiptNumber ?? row.id}
                      </p>
                    </TableCell>
                    <TableCell className="font-semibold text-[#002147]">
                      {formatMoney(row.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "PAID"
                            ? "success"
                            : row.status === "OVERDUE"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#E5EBF3] text-[#002147] hover:bg-[#F4F7FB]"
                        disabled={row.status !== "PAID"}
                        onClick={() => {
                          setPreviewRow(row);
                          setPreviewOpen(true);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Preview Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DocumentPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        document={previewRow ? buildReceiptDoc(previewRow) : null}
        downloadLabel="Download / Print Receipt"
        onDownload={() => {
          if (previewRow) printReceipt(previewRow);
        }}
      />
    </div>
  );
}
