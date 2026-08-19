import { Router } from "express";
import { z } from "zod";

import { writeAudit } from "../lib/audit.js";
import {
  assertDepartmentScope,
  generateVerificationCode,
  scopedDepartmentId,
} from "../lib/departmentScope.js";
import { sendError } from "../lib/errors.js";
import { notifyCertificateIssued } from "../lib/notifications.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const certificatesRouter = Router();

function serializeCertificate(row: {
  id: string;
  verificationCode: string;
  studentId: string;
  studentName: string;
  degreeTitle: string;
  facultyName: string;
  programName: string;
  graduationDate: Date;
  issuedAt: Date;
  status: string;
  student?: { studentCode: string; departmentId: string | null } | null;
}) {
  return {
    id: row.id,
    verificationCode: row.verificationCode,
    studentId: row.studentId,
    studentCode: row.student?.studentCode ?? null,
    studentName: row.studentName,
    degreeTitle: row.degreeTitle,
    facultyName: row.facultyName,
    programName: row.programName,
    graduationDate: row.graduationDate.toISOString().slice(0, 10),
    issuedAt: row.issuedAt.toISOString(),
    status: row.status,
    verifyUrl: `/verify/certificate/${row.verificationCode}`,
  };
}

/** Public privacy-safe verification — no contact details or grades */
certificatesRouter.get("/public/certificates/verify/:code", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  if (!code || code.length < 8) {
    return sendError(res, 404, "NOT_FOUND", "Certificate not found");
  }

  const row = await prisma.certificate.findUnique({
    where: { verificationCode: code },
  });

  if (!row || row.status !== "VALID") {
    return sendError(res, 404, "NOT_FOUND", "Certificate not found");
  }

  return res.json({
    status: "VALID",
    studentName: row.studentName,
    degreeTitle: row.degreeTitle,
    facultyName: row.facultyName,
    programName: row.programName || null,
    graduationDate: row.graduationDate.toISOString().slice(0, 10),
    issuedAt: row.issuedAt.toISOString().slice(0, 10),
    verificationCode: row.verificationCode,
  });
});

certificatesRouter.use("/admin/certificates", requireAuth);

certificatesRouter.get(
  "/admin/certificates",
  requireRoles("ADMIN", "DEPARTMENT_ADMIN", "CERTIFICATE_ADMIN"),
  requirePermission(Permission.CERTIFICATES_READ),
  async (req: AuthedRequest, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const scope = scopedDepartmentId(req.user);

    const and: object[] = [];
    if (scope) {
      and.push({ student: { departmentId: scope } });
    }
    if (q) {
      and.push({
        OR: [
          { studentName: { contains: q } },
          { verificationCode: { contains: q.toUpperCase() } },
          { student: { studentCode: { contains: q } } },
          { degreeTitle: { contains: q } },
        ],
      });
    }

    const where = and.length > 0 ? { AND: and } : {};
    const [total, rows] = await Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where,
        include: {
          student: { select: { studentCode: true, departmentId: true } },
        },
        orderBy: { issuedAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeCertificate),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

certificatesRouter.post(
  "/admin/certificates",
  requireRoles("ADMIN", "DEPARTMENT_ADMIN", "CERTIFICATE_ADMIN"),
  requirePermission(Permission.CERTIFICATES_MANAGE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      studentId: z.string().min(1),
      degreeTitle: z.string().trim().min(2).max(200),
      facultyName: z.string().trim().min(2).max(200).optional(),
      programName: z.string().trim().max(200).optional().default(""),
      graduationDate: z.string().min(4),
      issuedAt: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid certificate payload");
    }

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
      include: {
        faculty: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student not found");
    }
    if (!assertDepartmentScope(req, res, student.departmentId)) {
      return;
    }

    const graduationDate = new Date(parsed.data.graduationDate);
    if (Number.isNaN(graduationDate.getTime())) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid graduation date");
    }
    const issuedAt = parsed.data.issuedAt
      ? new Date(parsed.data.issuedAt)
      : new Date();
    if (Number.isNaN(issuedAt.getTime())) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid issue date");
    }

    let verificationCode = generateVerificationCode(12);
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.certificate.findUnique({
        where: { verificationCode },
      });
      if (!clash) break;
      verificationCode = generateVerificationCode(12);
    }

    const created = await prisma.certificate.create({
      data: {
        verificationCode,
        studentId: student.id,
        studentName: student.fullName,
        degreeTitle: parsed.data.degreeTitle,
        facultyName:
          parsed.data.facultyName?.trim() ||
          student.faculty?.name ||
          student.department?.name ||
          "Dhapti University",
        programName:
          parsed.data.programName?.trim() || student.program || "",
        graduationDate,
        issuedAt,
        status: "VALID",
        issuedById: req.user!.id,
      },
      include: {
        student: {
          select: { studentCode: true, departmentId: true, userId: true },
        },
      },
    });

    await notifyCertificateIssued({
      certificateId: created.id,
      studentUserId: created.student.userId,
      degreeTitle: created.degreeTitle,
      verificationCode: created.verificationCode,
    }).catch(() => {});

    await writeAudit({
      actorId: req.user!.id,
      action: "CERTIFICATE_ISSUE",
      entityType: "Certificate",
      entityId: created.id,
      meta: {
        module: "Certificates",
        verificationCode: created.verificationCode,
        studentId: created.studentId,
      },
    });

    return res.status(201).json(serializeCertificate(created));
  }
);

certificatesRouter.post(
  "/admin/certificates/:id/revoke",
  requireRoles("ADMIN", "DEPARTMENT_ADMIN", "CERTIFICATE_ADMIN"),
  requirePermission(Permission.CERTIFICATES_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const existing = await prisma.certificate.findUnique({
      where: { id },
      include: { student: { select: { departmentId: true, studentCode: true } } },
    });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Certificate not found");
    }
    if (!assertDepartmentScope(req, res, existing.student.departmentId)) {
      return;
    }
    const updated = await prisma.certificate.update({
      where: { id },
      data: { status: "REVOKED" },
      include: {
        student: { select: { studentCode: true, departmentId: true } },
      },
    });
    return res.json(serializeCertificate(updated));
  }
);

