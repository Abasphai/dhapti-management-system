import {
  effectivePaymentStatus,
  summarizeLedger,
  syncOverdueStatuses,
} from "./payments.js";
import { prisma } from "./prisma.js";

export type FinancialHoldStatus = {
  active: boolean;
  pendingDues: number;
  hasOverdue: boolean;
  currency: string;
  message: string | null;
};

export function formatFinancialHoldMessage(pendingDues: number): string {
  const amount = pendingDues.toFixed(2);
  return `FINANCIAL HOLD ACTIVE: Your academic results and transcript are locked due to an outstanding tuition balance of $${amount}. Please settle your dues at the Finance Office or via the Fees page.`;
}

/** Resolve whether a student is on financial hold (pending or overdue dues). */
export async function getStudentFinancialHold(
  studentId: string
): Promise<FinancialHoldStatus> {
  await syncOverdueStatuses({ studentId });
  const rows = await prisma.payment.findMany({ where: { studentId } });
  const summary = summarizeLedger(rows);
  const hasOverdue = rows.some(
    (row) => effectivePaymentStatus(row) === "OVERDUE"
  );
  const pendingDues = summary.currentDue;
  const active = pendingDues > 0 || hasOverdue;

  return {
    active,
    pendingDues,
    hasOverdue,
    currency: summary.currency,
    message: active ? formatFinancialHoldMessage(pendingDues) : null,
  };
}
