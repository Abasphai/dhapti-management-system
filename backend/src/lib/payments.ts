import type { Payment, PaymentStatus, Prisma } from "@prisma/client";

import { prisma } from "./prisma.js";

/** Derive OVERDUE for unpaid rows past dueDate (without inventing Dhapti fee policy). */
export function effectivePaymentStatus(row: {
  status: PaymentStatus;
  dueDate: Date | null;
  paidAt?: Date | null;
}): PaymentStatus {
  if (row.status === "PAID") return "PAID";
  if (row.dueDate && row.dueDate.getTime() < Date.now()) return "OVERDUE";
  if (row.status === "OVERDUE") return "OVERDUE";
  return "PENDING";
}

export async function syncOverdueStatuses(where?: Prisma.PaymentWhereInput) {
  const now = new Date();
  await prisma.payment.updateMany({
    where: {
      ...(where ?? {}),
      status: "PENDING",
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });
}

export function generateReceiptNumber() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCPT-${stamp}-${rand}`;
}

export type LedgerSummary = {
  totalPaid: number;
  currentDue: number;
  totalDue: number;
  currency: string;
  nextDueDate: string | null;
};

export function summarizeLedger(rows: Payment[]): LedgerSummary {
  let totalPaid = 0;
  let totalDue = 0;
  let nextDue: Date | null = null;

  for (const row of rows) {
    const status = effectivePaymentStatus(row);
    if (status === "PAID") {
      totalPaid += row.amount;
    } else {
      totalDue += row.amount;
      if (row.dueDate) {
        if (!nextDue || row.dueDate.getTime() < nextDue.getTime()) {
          nextDue = row.dueDate;
        }
      }
    }
  }

  return {
    totalPaid: roundMoney(totalPaid),
    currentDue: roundMoney(totalDue),
    totalDue: roundMoney(totalDue),
    currency: "$",
    nextDueDate: nextDue?.toISOString() ?? null,
  };
}

export type AdminFinanceSummary = {
  totalRevenue: number;
  outstandingDues: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  collectedLast24h: number;
  monthlyRevenue: Array<{ month: string; amount: number; key: string }>;
  currency: string;
};

export async function buildAdminFinanceSummary(): Promise<AdminFinanceSummary> {
  await syncOverdueStatuses();

  const rows = await prisma.payment.findMany({
    select: {
      amount: true,
      status: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
    },
  });

  let totalRevenue = 0;
  let outstandingDues = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let collectedLast24h = 0;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const monthMap = new Map<string, number>();

  for (const row of rows) {
    const status = effectivePaymentStatus(row);
    if (status === "PAID") {
      totalRevenue += row.amount;
      paidCount += 1;
      const paidAt = row.paidAt ?? row.createdAt;
      if (paidAt.getTime() >= dayAgo) {
        collectedLast24h += row.amount;
      }
      const key = `${paidAt.getUTCFullYear()}-${String(paidAt.getUTCMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + row.amount);
    } else if (status === "OVERDUE") {
      outstandingDues += row.amount;
      overdueCount += 1;
    } else {
      outstandingDues += row.amount;
      pendingCount += 1;
    }
  }

  const monthlyRevenue = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, amount]) => {
      const [y, m] = key.split("-");
      const label = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString(
        "en-US",
        { month: "short", timeZone: "UTC" }
      );
      return { month: label, amount: roundMoney(amount), key };
    });

  return {
    totalRevenue: roundMoney(totalRevenue),
    outstandingDues: roundMoney(outstandingDues),
    paidCount,
    pendingCount,
    overdueCount,
    collectedLast24h: roundMoney(collectedLast24h),
    monthlyRevenue,
    currency: "$",
  };
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
