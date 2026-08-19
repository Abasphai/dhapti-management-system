import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import {
  applicationInclude,
  approveAdmissionApplication,
  generateTrackingCode,
  rejectAdmissionApplication,
  serializeAdmission,
} from "../lib/admissions.js";
import {
  BIU_FACULTY_CATALOG,
  BIU_PROGRAM_CATALOG,
} from "../lib/admissionsCatalog.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { isAdmissionsOpen } from "../lib/settings.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const admissionsRouter = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * GET /admissions/options — public faculty/program list for Apply form.
 * Merges DB rows with Dhapti catalog so the form never renders empty.
 */
admissionsRouter.get("/admissions/options", async (_req, res) => {
  const [faculties, programs] = await Promise.all([
    prisma.faculty.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        code: true,
        title: true,
        facultyId: true,
        faculty: { select: { id: true, name: true, code: true } },
      },
      orderBy: { code: "asc" },
      take: 200,
    }),
  ]);

  const facultyByCode = new Map(
    faculties.map((f) => [f.code.toUpperCase(), f] as const)
  );
  const mergedFaculties = [...faculties];
  for (const fb of BIU_FACULTY_CATALOG) {
    if (!facultyByCode.has(fb.code.toUpperCase())) {
      mergedFaculties.push({
        id: `fallback:${fb.code}`,
        name: fb.name,
        code: fb.code,
      });
    }
  }

  const codeToFacultyId = new Map(
    mergedFaculties.map((f) => [f.code.toUpperCase(), f.id] as const)
  );
  const seenProgramKeys = new Set(
    programs.map(
      (p) =>
        `${p.facultyId ?? ""}::${p.title.trim().toLowerCase()}`
    )
  );
  const mergedPrograms = programs.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    facultyId: p.facultyId,
    facultyCode: p.faculty?.code ?? null,
    facultyName: p.faculty?.name ?? null,
  }));

  for (const prog of BIU_PROGRAM_CATALOG) {
    const facultyId = codeToFacultyId.get(prog.facultyCode.toUpperCase()) ?? null;
    const key = `${facultyId ?? ""}::${prog.title.trim().toLowerCase()}`;
    if (seenProgramKeys.has(key)) continue;
    seenProgramKeys.add(key);
    mergedPrograms.push({
      id: `fallback:prog:${prog.code}`,
      code: prog.code,
      title: prog.title,
      facultyId,
      facultyCode: prog.facultyCode,
      facultyName:
        mergedFaculties.find((f) => f.code === prog.facultyCode)?.name ?? null,
    });
  }

  return res.json({
    faculties: mergedFaculties.sort((a, b) => a.name.localeCompare(b.name)),
    programs: mergedPrograms,
  });
});

async function resolveFacultyForApply(opts: {
  facultyId?: string | null;
  facultyCode?: string | null;
}) {
  const rawId = opts.facultyId?.trim() || "";
  const codeFromFallback = rawId.startsWith("fallback:")
    ? rawId.slice("fallback:".length)
    : "";
  const code = (opts.facultyCode || codeFromFallback || "").trim().toUpperCase();

  if (rawId && !rawId.startsWith("fallback:")) {
    const byId = await prisma.faculty.findFirst({
      where: { id: rawId, status: "ACTIVE" },
      select: { id: true, code: true, name: true },
    });
    if (byId) return byId;
  }

  if (code) {
    const byCode = await prisma.faculty.findFirst({
      where: { code: { equals: code }, status: "ACTIVE" },
      select: { id: true, code: true, name: true },
    });
    if (byCode) return byCode;

    const meta = BIU_FACULTY_CATALOG.find(
      (f) => f.code.toUpperCase() === code
    );
    if (meta) {
      return prisma.faculty.create({
        data: {
          code: meta.code,
          name: meta.name,
          status: "ACTIVE",
          description: "Created from online admissions catalog",
        },
        select: { id: true, code: true, name: true },
      });
    }
  }

  return null;
}

/**
 * POST /admissions/apply — public online application (status PENDING).
 */
admissionsRouter.post("/admissions/apply", async (req, res) => {
  const open = await isAdmissionsOpen();
  if (!open) {
    return sendError(
      res,
      403,
      "FORBIDDEN",
      "Online admissions are currently closed"
    );
  }

  const schema = z
    .object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(160),
      phone: z.string().trim().min(5).max(40).optional().nullable(),
      facultyId: z.string().min(1).optional().nullable(),
      facultyCode: z.string().trim().min(2).max(40).optional().nullable(),
      programId: z.string().min(1).optional().nullable(),
      programTitle: z.string().trim().min(2).max(160).optional().nullable(),
      highSchoolGPA: z.number().min(0).max(100).optional().nullable(),
      documentsUrl: z.string().url().max(500).optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    })
    .refine((v) => Boolean(v.facultyId || v.facultyCode), {
      message: "facultyId or facultyCode is required",
    });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendError(
      res,
      400,
      "BAD_REQUEST",
      "Invalid application payload. Required: fullName, email, faculty"
    );
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const faculty = await resolveFacultyForApply({
    facultyId: data.facultyId,
    facultyCode: data.facultyCode,
  });
  if (!faculty) {
    return sendError(res, 400, "BAD_REQUEST", "Invalid or inactive faculty");
  }

  let programId: string | null = null;
  if (data.programId && !data.programId.startsWith("fallback:")) {
    const program = await prisma.course.findFirst({
      where: { id: data.programId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!program) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid or inactive program");
    }
    programId = program.id;
  }

  const programTitle =
    data.programTitle?.trim() ||
    (data.programId?.startsWith("fallback:prog:")
      ? BIU_PROGRAM_CATALOG.find(
          (p) => `fallback:prog:${p.code}` === data.programId
        )?.title
      : null) ||
    null;

  const noteParts = [data.notes?.trim()].filter(Boolean) as string[];
  if (programTitle && !programId) {
    noteParts.push(`Intended program: ${programTitle}`);
  }
  const notes = noteParts.length ? noteParts.join("\n") : null;

  const openDuplicate = await prisma.admissionApplication.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "UNDER_REVIEW", "INTERVIEW_SCHEDULED"] },
    },
    select: { id: true, trackingCode: true },
  });
  if (openDuplicate) {
    return sendError(
      res,
      409,
      "CONFLICT",
      `An open application already exists (${openDuplicate.trackingCode})`
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const trackingCode = await generateTrackingCode(tx);
      return tx.admissionApplication.create({
        data: {
          trackingCode,
          fullName: data.fullName,
          email,
          phone: data.phone?.trim() || null,
          facultyId: faculty.id,
          programId,
          highSchoolGPA: data.highSchoolGPA ?? null,
          documentsUrl: data.documentsUrl || null,
          notes,
          status: "PENDING",
        },
        include: applicationInclude,
      });
    });

    return res.status(201).json({
      message: "Application Submitted Successfully!",
      trackingId: created.trackingCode,
      application: serializeAdmission(created),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Could not create application; please retry"
      );
    }
    throw err;
  }
});

/**
 * GET /admin/admissions — admin queue with filters.
 */
admissionsRouter.get(
  "/admin/admissions",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ADMISSIONS_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.search ?? req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const facultyId = String(req.query.facultyId ?? "").trim();

    const and: Prisma.AdmissionApplicationWhereInput[] = [];

    if (
      status &&
      [
        "PENDING",
        "UNDER_REVIEW",
        "INTERVIEW_SCHEDULED",
        "APPROVED",
        "REJECTED",
      ].includes(status)
    ) {
      and.push({
        status: status as
          | "PENDING"
          | "UNDER_REVIEW"
          | "INTERVIEW_SCHEDULED"
          | "APPROVED"
          | "REJECTED",
      });
    }

    if (facultyId) {
      and.push({ facultyId });
    }

    if (q) {
      and.push({
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { trackingCode: { contains: q } },
        ],
      });
    }

    const where: Prisma.AdmissionApplicationWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [total, rows, statusGroups] = await Promise.all([
      prisma.admissionApplication.count({ where }),
      prisma.admissionApplication.findMany({
        where,
        include: applicationInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.admissionApplication.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const counts = {
      PENDING: 0,
      UNDER_REVIEW: 0,
      INTERVIEW_SCHEDULED: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const g of statusGroups) {
      counts[g.status] = g._count._all;
    }

    return res.json({
      data: rows.map(serializeAdmission),
      counts,
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/**
 * GET /admin/admissions/:id — detailed applicant view.
 */
admissionsRouter.get(
  "/admin/admissions/:id",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ADMISSIONS_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.admissionApplication.findUnique({
      where: { id },
      include: applicationInclude,
    });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Application not found");
    }
    return res.json(serializeAdmission(row));
  }
);

/**
 * POST /admin/admissions/:id/approve — atomic enroll + tuition charge.
 */
admissionsRouter.post(
  "/admin/admissions/:id/approve",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ADMISSIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);

    try {
      const result = await approveAdmissionApplication({
        applicationId: id,
        adminUserId: req.user!.id,
      });

      return res.json({
        message: "Application approved and student enrolled",
        application: serializeAdmission(result.application),
        studentCode: result.studentCode,
        paymentId: result.paymentId,
        defaultPassword: result.defaultPassword,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Application not found");
      }
      if (code === "ALREADY_DECIDED") {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Application already decided"
        );
      }
      if (code === "EMAIL_EXISTS") {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A user account with this email already exists"
        );
      }
      throw err;
    }
  }
);

/**
 * POST /admin/admissions/:id/reject — reject with reason.
 */
admissionsRouter.post(
  "/admin/admissions/:id/reject",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ADMISSIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const schema = z.object({
      reason: z.string().trim().min(3).max(500),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "rejection reason is required (min 3 characters)"
      );
    }

    try {
      const updated = await rejectAdmissionApplication({
        applicationId: id,
        adminUserId: req.user!.id,
        reason: parsed.data.reason,
      });
      return res.json({
        message: "Application rejected",
        application: serializeAdmission(updated),
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "NOT_FOUND") {
        return sendError(res, 404, "NOT_FOUND", "Application not found");
      }
      if (code === "ALREADY_DECIDED") {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Application already decided"
        );
      }
      throw err;
    }
  }
);

/**
 * POST /admin/admissions/:id/interview — mark INTERVIEW_SCHEDULED (queue UI).
 */
admissionsRouter.post(
  "/admin/admissions/:id/interview",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.ADMISSIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.admissionApplication.findUnique({
      where: { id },
    });
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Application not found");
    }
    if (row.status === "APPROVED" || row.status === "REJECTED") {
      return sendError(res, 409, "CONFLICT", "Application already decided");
    }

    const admin = await prisma.admin.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });

    const updated = await prisma.admissionApplication.update({
      where: { id },
      data: {
        status: "INTERVIEW_SCHEDULED",
        decidedById: admin?.id ?? null,
      },
      include: applicationInclude,
    });

    return res.json(serializeAdmission(updated));
  }
);
