import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import {
  getClassSectionWeights,
  setClassSectionWeights,
  validateWeightsForCalculation,
} from "../lib/assessmentWeights.js";
import {
  buildTranscript,
  isResultImmutable,
  resultInclude,
  upsertBiuGradedResult,
  upsertCalculatedResult,
} from "../lib/courseResults.js";
import { sendError } from "../lib/errors.js";
import { getStudentGpaSummary } from "../lib/gpa.js";
import { BIU_COMPONENT_CAPS } from "../lib/gradingPolicy.js";
import { isGradeScaleConfigured } from "../lib/gradingScale.js";
import { notifyCourseResultApproved } from "../lib/notifications.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeCourseResult } from "../lib/serializeCourseResult.js";
import { getSystemSettings } from "../lib/settings.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const courseResultsRouter = Router();

courseResultsRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveTeacher(userId: string) {
  return prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
}

async function resolveAdmin(userId: string) {
  return prisma.admin.findUnique({ where: { userId }, select: { id: true } });
}

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  });
}

const componentTypeSchema = z.enum([
  "ASSIGNMENT",
  "QUIZ",
  "EXAM",
  "MIDTERM",
  "FINAL_EXAM",
  "OTHER",
]);

/** GET /students/me/course-results — APPROVED course finals only */
courseResultsRouter.get(
  "/students/me/course-results",
  requireRoles("STUDENT"),
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    const { getStudentFinancialHold } = await import("../lib/financialHold.js");
    const hold = await getStudentFinancialHold(student.id);
    if (hold.active) {
      return sendError(
        res,
        403,
        "FINANCIAL_HOLD",
        hold.message ?? "Financial hold active"
      );
    }
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();

    const and: Prisma.ResultEntryWhereInput[] = [
      { studentId: student.id },
      { status: "APPROVED" },
    ];
    if (academicYear) {
      and.push({ classSection: { academicYear } });
    }
    if (semester) {
      and.push({ classSection: { semester } });
    }
    const where = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.resultEntry.count({ where }),
      prisma.resultEntry.findMany({
        where,
        include: resultInclude,
        orderBy: [
          { classSection: { academicYear: "desc" } },
          { classSection: { semester: "desc" } },
        ],
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((r) => serializeCourseResult(r)),
      pagination: paginationMeta(total, page, pageSize),
      gradeScaleConfigured: await isGradeScaleConfigured(),
    });
  }
);

/** GET /students/me/gpa */
courseResultsRouter.get(
  "/students/me/gpa",
  requireRoles("STUDENT"),
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    const { getStudentFinancialHold } = await import("../lib/financialHold.js");
    const hold = await getStudentFinancialHold(student.id);
    if (hold.active) {
      return sendError(
        res,
        403,
        "FINANCIAL_HOLD",
        hold.message ?? "Financial hold active"
      );
    }
    const summary = await getStudentGpaSummary(student.id);
    return res.json(summary);
  }
);

/** GET /students/me/transcript */
courseResultsRouter.get(
  "/students/me/transcript",
  requireRoles("STUDENT"),
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    const { getStudentFinancialHold } = await import("../lib/financialHold.js");
    const hold = await getStudentFinancialHold(student.id);
    if (hold.active) {
      return sendError(
        res,
        403,
        "FINANCIAL_HOLD",
        hold.message ?? "Financial hold active"
      );
    }
    const transcript = await buildTranscript(student.id);
    const gpa = await getStudentGpaSummary(student.id);

    return res.json({
      studentId: student.id,
      terms: transcript.terms.map((t) => ({
        academicYear: t.academicYear,
        semester: t.semester,
        credits: t.credits,
        courses: t.courses.map((c) => serializeCourseResult(c)),
        semesterGpa:
          gpa.semesters.find(
            (s) =>
              s.academicYear === t.academicYear && s.semester === t.semester
          )?.gpa ?? null,
      })),
      overall: {
        totalCredits: transcript.totalCredits,
        courseCount: transcript.courseCount,
        cumulativeGpa: gpa.cumulativeGpa,
        gpaStatus: gpa.status,
        gpaMessage: gpa.message,
      },
      gradeScaleConfigured: await isGradeScaleConfigured(),
    });
  }
);

/** Assessment weights */
courseResultsRouter.get(
  "/classes/:id/assessment-weights",
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const classSectionId = paramId(req.params.id);
    const section = await prisma.classSection.findUnique({
      where: { id: classSectionId },
    });
    if (!section) {
      return sendError(res, 404, "NOT_FOUND", "Class section not found");
    }
    if (req.user!.role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || section.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class section");
      }
    }
    const weights = await getClassSectionWeights(classSectionId);
    const validation = await validateWeightsForCalculation(classSectionId);
    return res.json({
      classSectionId,
      weights: weights.map((w) => ({
        componentType: w.componentType,
        weightPercent: w.weightPercent,
      })),
      configured: validation.ok,
      validation: validation.ok
        ? { ok: true }
        : { ok: false, code: validation.code, message: validation.message },
    });
  }
);

courseResultsRouter.put(
  "/classes/:id/assessment-weights",
  requirePermission(Permission.RESULTS_UPDATE),
  async (req: AuthedRequest, res) => {
    const classSectionId = paramId(req.params.id);
    const schema = z.object({
      weights: z
        .array(
          z.object({
            componentType: componentTypeSchema,
            weightPercent: z.number().positive().max(100),
          })
        )
        .max(10),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid weights payload");
    }

    const section = await prisma.classSection.findUnique({
      where: { id: classSectionId },
    });
    if (!section) {
      return sendError(res, 404, "NOT_FOUND", "Class section not found");
    }

    if (req.user!.role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || section.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class section");
      }
    } else if (req.user!.role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }

    try {
      const weights = await setClassSectionWeights(
        classSectionId,
        parsed.data.weights
      );
      return res.json({
        classSectionId,
        weights: weights.map((w) => ({
          componentType: w.componentType,
          weightPercent: w.weightPercent,
        })),
      });
    } catch (err) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        err instanceof Error ? err.message : "Invalid weights"
      );
    }
  }
);

/** Teacher: list own class course results */
courseResultsRouter.get(
  "/teachers/me/results",
  requireRoles("TEACHER"),
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const classSectionId = String(req.query.classSectionId ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();

    const and: Prisma.ResultEntryWhereInput[] = [{ teacherId: teacher.id }];
    if (classSectionId) and.push({ classSectionId });
    if (status) and.push({ status: status as Prisma.EnumResultStatusFilter["equals"] });

    const where = { AND: and };
    const [total, rows] = await Promise.all([
      prisma.resultEntry.count({ where }),
      prisma.resultEntry.findMany({
        where,
        include: resultInclude,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((r) => serializeCourseResult(r, { includeInternal: true })),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** POST /results/calculate — single enrollment */
courseResultsRouter.post(
  "/results/calculate",
  requirePermission(Permission.RESULTS_CREATE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({ enrollmentId: z.string().min(1) });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "enrollmentId required");
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher && req.user!.role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Teacher profile required");
    }

    let teacherId = teacher?.id;
    if (req.user!.role === "ADMIN" && !teacherId) {
      const enr = await prisma.enrollment.findUnique({
        where: { id: parsed.data.enrollmentId },
        include: { classSection: { select: { teacherId: true } } },
      });
      if (!enr) {
        return sendError(res, 404, "NOT_FOUND", "Enrollment not found");
      }
      teacherId = enr.classSection.teacherId;
    }

    const result = await upsertCalculatedResult({
      enrollmentId: parsed.data.enrollmentId,
      teacherId: teacherId!,
    });
    if (!result.ok) {
      const status =
        result.code === "FORBIDDEN"
          ? 403
          : result.code === "NOT_FOUND"
            ? 404
            : result.code === "CONFLICT"
              ? 409
              : 400;
      return sendError(
        res,
        status,
        result.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : result.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result.code === "CONFLICT"
              ? "CONFLICT"
              : "BAD_REQUEST",
        result.message
      );
    }

    return res.status(201).json({
      ...serializeCourseResult(result.result, { includeInternal: true }),
      gradeScaleConfigured: result.gradeScaleConfigured,
    });
  }
);

/**
 * POST /results/grade — official Dhapti component marks entry.
 * Validates caps, computes total + letter + gradePoint, stores ResultEntry.
 */
courseResultsRouter.post(
  "/results/grade",
  requirePermission(Permission.RESULTS_CREATE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      enrollmentId: z.string().min(1),
      midterm: z.number().finite(),
      finalExam: z.number().finite(),
      quiz: z.number().finite(),
      attendance: z.number().finite(),
      presentation: z.number().finite(),
      assignment: z.number().finite().optional(),
      assignmentScores: z.array(z.number().finite()).max(2).optional(),
      teacherNote: z.string().max(5000).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Invalid Dhapti grade payload. Required: enrollmentId, midterm, finalExam, quiz, attendance, presentation; optional assignment or assignmentScores."
      );
    }

    const teacher = await resolveTeacher(req.user!.id);
    if (!teacher && req.user!.role !== "ADMIN") {
      return sendError(res, 403, "FORBIDDEN", "Teacher profile required");
    }

    let teacherId = teacher?.id;
    if (req.user!.role === "ADMIN" && !teacherId) {
      const enr = await prisma.enrollment.findUnique({
        where: { id: parsed.data.enrollmentId },
        include: { classSection: { select: { teacherId: true } } },
      });
      if (!enr) {
        return sendError(res, 404, "NOT_FOUND", "Enrollment not found");
      }
      teacherId = enr.classSection.teacherId;
    }

    const result = await upsertBiuGradedResult({
      enrollmentId: parsed.data.enrollmentId,
      teacherId: teacherId!,
      components: {
        midterm: parsed.data.midterm,
        finalExam: parsed.data.finalExam,
        quiz: parsed.data.quiz,
        attendance: parsed.data.attendance,
        presentation: parsed.data.presentation,
        assignment: parsed.data.assignment,
        assignmentScores: parsed.data.assignmentScores,
      },
      teacherNote: parsed.data.teacherNote,
    });

    if (!result.ok) {
      const status =
        result.code === "FORBIDDEN"
          ? 403
          : result.code === "NOT_FOUND"
            ? 404
            : result.code === "CONFLICT"
              ? 409
              : 400;
      return sendError(res, status, result.code, result.message);
    }

    return res.status(201).json({
      ...serializeCourseResult(result.result, { includeInternal: true }),
      gradeScaleConfigured: true,
      biuPolicy: {
        caps: BIU_COMPONENT_CAPS,
        total: result.total,
        letterGrade: result.letterGrade,
        gradePoint: result.gradePoint,
        components: result.components,
      },
    });
  }
);

/**
 * POST /results/gradebook — batch upsert Dhapti component marks for a class sheet.
 */
courseResultsRouter.post(
  "/results/gradebook",
  requirePermission(Permission.RESULTS_CREATE),
  async (req: AuthedRequest, res) => {
    const entrySchema = z.object({
      enrollmentId: z.string().min(1),
      midterm: z.number().finite(),
      finalExam: z.number().finite(),
      quiz: z.number().finite(),
      attendance: z.number().finite(),
      presentation: z.number().finite(),
      assignment: z.number().finite().optional(),
    });
    const schema = z.object({
      classSectionId: z.string().min(1),
      entries: z.array(entrySchema).min(1).max(200),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid gradebook payload");
    }

    const teacher = await resolveTeacher(req.user!.id);
    const section = await prisma.classSection.findUnique({
      where: { id: parsed.data.classSectionId },
      select: { id: true, teacherId: true },
    });
    if (!section) {
      return sendError(res, 404, "NOT_FOUND", "Class section not found");
    }
    if (req.user!.role === "TEACHER") {
      if (!teacher || section.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class section");
      }
    }

    const teacherId = teacher?.id ?? section.teacherId;
    let saved = 0;
    const failures: Array<{ enrollmentId: string; message: string }> = [];
    const results = [];

    for (const entry of parsed.data.entries) {
      const enr = await prisma.enrollment.findUnique({
        where: { id: entry.enrollmentId },
        select: { id: true, classSectionId: true },
      });
      if (!enr || enr.classSectionId !== parsed.data.classSectionId) {
        failures.push({
          enrollmentId: entry.enrollmentId,
          message: "Enrollment not in this class section",
        });
        continue;
      }

      const result = await upsertBiuGradedResult({
        enrollmentId: entry.enrollmentId,
        teacherId,
        components: {
          midterm: entry.midterm,
          finalExam: entry.finalExam,
          quiz: entry.quiz,
          attendance: entry.attendance,
          presentation: entry.presentation,
          assignment: entry.assignment ?? 0,
        },
      });

      if (!result.ok) {
        failures.push({
          enrollmentId: entry.enrollmentId,
          message: result.message,
        });
        continue;
      }
      saved += 1;
      results.push(
        serializeCourseResult(result.result, { includeInternal: true })
      );
    }

    return res.json({
      saved,
      failed: failures.length,
      failures,
      data: results,
    });
  }
);

/**
 * POST /results/bulk-submit — submit all CALCULATED/RETURNED results in a class
 * for admin approval (PENDING_APPROVAL).
 */
courseResultsRouter.post(
  "/results/bulk-submit",
  requirePermission(Permission.RESULTS_SUBMIT),
  async (req: AuthedRequest, res) => {
    const schema = z.object({ classSectionId: z.string().min(1) });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "classSectionId required");
    }

    const teacher = await resolveTeacher(req.user!.id);
    const section = await prisma.classSection.findUnique({
      where: { id: parsed.data.classSectionId },
      select: { id: true, teacherId: true },
    });
    if (!section) {
      return sendError(res, 404, "NOT_FOUND", "Class section not found");
    }
    if (req.user!.role === "TEACHER") {
      if (!teacher || section.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class section");
      }
    }

    const rows = await prisma.resultEntry.findMany({
      where: {
        classSectionId: parsed.data.classSectionId,
        status: { in: ["CALCULATED", "RETURNED"] },
        marks: { not: null },
        ...(teacher ? { teacherId: teacher.id } : {}),
      },
    });

    if (rows.length === 0) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "No CALCULATED or RETURNED results ready to submit"
      );
    }

    const settings = await getSystemSettings();
    const now = new Date();
    const nextStatus = settings.requireAdminGradeApproval
      ? ("PENDING_APPROVAL" as const)
      : ("APPROVED" as const);

    await prisma.resultEntry.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        status: nextStatus,
        submittedAt: now,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      },
    });

    return res.json({
      submitted: rows.length,
      status: nextStatus,
      message:
        nextStatus === "PENDING_APPROVAL"
          ? "Marks submitted for admin approval"
          : "Marks approved automatically (admin approval not required)",
    });
  }
);

/** POST /results/bulk — calculate all ACTIVE enrollments in a class */
courseResultsRouter.post(
  "/results/bulk",
  requirePermission(Permission.RESULTS_CREATE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({ classSectionId: z.string().min(1) });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "classSectionId required");
    }

    const teacher = await resolveTeacher(req.user!.id);
    const section = await prisma.classSection.findUnique({
      where: { id: parsed.data.classSectionId },
    });
    if (!section) {
      return sendError(res, 404, "NOT_FOUND", "Class section not found");
    }
    if (req.user!.role === "TEACHER") {
      if (!teacher || section.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class section");
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classSectionId: parsed.data.classSectionId,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: { id: true },
    });

    const outcomes = [];
    for (const enr of enrollments) {
      const result = await upsertCalculatedResult({
        enrollmentId: enr.id,
        teacherId: section.teacherId,
      });
      if (result.ok) {
        outcomes.push({
          enrollmentId: enr.id,
          ok: true,
          result: serializeCourseResult(result.result, { includeInternal: true }),
        });
      } else {
        outcomes.push({
          enrollmentId: enr.id,
          ok: false,
          code: result.code,
          error: result.message,
        });
      }
    }

    return res.json({
      classSectionId: parsed.data.classSectionId,
      processed: outcomes.length,
      saved: outcomes.filter((o) => o.ok).length,
      failed: outcomes.filter((o) => !o.ok).length,
      results: outcomes,
    });
  }
);

/** GET /results — Admin list */
courseResultsRouter.get(
  "/results",
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    if (req.user!.role === "STUDENT") {
      return sendError(res, 403, "FORBIDDEN", "Use /students/me/course-results");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();
    const courseId = String(req.query.courseId ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const departmentId = String(req.query.departmentId ?? "").trim();
    const classSectionId = String(req.query.classSectionId ?? "").trim();

    const and: Prisma.ResultEntryWhereInput[] = [];

    if (req.user!.role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher) {
        return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
      }
      and.push({ teacherId: teacher.id });
    }

    if (status) and.push({ status: status as Prisma.EnumResultStatusFilter["equals"] });
    if (classSectionId) and.push({ classSectionId });
    if (courseId) and.push({ courseId });
    if (academicYear) and.push({ classSection: { academicYear } });
    if (semester) and.push({ classSection: { semester } });
    if (facultyId) {
      and.push({ classSection: { course: { facultyId } } });
    }
    if (departmentId) {
      and.push({ classSection: { course: { departmentId } } });
    }
    if (q) {
      and.push({
        OR: [
          { student: { fullName: { contains: q } } },
          { student: { studentCode: { contains: q } } },
          { course: { code: { contains: q } } },
          { course: { title: { contains: q } } },
        ],
      });
    }

    const where: Prisma.ResultEntryWhereInput = and.length ? { AND: and } : {};
    const [total, rows] = await Promise.all([
      prisma.resultEntry.count({ where }),
      prisma.resultEntry.findMany({
        where,
        include: resultInclude,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map((r) =>
        serializeCourseResult(r, { includeInternal: req.user!.role !== "STUDENT" })
      ),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

courseResultsRouter.get(
  "/results/:id",
  requirePermission(Permission.RESULTS_READ),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.resultEntry.findUnique({
      where: { id },
      include: resultInclude,
    });
    if (!row) return sendError(res, 404, "NOT_FOUND", "Result not found");

    if (req.user!.role === "STUDENT") {
      const student = await resolveStudent(req.user!.id);
      if (!student || row.studentId !== student.id || row.status !== "APPROVED") {
        return sendError(res, 404, "NOT_FOUND", "Result not found");
      }
      return res.json(serializeCourseResult(row));
    }
    if (req.user!.role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || row.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class result");
      }
    }

    return res.json(serializeCourseResult(row, { includeInternal: true }));
  }
);

courseResultsRouter.post(
  "/results/:id/submit",
  requirePermission(Permission.RESULTS_SUBMIT),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const row = await prisma.resultEntry.findUnique({ where: { id } });
    if (!row) return sendError(res, 404, "NOT_FOUND", "Result not found");

    if (req.user!.role === "TEACHER") {
      const teacher = await resolveTeacher(req.user!.id);
      if (!teacher || row.teacherId !== teacher.id) {
        return sendError(res, 403, "FORBIDDEN", "Not your class result");
      }
    }

    if (row.status !== "CALCULATED" && row.status !== "RETURNED") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only CALCULATED or RETURNED results can be submitted"
      );
    }
    if (row.marks == null) {
      return sendError(res, 400, "BAD_REQUEST", "Result has no calculated marks");
    }

    const settings = await getSystemSettings();
    const now = new Date();
    const updated = await prisma.resultEntry.update({
      where: { id },
      data: settings.requireAdminGradeApproval
        ? {
            status: "PENDING_APPROVAL",
            submittedAt: now,
            returnedAt: null,
            returnedById: null,
            returnReason: null,
          }
        : {
            status: "APPROVED",
            submittedAt: now,
            approvedAt: now,
            returnedAt: null,
            returnedById: null,
            returnReason: null,
          },
      include: resultInclude,
    });
    return res.json(serializeCourseResult(updated, { includeInternal: true }));
  }
);

courseResultsRouter.post(
  "/results/:id/approve",
  requirePermission(Permission.RESULTS_APPROVE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const admin = await resolveAdmin(req.user!.id);
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }

    const row = await prisma.resultEntry.findUnique({
      where: { id },
      include: {
        student: { select: { userId: true } },
        course: { select: { code: true, title: true } },
      },
    });
    if (!row) return sendError(res, 404, "NOT_FOUND", "Result not found");
    if (row.status !== "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only PENDING_APPROVAL results can be approved"
      );
    }

    const updated = await prisma.resultEntry.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: admin.id,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      },
      include: resultInclude,
    });

    await notifyCourseResultApproved({
      resultId: updated.id,
      studentUserId: row.student.userId,
      courseCode: row.course.code,
      courseTitle: row.course.title,
    }).catch((err) => console.error("notifyCourseResultApproved", err));

    return res.json(serializeCourseResult(updated, { includeInternal: true }));
  }
);

courseResultsRouter.post(
  "/results/:id/return",
  requirePermission(Permission.RESULTS_RETURN),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const admin = await resolveAdmin(req.user!.id);
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }
    const parsed = z
      .object({ reason: z.string().trim().max(2000).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid return payload");
    }

    const row = await prisma.resultEntry.findUnique({ where: { id } });
    if (!row) return sendError(res, 404, "NOT_FOUND", "Result not found");
    if (isResultImmutable(row.status)) {
      return sendError(res, 409, "CONFLICT", "Approved results are immutable");
    }
    if (row.status !== "PENDING_APPROVAL") {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Only PENDING_APPROVAL results can be returned"
      );
    }

    const updated = await prisma.resultEntry.update({
      where: { id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        returnedById: admin.id,
        returnReason: parsed.data.reason ?? null,
        approvedAt: null,
        approvedById: null,
      },
      include: resultInclude,
    });

    return res.json(serializeCourseResult(updated, { includeInternal: true }));
  }
);
