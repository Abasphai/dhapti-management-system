import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { hashPassword } from "../lib/auth.js";
import {
  assertDepartmentScope,
  resolveDepartmentFilter,
} from "../lib/departmentScope.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { serializeStudent } from "../lib/serializeAdmin.js";
import { semesterFilterVariants } from "../lib/semesters.js";
import {
  enrollmentInclude,
  serializeEnrollment,
} from "../lib/serializeEnrollment.js";
import {
  assignmentInclude,
  serializeAssignment,
} from "../lib/serializeAssignment.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const studentsRouter = Router();

studentsRouter.use(requireAuth);

const studentInclude = {
  user: { select: { status: true, email: true } },
  faculty: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, code: true } },
} as const;

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/** GET /students — paginated admin list */
studentsRouter.get(
  "/",
  requirePermission(Permission.STUDENTS_READ),
  async (req: AuthedRequest, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const semester = String(req.query.semester ?? "").trim();
    const faculty = String(req.query.faculty ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const requestedDept = String(req.query.departmentId ?? "").trim();

    const scoped = resolveDepartmentFilter(req, res, requestedDept);
    if (!scoped.ok) return;
    const departmentId = scoped.departmentId ?? "";

    const and: Prisma.StudentWhereInput[] = [];

    if (q) {
      and.push({
        OR: [
          { studentCode: { contains: q } },
          { fullName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      });
    }

    if (
      status &&
      ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"].includes(status)
    ) {
      and.push({
        user: {
          status: status as
            | "ACTIVE"
            | "INACTIVE"
            | "SUSPENDED"
            | "GRADUATED",
        },
      });
    }

    if (semester && semester !== "All Semesters") {
      const variants = semesterFilterVariants(semester);
      and.push(
        variants.length === 1
          ? { semester: variants[0] }
          : { OR: variants.map((s) => ({ semester: s })) }
      );
    }

    if (facultyId) {
      and.push({ facultyId });
    } else if (faculty && faculty !== "All Faculties") {
      and.push({
        OR: [
          { program: { contains: faculty } },
          { faculty: { name: { contains: faculty } } },
          { faculty: { code: { contains: faculty } } },
        ],
      });
    }

    if (departmentId) {
      and.push({ departmentId });
    }

    const where: Prisma.StudentWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: { studentCode: "asc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeStudent),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

studentsRouter.get(
  "/me",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      include: studentInclude,
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    return res.json(serializeStudent(student));
  }
);

/** Student self: enrollments for JWT student only */
studentsRouter.get(
  "/me/enrollments",
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
      orderBy: { enrolledAt: "desc" },
    });

    return res.json({ data: rows.map(serializeEnrollment) });
  }
);

/** Student self: PUBLISHED assignments for ACTIVE enrollments only */
studentsRouter.get(
  "/me/assignments",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();

    const activeEnrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { classSectionId: true },
    });
    const classSectionIds = activeEnrollments.map((e) => e.classSectionId);

    if (classSectionIds.length === 0) {
      return res.json({
        data: [],
        pagination: paginationMeta(0, page, pageSize),
      });
    }

    const and: Prisma.AssignmentWhereInput[] = [
      { classSectionId: { in: classSectionIds } },
      { status: "PUBLISHED" },
    ];
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { classSection: { section: { contains: q } } },
          { classSection: { course: { code: { contains: q } } } },
          { classSection: { course: { title: { contains: q } } } },
        ],
      });
    }

    const where: Prisma.AssignmentWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { dueAt: "asc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeAssignment),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

studentsRouter.patch(
  "/me",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      phone: z.string().optional(),
      address: z.string().optional(),
      profilePhoto: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid payload");
    }

    const student = await prisma.student.update({
      where: { userId: req.user!.id },
      data: parsed.data,
      include: studentInclude,
    });
    return res.json(serializeStudent(student));
  }
);

studentsRouter.get(
  "/:id",
  requirePermission(Permission.STUDENTS_READ),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const student = await prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
    if (!student) return sendError(res, 404, "NOT_FOUND", "Student not found");
    if (!assertDepartmentScope(req, res, student.departmentId)) return;
    return res.json(serializeStudent(student));
  }
);

/** Admin detail: profile + enrollments + attendance % + fee status */
studentsRouter.get(
  "/:id/overview",
  requirePermission(Permission.STUDENTS_READ),
  async (req: AuthedRequest, res) => {
    const { calcAttendancePercentage } = await import(
      "../lib/attendanceCalc.js"
    );
    const id = paramId(req.params.id);
    const student = await prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
    if (!student) return sendError(res, 404, "NOT_FOUND", "Student not found");
    if (!assertDepartmentScope(req, res, student.departmentId)) return;

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: id, status: { in: ["ACTIVE", "COMPLETED"] } },
      include: {
        classSection: {
          include: {
            course: { select: { code: true, title: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    const attendanceRows = await prisma.studentAttendance.findMany({
      where: { studentId: id },
      select: { status: true },
    });
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    for (const row of attendanceRows) {
      if (row.status === "PRESENT") present += 1;
      else if (row.status === "LATE") late += 1;
      else if (row.status === "EXCUSED") excused += 1;
      else absent += 1;
    }
    const attendancePercent = calcAttendancePercentage({
      present,
      late,
      absent,
      excused,
    });

    const payments = await prisma.payment.findMany({
      where: { studentId: id },
      select: { amount: true, status: true },
    });
    let totalPaid = 0;
    let currentDue = 0;
    for (const p of payments) {
      if (p.status === "PAID") totalPaid += p.amount;
      if (p.status === "PENDING" || p.status === "OVERDUE") {
        currentDue += p.amount;
      }
    }
    const feeStatus =
      currentDue > 0
        ? payments.some((p) => p.status === "OVERDUE")
          ? "Overdue"
          : "Pending dues"
        : totalPaid > 0
          ? "Cleared"
          : "No charges";

    return res.json({
      student: serializeStudent(student),
      enrolledCourses: enrollments.map((e) => ({
        enrollmentId: e.id,
        status: e.status,
        courseCode: e.classSection.course.code,
        courseTitle: e.classSection.course.title,
        section: e.classSection.section,
        academicYear: e.classSection.academicYear,
        semester: e.classSection.semester,
      })),
      attendancePercent,
      attendanceRecords: attendanceRows.length,
      fees: {
        totalPaid,
        currentDue,
        status: feeStatus,
        currency: "$",
      },
    });
  }
);

studentsRouter.post(
  "/",
  requirePermission(Permission.STUDENTS_CREATE),
  async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6).optional(),
      fullName: z.string().min(2),
      motherName: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      bloodGroup: z.string().optional(),
      facultyId: z.string().optional(),
      departmentId: z.string().optional(),
      semester: z.string().optional(),
      program: z.string().optional(),
      studentCode: z.string().min(3).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid student payload");
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();
    const password = data.password ?? "DHAPTI@2026";

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return sendError(res, 409, "CONFLICT", "Email already exists");
    }

    let studentCode = data.studentCode?.trim();
    if (studentCode) {
      const codeTaken = await prisma.student.findUnique({
        where: { studentCode },
      });
      if (codeTaken) {
        return sendError(res, 409, "CONFLICT", "Student ID already exists");
      }
    } else {
      const count = await prisma.student.count();
      studentCode = `DHAPTI-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    }

    try {
      const passwordHash = await hashPassword(password);
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: "STUDENT",
            status: "ACTIVE",
            student: {
              create: {
                studentCode: studentCode!,
                fullName: data.fullName,
                motherName: data.motherName,
                email,
                phone: data.phone,
                address: data.address,
                bloodGroup: data.bloodGroup,
                facultyId: data.facultyId,
                departmentId: data.departmentId,
                semester: data.semester,
                program: data.program,
              },
            },
          },
          include: { student: { include: studentInclude } },
        });
        return user.student!;
      });

      return res.status(201).json(serializeStudent(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "A student with this email or student ID already exists"
        );
      }
      throw err;
    }
  }
);

studentsRouter.patch(
  "/:id/status",
  requirePermission(Permission.STUDENTS_UPDATE),
  async (req, res) => {
    const statusParsed = z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"])
      .safeParse(req.body.status);
    if (!statusParsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid status");
    }
    const id = paramId(req.params.id);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return sendError(res, 404, "NOT_FOUND", "Student not found");

    await prisma.user.update({
      where: { id: student.userId },
      data: { status: statusParsed.data },
    });

    const updated = await prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
    return res.json(serializeStudent(updated!));
  }
);

studentsRouter.patch(
  "/:id",
  requirePermission(Permission.STUDENTS_UPDATE),
  async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2).optional(),
      motherName: z.string().nullable().optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      bloodGroup: z.string().nullable().optional(),
      facultyId: z.string().nullable().optional(),
      departmentId: z.string().nullable().optional(),
      semester: z.string().nullable().optional(),
      program: z.string().nullable().optional(),
      studentCode: z.string().min(3).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid payload");
    }

    const id = paramId(req.params.id);
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Student not found");

    const data = parsed.data;
    if (data.studentCode && data.studentCode !== existing.studentCode) {
      const taken = await prisma.student.findUnique({
        where: { studentCode: data.studentCode },
      });
      if (taken) {
        return sendError(res, 409, "CONFLICT", "Student ID already exists");
      }
    }

    if (data.email) {
      const email = data.email.toLowerCase();
      const emailTaken = await prisma.user.findFirst({
        where: { email, NOT: { id: existing.userId } },
      });
      if (emailTaken) {
        return sendError(res, 409, "CONFLICT", "Email already exists");
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (data.email) {
          await tx.user.update({
            where: { id: existing.userId },
            data: { email: data.email.toLowerCase() },
          });
        }
        return tx.student.update({
          where: { id },
          data: {
            fullName: data.fullName,
            motherName: data.motherName,
            email: data.email?.toLowerCase(),
            phone: data.phone,
            address: data.address,
            bloodGroup: data.bloodGroup,
            facultyId: data.facultyId,
            departmentId: data.departmentId,
            semester: data.semester,
            program: data.program,
            studentCode: data.studentCode,
          },
          include: studentInclude,
        });
      });
      return res.json(serializeStudent(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Duplicate email or student ID");
      }
      throw err;
    }
  }
);

/**
 * Soft-delete: deactivate account (INACTIVE). Academic records retained.
 * Hard delete is not supported for students with academic history.
 */
studentsRouter.delete(
  "/:id",
  requirePermission(Permission.STUDENTS_DELETE),
  async (req, res) => {
    const id = paramId(req.params.id);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return sendError(res, 404, "NOT_FOUND", "Student not found");

    await prisma.user.update({
      where: { id: student.userId },
      data: { status: "INACTIVE" },
    });

    const updated = await prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
    return res.json({
      ok: true,
      deactivated: true,
      student: serializeStudent(updated!),
    });
  }
);
