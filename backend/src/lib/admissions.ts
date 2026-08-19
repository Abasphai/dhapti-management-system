import type { AdmissionApplication, AdmissionStatus, Prisma } from "@prisma/client";

import { hashPassword } from "./auth.js";
import { prisma } from "./prisma.js";
import { getSystemSettings } from "./settings.js";

/**
 * Fallback Semester 1 tuition when settings/env are unavailable.
 */
export const DEFAULT_SEMESTER1_TUITION = Number(
  process.env.ADMISSION_TUITION_AMOUNT || 1200
);

export const DEFAULT_STUDENT_PASSWORD =
  process.env.ADMISSION_DEFAULT_PASSWORD || "DHAPTI@2026";

const applicationInclude = {
  faculty: { select: { id: true, name: true, code: true } },
  program: { select: { id: true, code: true, title: true } },
  student: {
    select: { id: true, studentCode: true, fullName: true, email: true },
  },
  decidedBy: { select: { id: true, fullName: true } },
} as const;

export type AdmissionWithRelations = Prisma.AdmissionApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

export { applicationInclude };

export function serializeAdmission(row: AdmissionWithRelations) {
  return {
    id: row.id,
    trackingCode: row.trackingCode,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    facultyId: row.facultyId,
    programId: row.programId,
    highSchoolGPA: row.highSchoolGPA,
    documentsUrl: row.documentsUrl,
    status: row.status,
    rejectionReason: row.rejectionReason,
    notes: row.notes,
    decisionDate: row.decisionDate?.toISOString() ?? null,
    decidedById: row.decidedById,
    studentId: row.studentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    faculty: row.faculty
      ? { id: row.faculty.id, name: row.faculty.name, code: row.faculty.code }
      : null,
    program: row.program
      ? {
          id: row.program.id,
          code: row.program.code,
          title: row.program.title,
        }
      : null,
    student: row.student
      ? {
          id: row.student.id,
          studentCode: row.student.studentCode,
          fullName: row.student.fullName,
          email: row.student.email,
        }
      : null,
    decidedBy: row.decidedBy
      ? { id: row.decidedBy.id, fullName: row.decidedBy.fullName }
      : null,
  };
}

export async function generateTrackingCode(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  const prefix = `APP-${year}-`;
  const latest = await tx.admissionApplication.findFirst({
    where: { trackingCode: { startsWith: prefix } },
    orderBy: { trackingCode: "desc" },
    select: { trackingCode: true },
  });
  let seq = 1;
  if (latest?.trackingCode) {
    const n = Number(latest.trackingCode.slice(prefix.length));
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function generateStudentRegistrationCode(
  tx: Prisma.TransactionClient
) {
  const year = new Date().getFullYear();
  const prefix = `DHAPTI-${year}-`;
  const latest = await tx.student.findFirst({
    where: { studentCode: { startsWith: prefix } },
    orderBy: { studentCode: "desc" },
    select: { studentCode: true },
  });
  let seq = 1;
  if (latest?.studentCode) {
    const n = Number(latest.studentCode.slice(prefix.length));
    if (Number.isFinite(n)) seq = n + 1;
  }
  // Collision-safe fallback when codes are non-numeric suffixes
  const candidate = `${prefix}${String(seq).padStart(3, "0")}`;
  const taken = await tx.student.findUnique({
    where: { studentCode: candidate },
  });
  if (!taken) return candidate;
  const count = await tx.student.count();
  return `${prefix}${String(count + 1).padStart(3, "0")}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export type ApproveResult = {
  application: AdmissionWithRelations;
  studentCode: string;
  paymentId: string;
  defaultPassword: string;
  studentUserId?: string;
  sendWelcome?: boolean;
};

/**
 * Atomic approve: User(STUDENT) + Student + PENDING Semester 1 tuition + APPROVED.
 */
export async function approveAdmissionApplication(opts: {
  applicationId: string;
  adminUserId: string;
  tuitionAmount?: number;
}): Promise<ApproveResult> {
  const settings = await getSystemSettings();
  const amount = opts.tuitionAmount ?? settings.defaultTuitionFee;
  const passwordHash = await hashPassword(DEFAULT_STUDENT_PASSWORD);
  const graceMs = settings.paymentGracePeriodDays * 24 * 60 * 60 * 1000;

  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.admissionApplication.findUnique({
      where: { id: opts.applicationId },
    });
    if (!app) {
      const err = new Error("NOT_FOUND");
      throw err;
    }
    if (app.status === "APPROVED" || app.status === "REJECTED") {
      const err = new Error("ALREADY_DECIDED");
      throw err;
    }

    const email = app.email.toLowerCase();
    const existingUser = await tx.user.findUnique({ where: { email } });
    if (existingUser) {
      const err = new Error("EMAIL_EXISTS");
      throw err;
    }

    const admin = await tx.admin.findUnique({
      where: { userId: opts.adminUserId },
      select: { id: true },
    });

    let programTitle: string | null = null;
    if (app.programId) {
      const course = await tx.course.findUnique({
        where: { id: app.programId },
        select: { title: true },
      });
      programTitle = course?.title ?? null;
    }

    const studentCode = await generateStudentRegistrationCode(tx);
    const year = new Date().getFullYear();
    const now = new Date();

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: "STUDENT",
        status: "ACTIVE",
        student: {
          create: {
            studentCode,
            fullName: app.fullName,
            email,
            phone: app.phone,
            facultyId: app.facultyId,
            program: programTitle,
            semester: "Semester 1",
            batch: String(year),
          },
        },
      },
      include: { student: true },
    });

    const student = user.student!;
    const dueDate = new Date(now.getTime() + graceMs);

    if (settings.admissionApplicationFee > 0) {
      await tx.payment.create({
        data: {
          studentId: student.id,
          amount: settings.admissionApplicationFee,
          description: `Admission Application Fee (${settings.paymentCurrency})`,
          semester: "Semester 1",
          status: "PENDING",
          dueDate: now,
          recordedById: admin?.id ?? null,
        },
      });
    }

    const payment = await tx.payment.create({
      data: {
        studentId: student.id,
        amount,
        description: `Semester 1 Tuition Fee (${settings.paymentCurrency})`,
        semester: "Semester 1",
        status: "PENDING",
        dueDate,
        recordedById: admin?.id ?? null,
      },
    });

    const updated = await tx.admissionApplication.update({
      where: { id: app.id },
      data: {
        status: "APPROVED",
        decisionDate: now,
        decidedById: admin?.id ?? null,
        studentId: student.id,
        rejectionReason: null,
      },
      include: applicationInclude,
    });

    return {
      application: updated,
      studentCode,
      paymentId: payment.id,
      defaultPassword: DEFAULT_STUDENT_PASSWORD,
      studentUserId: user.id,
      sendWelcome: settings.sendStudentWelcomeEmail,
    };
  });

  if (result.sendWelcome && result.studentUserId) {
    const { notifyStudentWelcome } = await import("./notifications.js");
    await notifyStudentWelcome({
      userId: result.studentUserId,
      fullName: result.application.fullName,
      studentCode: result.studentCode,
      defaultPassword: result.defaultPassword,
    }).catch((err) => console.error("notifyStudentWelcome", err));
  }

  return {
    application: result.application,
    studentCode: result.studentCode,
    paymentId: result.paymentId,
    defaultPassword: result.defaultPassword,
  };
}

export async function rejectAdmissionApplication(opts: {
  applicationId: string;
  adminUserId: string;
  reason: string;
}): Promise<AdmissionWithRelations> {
  return prisma.$transaction(async (tx) => {
    const app = await tx.admissionApplication.findUnique({
      where: { id: opts.applicationId },
    });
    if (!app) {
      throw new Error("NOT_FOUND");
    }
    if (app.status === "APPROVED" || app.status === "REJECTED") {
      throw new Error("ALREADY_DECIDED");
    }

    const admin = await tx.admin.findUnique({
      where: { userId: opts.adminUserId },
      select: { id: true },
    });

    return tx.admissionApplication.update({
      where: { id: app.id },
      data: {
        status: "REJECTED",
        rejectionReason: opts.reason,
        decisionDate: new Date(),
        decidedById: admin?.id ?? null,
      },
      include: applicationInclude,
    });
  });
}

export function isOpenStatus(status: AdmissionStatus) {
  return (
    status === "PENDING" ||
    status === "UNDER_REVIEW" ||
    status === "INTERVIEW_SCHEDULED"
  );
}

export type { AdmissionApplication };
