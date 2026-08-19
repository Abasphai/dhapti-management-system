import { Router } from "express";
import { z } from "zod";

import {
  evaluateExamClearance,
  generateAdmitVerificationCode,
  syncAdmitCardRecord,
} from "../lib/examClearance.js";
import { sendError } from "../lib/errors.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const examsRouter = Router();

const scheduleBody = z.object({
  examSessionId: z.string().min(1).optional(),
  title: z.string().min(2).max(200).optional(),
  semester: z.string().max(40).optional().nullable(),
  courseId: z.string().min(1),
  examDate: z.string().min(8),
  timeSlot: z.string().min(3).max(80),
  room: z.string().min(1).max(80),
  seatLabel: z.string().max(40).optional().nullable(),
  chiefInvigilator: z.string().max(120).optional().nullable(),
  sessionStatus: z
    .enum(["DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"])
    .optional(),
  publishSession: z.boolean().optional(),
});

const overrideBody = z.object({
  reason: z.string().min(3).max(500),
  status: z.enum(["CLEARED", "HELD"]).default("CLEARED"),
});

function paramId(raw: string | string[] | undefined): string {
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

async function resolveActiveExamSession() {
  const active = await prisma.examSession.findFirst({
    where: {
      OR: [
        { status: "ACTIVE", published: true },
        { status: "SCHEDULED", published: true },
      ],
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  if (active) return active;
  return prisma.examSession.findFirst({
    orderBy: { createdAt: "desc" },
  });
}

/** GET /api/student/admit-card — clearance + timetable for logged-in student */
examsRouter.get(
  "/student/admit-card",
  requireAuth,
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      include: {
        faculty: { select: { name: true, code: true } },
        department: { select: { name: true } },
      },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const session = await resolveActiveExamSession();
    if (!session) {
      return res.json({
        status: "HELD",
        message: "No exam session is currently scheduled.",
        examSession: null,
        clearance: null,
        student: null,
        timetable: [],
        admitCard: null,
      });
    }

    const evaluation = await evaluateExamClearance({
      studentId: student.id,
      examSessionId: session.id,
    });
    const card = await syncAdmitCardRecord({
      examSessionId: session.id,
      studentId: student.id,
      evaluation,
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { classSection: { select: { courseId: true } } },
    });
    const courseIds = [
      ...new Set(
        enrollments
          .map((e) => e.classSection?.courseId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const schedules = await prisma.examSchedule.findMany({
      where: {
        examSessionId: session.id,
        ...(courseIds.length ? { courseId: { in: courseIds } } : {}),
      },
      include: {
        course: { select: { code: true, title: true } },
      },
      orderBy: [{ examDate: "asc" }, { timeSlot: "asc" }],
    });

    const timetable = schedules.map((s, i) => ({
      id: s.id,
      courseCode: s.course.code,
      courseTitle: s.course.title,
      examDate: s.examDate.toISOString(),
      timeSlot: s.timeSlot,
      room: s.room,
      seat: s.seatLabel || `${s.room}-${String(i + 1).padStart(2, "0")}`,
      chiefInvigilator: s.chiefInvigilator,
    }));

    return res.json({
      status: evaluation.status,
      examSession: {
        id: session.id,
        title: session.title,
        semester: session.semester,
        status: session.status,
        published: session.published,
      },
      clearance: {
        attendancePercent: evaluation.attendancePercent,
        pendingDues: evaluation.pendingDues,
        hasOverdue: evaluation.hasOverdue,
        criteria: evaluation.criteria,
        blockers: evaluation.blockers,
        manualOverride: evaluation.manualOverride,
        overrideReason: evaluation.overrideReason,
      },
      student: {
        id: student.id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        rollNumber: student.studentCode,
        faculty: student.faculty?.name ?? null,
        facultyCode: student.faculty?.code ?? null,
        department: student.department?.name ?? null,
        semester: student.semester,
        program: student.program,
        profilePhoto: student.profilePhoto || "/images/profile-user.jpg",
      },
      timetable,
      admitCard:
        evaluation.status === "CLEARED"
          ? {
              id: card.id,
              verificationCode: card.verificationCode,
              generatedAt: card.generatedAt?.toISOString() ?? null,
              qrPayload: `DHAPTI-ADMIT:${card.verificationCode}`,
            }
          : null,
    });
  }
);

/** GET /api/admin/exams — list sessions + overview stats */
examsRouter.get(
  "/admin/exams",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.EXAMS_READ),
  async (_req: AuthedRequest, res) => {
    const sessions = await prisma.examSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { schedules: true, admitCards: true } },
        schedules: { select: { id: true } },
      },
    });

    const activeSession =
      sessions.find((s) => s.status === "ACTIVE" && s.published) ||
      sessions.find((s) => s.published) ||
      sessions[0] ||
      null;

    let cleared = 0;
    let held = 0;
    let totalCandidates = 0;

    if (activeSession) {
      const allStudents = await prisma.student.findMany({
        where: { user: { status: "ACTIVE" } },
        select: { id: true },
        take: 5000,
      });
      totalCandidates = allStudents.length;

      for (const st of allStudents) {
        const evaluation = await evaluateExamClearance({
          studentId: st.id,
          examSessionId: activeSession.id,
        });
        if (evaluation.status === "CLEARED") cleared += 1;
        else held += 1;
      }
    }

    const scheduledCount = await prisma.examSchedule.count({
      where: activeSession
        ? { examSessionId: activeSession.id }
        : undefined,
    });

    return res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        semester: s.semester,
        status: s.status,
        published: s.published,
        startDate: s.startDate?.toISOString() ?? null,
        endDate: s.endDate?.toISOString() ?? null,
        scheduleCount: s._count.schedules,
        admitCardCount: s._count.admitCards,
        createdAt: s.createdAt.toISOString(),
      })),
      overview: {
        activeExamsScheduled: scheduledCount,
        totalCandidates,
        clearedStudents: cleared,
        blockedStudents: held,
        clearedPercent:
          totalCandidates > 0
            ? Math.round((cleared / totalCandidates) * 1000) / 10
            : 0,
        blockedPercent:
          totalCandidates > 0
            ? Math.round((held / totalCandidates) * 1000) / 10
            : 0,
        activeSessionId: activeSession?.id ?? null,
      },
    });
  }
);

/** POST /api/admin/exams/schedule — create/update session + schedule row */
examsRouter.post(
  "/admin/exams/schedule",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.EXAMS_MANAGE),
  async (req: AuthedRequest, res) => {
    const parsed = scheduleBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid schedule payload", {
        issues: parsed.error.flatten(),
      });
    }
    const data = parsed.data;

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
    });
    if (!course) {
      return sendError(res, 404, "NOT_FOUND", "Course not found");
    }

    const examDate = new Date(data.examDate);
    if (Number.isNaN(examDate.getTime())) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid examDate");
    }

    let sessionId = data.examSessionId;
    if (!sessionId) {
      const session = await prisma.examSession.create({
        data: {
          title: data.title || `Exam Session ${new Date().getFullYear()}`,
          semester: data.semester ?? course.semester ?? null,
          status: data.sessionStatus ?? "SCHEDULED",
          published: data.publishSession ?? true,
          startDate: examDate,
          createdById: req.user!.id,
        },
      });
      sessionId = session.id;
    } else {
      const existing = await prisma.examSession.findUnique({
        where: { id: sessionId },
      });
      if (!existing) {
        return sendError(res, 404, "NOT_FOUND", "Exam session not found");
      }
      if (data.title || data.sessionStatus || data.publishSession != null) {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: {
            ...(data.title ? { title: data.title } : {}),
            ...(data.semester !== undefined
              ? { semester: data.semester }
              : {}),
            ...(data.sessionStatus ? { status: data.sessionStatus } : {}),
            ...(data.publishSession != null
              ? { published: data.publishSession }
              : {}),
          },
        });
      }
    }

    const schedule = await prisma.examSchedule.create({
      data: {
        examSessionId: sessionId,
        courseId: data.courseId,
        examDate,
        timeSlot: data.timeSlot,
        room: data.room,
        seatLabel: data.seatLabel ?? null,
        chiefInvigilator: data.chiefInvigilator ?? null,
      },
      include: {
        course: { select: { id: true, code: true, title: true } },
        examSession: true,
      },
    });

    return res.status(201).json({
      schedule: {
        id: schedule.id,
        examSessionId: schedule.examSessionId,
        courseId: schedule.courseId,
        courseCode: schedule.course.code,
        courseTitle: schedule.course.title,
        examDate: schedule.examDate.toISOString(),
        timeSlot: schedule.timeSlot,
        room: schedule.room,
        seatLabel: schedule.seatLabel,
        chiefInvigilator: schedule.chiefInvigilator,
      },
      examSession: {
        id: schedule.examSession.id,
        title: schedule.examSession.title,
        status: schedule.examSession.status,
        published: schedule.examSession.published,
      },
    });
  }
);

/** PATCH /api/admin/exams/schedule/:id — edit a schedule row */
examsRouter.patch(
  "/admin/exams/schedule/:id",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.EXAMS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const body = z
      .object({
        examDate: z.string().optional(),
        timeSlot: z.string().min(3).max(80).optional(),
        room: z.string().min(1).max(80).optional(),
        seatLabel: z.string().max(40).optional().nullable(),
        chiefInvigilator: z.string().max(120).optional().nullable(),
        courseId: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid update payload");
    }

    const existing = await prisma.examSchedule.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Schedule not found");
    }

    const examDate = body.data.examDate
      ? new Date(body.data.examDate)
      : undefined;
    if (examDate && Number.isNaN(examDate.getTime())) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid examDate");
    }

    const updated = await prisma.examSchedule.update({
      where: { id },
      data: {
        ...(examDate ? { examDate } : {}),
        ...(body.data.timeSlot ? { timeSlot: body.data.timeSlot } : {}),
        ...(body.data.room ? { room: body.data.room } : {}),
        ...(body.data.seatLabel !== undefined
          ? { seatLabel: body.data.seatLabel }
          : {}),
        ...(body.data.chiefInvigilator !== undefined
          ? { chiefInvigilator: body.data.chiefInvigilator }
          : {}),
        ...(body.data.courseId ? { courseId: body.data.courseId } : {}),
      },
      include: { course: { select: { code: true, title: true } } },
    });

    return res.json({
      schedule: {
        id: updated.id,
        courseCode: updated.course.code,
        courseTitle: updated.course.title,
        examDate: updated.examDate.toISOString(),
        timeSlot: updated.timeSlot,
        room: updated.room,
        seatLabel: updated.seatLabel,
        chiefInvigilator: updated.chiefInvigilator,
      },
    });
  }
);

/** GET /api/admin/exams/clearance-roster */
examsRouter.get(
  "/admin/exams/clearance-roster",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.EXAMS_READ, Permission.ADMITCARDS_GENERATE),
  async (req: AuthedRequest, res) => {
    const sessionId =
      typeof req.query.examSessionId === "string"
        ? req.query.examSessionId
        : (await resolveActiveExamSession())?.id;

    if (!sessionId) {
      return res.json({ examSessionId: null, rows: [] });
    }

    const students = await prisma.student.findMany({
      include: {
        faculty: { select: { name: true } },
        user: { select: { status: true } },
      },
      orderBy: { fullName: "asc" },
      take: 2000,
    });

    const rows = [];
    for (const st of students) {
      if (st.user.status !== "ACTIVE") continue;
      const evaluation = await evaluateExamClearance({
        studentId: st.id,
        examSessionId: sessionId,
      });
      const card = await syncAdmitCardRecord({
        examSessionId: sessionId,
        studentId: st.id,
        evaluation,
      });
      rows.push({
        id: card.id,
        studentId: st.id,
        fullName: st.fullName,
        studentCode: st.studentCode,
        faculty: st.faculty?.name ?? null,
        semester: st.semester,
        status: evaluation.status,
        attendancePercent: evaluation.attendancePercent,
        pendingDues: evaluation.pendingDues,
        manualOverride: evaluation.manualOverride,
        overrideReason: evaluation.overrideReason,
        blockers: evaluation.blockers,
      });
    }

    return res.json({ examSessionId: sessionId, rows });
  }
);

/** PATCH /api/admin/exams/clearance/:id/override */
examsRouter.patch(
  "/admin/exams/clearance/:id/override",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.ADMITCARDS_GENERATE, Permission.EXAMS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const parsed = overrideBody.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Override reason required");
    }

    const card = await prisma.examAdmitCard.findUnique({ where: { id } });
    if (!card) {
      return sendError(res, 404, "NOT_FOUND", "Clearance record not found");
    }

    const updated = await prisma.examAdmitCard.update({
      where: { id },
      data: {
        status: parsed.data.status,
        manualOverride: true,
        overrideReason: parsed.data.reason,
        overriddenById: req.user!.id,
        overriddenAt: new Date(),
        generatedAt:
          parsed.data.status === "CLEARED"
            ? card.generatedAt ?? new Date()
            : null,
        verificationCode:
          card.verificationCode || generateAdmitVerificationCode(),
      },
    });

    return res.json({
      id: updated.id,
      studentId: updated.studentId,
      status: updated.status,
      manualOverride: updated.manualOverride,
      overrideReason: updated.overrideReason,
      overriddenAt: updated.overriddenAt?.toISOString() ?? null,
    });
  }
);

/**
 * POST /api/admin/exams/results/publish
 * One-click: approve all PENDING_APPROVAL course results → official transcripts.
 */
examsRouter.post(
  "/admin/exams/results/publish",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.RESULTS_PUBLISH, Permission.RESULTS_VERIFY),
  async (req: AuthedRequest, res) => {
    const admin = await prisma.admin.findUnique({
      where: { userId: req.user!.id },
    });
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }

    const pending = await prisma.resultEntry.findMany({
      where: { status: "PENDING_APPROVAL" },
      select: { id: true },
    });

    if (pending.length === 0) {
      return res.json({ published: 0, message: "No pending results to publish" });
    }

    const now = new Date();
    await prisma.resultEntry.updateMany({
      where: { status: "PENDING_APPROVAL" },
      data: {
        status: "APPROVED",
        approvedAt: now,
        approvedById: admin.id,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      },
    });

    return res.json({
      published: pending.length,
      message: `Published ${pending.length} result(s) to official transcripts`,
    });
  }
);

/** GET /api/admin/exams/results/pending — verify gate list */
examsRouter.get(
  "/admin/exams/results/pending",
  requireAuth,
  requireRoles("ADMIN", "EXAM_ADMIN"),
  requirePermission(Permission.RESULTS_VERIFY, Permission.RESULTS_READ),
  async (_req: AuthedRequest, res) => {
    const rows = await prisma.resultEntry.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: {
        student: { select: { fullName: true, studentCode: true } },
        course: { select: { code: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    return res.json({
      rows: rows.map((r) => ({
        id: r.id,
        studentName: r.student.fullName,
        studentCode: r.student.studentCode,
        courseCode: r.course.code,
        courseTitle: r.course.title,
        marks: r.marks,
        letterGrade: r.letterGrade,
        status: r.status,
        submittedAt: r.submittedAt?.toISOString() ?? null,
      })),
    });
  }
);
