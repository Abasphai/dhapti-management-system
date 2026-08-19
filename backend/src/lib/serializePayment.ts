import type { Payment, PaymentStatus } from "@prisma/client";

import { effectivePaymentStatus } from "./payments.js";

export function serializePayment(
  row: Payment & {
    student?: {
      id: string;
      studentCode: string;
      fullName: string;
    } | null;
  }
) {
  const status = effectivePaymentStatus(row);
  return {
    id: row.id,
    studentId: row.studentId,
    studentCode: row.student?.studentCode ?? null,
    studentName: row.student?.fullName ?? null,
    amount: row.amount,
    description: row.description,
    semester: row.semester,
    receiptNumber: row.receiptNumber,
    paymentMethod: row.paymentMethod,
    status,
    dueDate: row.dueDate?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function uiPaymentStatus(status: PaymentStatus): "Paid" | "Pending" | "Overdue" {
  if (status === "PAID") return "Paid";
  if (status === "OVERDUE") return "Overdue";
  return "Pending";
}
