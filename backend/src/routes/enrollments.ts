import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  enrollmentInclude,
  serializeEnrollment,
} from "../lib/serializeEnrollment.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const enrollmentsRouter = Router();

enrollmentsRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const enrollmentStatusSchema = z.enum(["ACTIVE", "COMPLETED", "DROPPED"]);

async function validateEnrollmentActors(
  studentId: string,
  classSectionId: string
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { status: true } } },
  });
  if (!student) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Student not found",
    };
  }
  if (student.user.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE students can be enrolled",
    };
  }

  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    include: {
      course: { select: { id: true, status: true } },
    },
  });
  if (!classSection) {
    return {
      ok: false as const,
      status: 404 as const,
      code: "NOT_FOUND" as const,
      message: "Class section not found",
    };
  }
  if (classSection.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE class sections accept new enrollments",
    };
  }
  if (classSection.course.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 400 as const,
      code: "BAD_REQUEST" as const,
      message: "Only ACTIVE courses accept new enrollments",
    };
  }

  return { ok: true as const, student, classSection };
}

/** Student self: own enrollments only */
enrollmentsRouter.get(
  "/me",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const rows = await prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: enrollmentInclude,
      orderBy: [{ enrolledAt: "desc" }],
    });

    return res.json({ data: rows.map(serializeEnrollment) });
  }
);

enrollmentsRouter.get(
  "/",
  requirePermission(Permission.ENROLLMENTS_READ),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const studentId = String(req.query.studentId ?? "").trim();
    const classSectionId = String(req.query.classSectionId ?? "").trim();
    const courseId = String(req.query.courseId ?? "").trim();
    const teacherId = String(req.query.teacherId ?? "").trim();
    const departmentId = String(req.query.departmentId ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();

    const and: Prisma.EnrollmentWhereInput[] = [];

    if (q) {
      and.push({
        OR: [
          { student: { studentCode: { contains: q } } },
          { student: { fullName: { contains: q } } },
          { classSection: { section: { contains: q } } },
          { classSection: { course: { code: { contains: q } } } },
          { classSection: { course: { title: { contains: q } } } },
        ],
      });
    }

    if (status && ["ACTIVE", "COMPLETED", "DROPPED"].includes(status)) {
      and.push({
        status: status as "ACTIVE" | "COMPLETED" | "DROPPED",
      });
    }
    if (studentId) and.push({ studentId });
    if (classSectionId) and.push({ classSectionId });
    if (courseId) and.push({ classSection: { courseId } });
    if (teacherId) and.push({ classSection: { teacherId } });
    if (academicYear) and.push({ classSection: { academicYear } });
    if (semester) and.push({ classSection: { semester } });
    if (departmentId) {
      and.push({ classSection: { course: { departmentId } } });
    }
    if (facultyId) {
      and.push({
        classSection: {
          course: {
            OR: [{ facultyId }, { department: { facultyId } }],
          },
        },
      });
    }

    const where: Prisma.EnrollmentWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        include: enrollmentInclude,
        orderBy: { enrolledAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeEnrollment),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

enrollmentsRouter.get(
  "/:id",
  requirePermission(Permission.ENROLLMENTS_READ),
  async (req, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.enrollment.findUnique({
      where: { id },
      include: enrollmentInclude,
    });
    if (!row) return sendError(res, 404, "NOT_FOUND", "Enrollment not found");
    return res.json(serializeEnrollment(row));
  }
);

enrollmentsRouter.post(
  "/",
  requirePermission(Permission.ENROLLMENTS_CREATE),
  async (req, res) => {
    const schema = z.object({
      studentId: z.string().min(1),
      classSectionId: z.string().min(1),
      status: enrollmentStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid enrollment payload");
    }

    const { studentId, classSectionId } = parsed.data;
    const check = await validateEnrollmentActors(studentId, classSectionId);
    if (!check.ok) {
      return sendError(res, check.status, check.code, check.message);
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_classSectionId: { studentId, classSectionId },
      },
    });
    if (existing) {
      if (existing.status !== "ACTIVE" && (parsed.data.status ?? "ACTIVE") === "ACTIVE") {
        const recheck = await validateEnrollmentActors(studentId, classSectionId);
        if (!recheck.ok) {
          return sendError(res, recheck.status, recheck.code, recheck.message);
        }
        const reactivated = await prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: "ACTIVE" },
          include: enrollmentInclude,
        });
        return res.status(200).json(serializeEnrollment(reactivated));
      }
      return sendError(
        res,
        409,
        "CONFLICT",
        "Student is already enrolled in this class section"
      );
    }

    try {
      const created = await prisma.enrollment.create({
        data: {
          studentId,
          classSectionId,
          status: parsed.data.status ?? "ACTIVE",
        },
        include: enrollmentInclude,
      });
      return res.status(201).json(serializeEnrollment(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Student is already enrolled in this class section"
        );
      }
      throw err;
    }
  }
);

enrollmentsRouter.patch(
  "/:id/status",
  requirePermission(Permission.ENROLLMENTS_UPDATE),
  async (req, res) => {
    const statusParsed = enrollmentStatusSchema.safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid enrollment status");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.enrollment.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Enrollment not found");
    }

    if (statusParsed.data === "ACTIVE") {
      const check = await validateEnrollmentActors(
        existing.studentId,
        existing.classSectionId
      );
      if (!check.ok) {
        return sendError(res, check.status, check.code, check.message);
      }
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: { status: statusParsed.data },
      include: enrollmentInclude,
    });
    return res.json(serializeEnrollment(updated));
  }
);

/** Soft-drop → DROPPED. Historical row retained. */
enrollmentsRouter.delete(
  "/:id",
  requirePermission(Permission.ENROLLMENTS_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const existing = await prisma.enrollment.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Enrollment not found");
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: { status: "DROPPED" },
      include: enrollmentInclude,
    });

    return res.json({
      ok: true,
      deactivated: true,
      enrollment: serializeEnrollment(updated),
    });
  }
);
