import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import {
  buildAdminFinanceSummary,
  generateReceiptNumber,
  summarizeLedger,
  syncOverdueStatuses,
} from "../lib/payments.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  serializePayment,
  uiPaymentStatus,
} from "../lib/serializePayment.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    select: { id: true, studentCode: true, fullName: true },
  });
}

async function resolveAdmin(userId: string) {
  return prisma.admin.findUnique({
    where: { userId },
    select: { id: true },
  });
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** GET /payments/me — student fee ledger + summary */
paymentsRouter.get(
  "/payments/me",
  requireRoles("STUDENT"),
  requirePermission(Permission.PAYMENTS_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    await syncOverdueStatuses({ studentId: student.id });

    const rows = await prisma.payment.findMany({
      where: { studentId: student.id },
      orderBy: [{ createdAt: "desc" }],
    });

    const summary = summarizeLedger(rows);
    const { getStudentFinancialHold } = await import("../lib/financialHold.js");
    const financialHold = await getStudentFinancialHold(student.id);
    return res.json({
      summary,
      financialHold,
      data: rows.map((row) => {
        const serialized = serializePayment(row);
        return {
          ...serialized,
          statusLabel: uiPaymentStatus(serialized.status),
        };
      }),
    });
  }
);

/** GET /students/me/financial-hold — results lock status */
paymentsRouter.get(
  "/students/me/financial-hold",
  requireRoles("STUDENT"),
  requirePermission(Permission.PAYMENTS_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    const { getStudentFinancialHold } = await import("../lib/financialHold.js");
    const hold = await getStudentFinancialHold(student.id);
    return res.json(hold);
  }
);

/**
 * POST /payments/pay — student settles a PENDING/OVERDUE charge.
 * Body: { paymentId, paymentMethod? }
 */
paymentsRouter.post(
  "/payments/pay",
  requireRoles("STUDENT"),
  requirePermission(Permission.PAYMENTS_PAY),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      paymentId: z.string().min(1),
      paymentMethod: z.string().min(1).max(80).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "paymentId is required");
    }

    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    await syncOverdueStatuses({ studentId: student.id });

    const payment = await prisma.payment.findUnique({
      where: { id: parsed.data.paymentId },
    });
    if (!payment || payment.studentId !== student.id) {
      return sendError(res, 404, "NOT_FOUND", "Payment not found");
    }
    if (payment.status === "PAID") {
      return sendError(res, 409, "CONFLICT", "Payment is already settled");
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        receiptNumber: payment.receiptNumber ?? generateReceiptNumber(),
        paymentMethod:
          parsed.data.paymentMethod?.trim() ||
          payment.paymentMethod ||
          "Campus Gateway",
      },
    });

    return res.json({
      ...serializePayment(updated),
      statusLabel: "Paid" as const,
      message: "Payment recorded successfully",
    });
  }
);

/** GET /admin/finance/summary */
paymentsRouter.get(
  "/admin/finance/summary",
  requireRoles("ADMIN"),
  requirePermission(Permission.FINANCE_READ),
  async (_req, res) => {
    const summary = await buildAdminFinanceSummary();
    return res.json(summary);
  }
);

/** GET /admin/finance/transactions */
paymentsRouter.get(
  "/admin/finance/transactions",
  requireRoles("ADMIN"),
  requirePermission(Permission.FINANCE_READ),
  async (req, res) => {
    await syncOverdueStatuses();

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();

    const and: Prisma.PaymentWhereInput[] = [];
    if (status && ["PAID", "PENDING", "OVERDUE"].includes(status)) {
      and.push({ status: status as "PAID" | "PENDING" | "OVERDUE" });
    }
    if (q) {
      and.push({
        OR: [
          { receiptNumber: { contains: q } },
          { description: { contains: q } },
          { student: { fullName: { contains: q } } },
          { student: { studentCode: { contains: q } } },
        ],
      });
    }

    const where: Prisma.PaymentWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          student: {
            select: { id: true, studentCode: true, fullName: true },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((row) => {
        const serialized = serializePayment(row);
        return {
          ...serialized,
          statusLabel: uiPaymentStatus(serialized.status),
        };
      }),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/**
 * POST /admin/finance/record-payment
 * Manual cash/bank payment (PAID) or create a PENDING charge.
 */
paymentsRouter.post(
  "/admin/finance/record-payment",
  requireRoles("ADMIN"),
  requirePermission(Permission.FINANCE_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      studentId: z.string().min(1),
      amount: z.number().positive(),
      description: z.string().min(1).max(200),
      semester: z.string().max(40).optional().nullable(),
      paymentMethod: z.string().max(80).optional().nullable(),
      status: z.enum(["PAID", "PENDING"]).optional(),
      dueDate: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "studentId, amount, and description are required"
      );
    }

    const dueDate = parseOptionalDate(parsed.data.dueDate);
    if (parsed.data.dueDate && !dueDate) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid dueDate");
    }

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
      select: { id: true, studentCode: true, fullName: true },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student not found");
    }

    const admin = await resolveAdmin(req.user!.id);
    const status = parsed.data.status ?? "PAID";
    const now = new Date();

    const created = await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: parsed.data.amount,
        description: parsed.data.description.trim(),
        semester: parsed.data.semester?.trim() || null,
        paymentMethod:
          status === "PAID"
            ? parsed.data.paymentMethod?.trim() || "Cash Desk"
            : parsed.data.paymentMethod?.trim() || null,
        status,
        dueDate:
          dueDate ??
          (status === "PENDING"
            ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
            : null),
        paidAt: status === "PAID" ? now : null,
        receiptNumber: status === "PAID" ? generateReceiptNumber() : null,
        recordedById: admin?.id ?? null,
      },
      include: {
        student: {
          select: { id: true, studentCode: true, fullName: true },
        },
      },
    });

    return res.status(201).json({
      ...serializePayment(created),
      statusLabel: uiPaymentStatus(created.status),
    });
  }
);
