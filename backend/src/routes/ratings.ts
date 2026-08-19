import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  currentSemesterEvaluationBlockedMessage,
  isSameSemester,
  normalizeSemesterLabel,
  semesterWindow,
} from "../lib/semesters.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const ratingsRouter = Router();

const starSchema = z.number().int().min(1).max(5);

const createRatingSchema = z.object({
  teacherId: z.string().min(1),
  courseId: z.string().min(1),
  semester: z.string().trim().min(1).max(40),
  academicYear: z.string().trim().min(2).max(40),
  overallRating: starSchema,
  teachingQuality: starSchema,
  punctuality: starSchema,
  engagement: starSchema,
  comments: z.string().trim().max(2000).optional().nullable(),
});

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function serializeRating(row: {
  id: string;
  teacherId: string;
  studentId: string;
  courseId: string;
  semester: string;
  academicYear: string;
  overallRating: number;
  teachingQuality: number;
  punctuality: number;
  engagement: number;
  comments: string | null;
  createdAt: Date;
  course?: { code: string; title: string } | null;
}) {
  return {
    id: row.id,
    teacherId: row.teacherId,
    studentId: row.studentId,
    courseId: row.courseId,
    courseCode: row.course?.code ?? null,
    courseTitle: row.course?.title ?? null,
    semester: row.semester,
    academicYear: row.academicYear,
    overallRating: row.overallRating,
    teachingQuality: row.teachingQuality,
    punctuality: row.punctuality,
    engagement: row.engagement,
    comments: row.comments,
    createdAt: row.createdAt.toISOString(),
  };
}

/** GET /ratings/eligible — courses a student may evaluate (current semester only). */
ratingsRouter.get(
  "/ratings/eligible",
  requireAuth,
  requireRoles("STUDENT"),
  requirePermission(Permission.RATINGS_READ),
  async (req: AuthedRequest, res) => {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, semester: true },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const currentSemester =
      normalizeSemesterLabel(student.semester) || "Semester 1";

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      include: {
        classSection: {
          select: {
            id: true,
            section: true,
            semester: true,
            academicYear: true,
            status: true,
            teacherId: true,
            teacher: {
              select: {
                id: true,
                fullName: true,
                facultyCode: true,
                designation: true,
              },
            },
            course: {
              select: { id: true, code: true, title: true, semester: true },
            },
          },
        },
      },
      orderBy: [{ enrolledAt: "desc" }],
    });

    const existing = await prisma.teacherRating.findMany({
      where: { studentId: student.id },
      select: {
        teacherId: true,
        courseId: true,
        semester: true,
        academicYear: true,
        id: true,
      },
    });
    const ratedKeys = new Set(
      existing.map(
        (r) =>
          `${r.teacherId}|${r.courseId}|${r.semester}|${r.academicYear}`
      )
    );

    const data = enrollments
      .filter((e) => e.classSection.teacherId && e.classSection.teacher)
      .map((e) => {
        const cs = e.classSection;
        const courseSemester = cs.semester || cs.course.semester || "";
        const key = `${cs.teacherId}|${cs.course.id}|${cs.semester}|${cs.academicYear}`;
        const alreadyRated = ratedKeys.has(key);
        const window = semesterWindow(courseSemester, currentSemester);
        const isCurrentSemester = window === "current";
        const canEvaluate = isCurrentSemester && !alreadyRated;
        return {
          enrollmentId: e.id,
          enrollmentStatus: e.status,
          classSectionId: cs.id,
          section: cs.section,
          semester: cs.semester,
          academicYear: cs.academicYear,
          courseId: cs.course.id,
          courseCode: cs.course.code,
          courseTitle: cs.course.title,
          teacherId: cs.teacher!.id,
          teacherName: cs.teacher!.fullName,
          teacherCode: cs.teacher!.facultyCode,
          designation: cs.teacher!.designation,
          alreadyRated,
          isCurrentSemester,
          semesterWindow: window,
          canEvaluate,
          evaluationLabel: alreadyRated
            ? "submitted"
            : window === "current"
              ? "open"
              : window === "past"
                ? "closed"
                : window === "future"
                  ? "not_reached"
                  : "closed",
        };
      });

    return res.json({
      currentSemester,
      data,
    });
  }
);

/** POST /ratings — student submits lecturer evaluation */
ratingsRouter.post(
  "/ratings",
  requireAuth,
  requireRoles("STUDENT"),
  requirePermission(Permission.RATINGS_CREATE),
  async (req: AuthedRequest, res) => {
    const parsed = createRatingSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid rating payload");
    }

    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, semester: true },
    });
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const data = parsed.data;
    const currentSemester =
      normalizeSemesterLabel(student.semester) || "Semester 1";

    // Strict policy: only the student's current active semester may be evaluated.
    if (
      !isSameSemester(data.semester, currentSemester)
    ) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        currentSemesterEvaluationBlockedMessage(currentSemester)
      );
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        status: { in: ["ACTIVE", "COMPLETED"] },
        classSection: {
          teacherId: data.teacherId,
          courseId: data.courseId,
          semester: data.semester,
          academicYear: data.academicYear,
        },
      },
      select: {
        id: true,
        classSection: {
          select: {
            semester: true,
            course: { select: { semester: true } },
          },
        },
      },
    });
    if (!enrollment) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You can only evaluate lecturers for courses you are enrolled in"
      );
    }

    const courseSemester =
      enrollment.classSection.semester ||
      enrollment.classSection.course.semester ||
      data.semester;
    if (!isSameSemester(courseSemester, currentSemester)) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        currentSemesterEvaluationBlockedMessage(currentSemester)
      );
    }

    const existing = await prisma.teacherRating.findUnique({
      where: {
        studentId_teacherId_courseId_semester_academicYear: {
          studentId: student.id,
          teacherId: data.teacherId,
          courseId: data.courseId,
          semester: currentSemester,
          academicYear: data.academicYear,
        },
      },
    });
    if (existing) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "You have already evaluated this lecturer for this course term"
      );
    }

    const created = await prisma.teacherRating.create({
      data: {
        studentId: student.id,
        teacherId: data.teacherId,
        courseId: data.courseId,
        semester: currentSemester,
        academicYear: data.academicYear,
        overallRating: data.overallRating,
        teachingQuality: data.teachingQuality,
        punctuality: data.punctuality,
        engagement: data.engagement,
        comments: data.comments?.trim() || null,
      },
      include: {
        course: { select: { code: true, title: true } },
      },
    });

    return res.status(201).json(serializeRating(created));
  }
);

/** GET /teachers/me/performance — anonymous averages + comments */
ratingsRouter.get(
  "/teachers/me/performance",
  requireAuth,
  requireRoles("TEACHER"),
  requirePermission(Permission.RATINGS_READ),
  async (req: AuthedRequest, res) => {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, fullName: true },
    });
    if (!teacher) {
      return sendError(res, 404, "NOT_FOUND", "Teacher profile not found");
    }

    const ratings = await prisma.teacherRating.findMany({
      where: { teacherId: teacher.id },
      include: {
        course: { select: { code: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalReviews = ratings.length;
    const avg = (key: "overallRating" | "teachingQuality" | "punctuality" | "engagement") =>
      totalReviews === 0
        ? null
        : round1(
            ratings.reduce((s, r) => s + r[key], 0) / totalReviews
          );

    return res.json({
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      totalReviews,
      averageOverall: avg("overallRating"),
      averageTeachingQuality: avg("teachingQuality"),
      averagePunctuality: avg("punctuality"),
      averageEngagement: avg("engagement"),
      feedback: ratings
        .filter((r) => r.comments && r.comments.trim())
        .map((r) => ({
          id: r.id,
          courseCode: r.course.code,
          courseTitle: r.course.title,
          semester: r.semester,
          academicYear: r.academicYear,
          overallRating: r.overallRating,
          comments: r.comments,
          createdAt: r.createdAt.toISOString(),
        })),
    });
  }
);

/** GET /admin/ratings/report — ranked teacher performance */
ratingsRouter.get(
  "/admin/ratings/report",
  requireAuth,
  requireRoles("ADMIN"),
  requirePermission(Permission.RATINGS_REPORT),
  async (req, res) => {
    const departmentId = String(req.query.departmentId ?? "").trim();
    const facultyId = String(req.query.facultyId ?? "").trim();
    const academicYear = String(req.query.academicYear ?? "").trim();
    const semester = String(req.query.semester ?? "").trim();
    const format = String(req.query.format ?? "json").trim().toLowerCase();

    const teacherWhere: {
      departmentId?: string;
      department?: { facultyId?: string };
    } = {};
    if (departmentId) teacherWhere.departmentId = departmentId;
    if (facultyId) teacherWhere.department = { facultyId };

    const teachers = await prisma.teacher.findMany({
      where: teacherWhere,
      include: {
        department: {
          select: { id: true, name: true, code: true, facultyId: true },
        },
        user: { select: { status: true } },
        ratings: {
          where: {
            ...(academicYear ? { academicYear } : {}),
            ...(semester ? { semester } : {}),
          },
          select: {
            overallRating: true,
            teachingQuality: true,
            punctuality: true,
            engagement: true,
            comments: true,
            createdAt: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    const ranked = teachers
      .map((t) => {
        const totalReviews = t.ratings.length;
        const averageOverall =
          totalReviews === 0
            ? null
            : round1(
                t.ratings.reduce((s, r) => s + r.overallRating, 0) /
                  totalReviews
              );
        const eligibleForRenewal =
          averageOverall != null &&
          averageOverall >= 4.5 &&
          totalReviews >= 1;
        return {
          teacherId: t.id,
          facultyCode: t.facultyCode,
          teacherName: t.fullName,
          email: t.email,
          designation: t.designation,
          departmentId: t.department?.id ?? null,
          departmentName: t.department?.name ?? "Unassigned",
          facultyId: t.department?.facultyId ?? null,
          status: t.user.status,
          totalReviews,
          averageOverall,
          averageTeachingQuality:
            totalReviews === 0
              ? null
              : round1(
                  t.ratings.reduce((s, r) => s + r.teachingQuality, 0) /
                    totalReviews
                ),
          averagePunctuality:
            totalReviews === 0
              ? null
              : round1(
                  t.ratings.reduce((s, r) => s + r.punctuality, 0) /
                    totalReviews
                ),
          averageEngagement:
            totalReviews === 0
              ? null
              : round1(
                  t.ratings.reduce((s, r) => s + r.engagement, 0) /
                    totalReviews
                ),
          eligibleForRenewal,
          renewalLabel: eligibleForRenewal
            ? "Eligible for Contract Renewal (Next Semester)"
            : null,
        };
      })
      .sort((a, b) => {
        const av = a.averageOverall ?? -1;
        const bv = b.averageOverall ?? -1;
        if (bv !== av) return bv - av;
        return b.totalReviews - a.totalReviews;
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));

    if (format === "csv") {
      const header = [
        "Rank",
        "Faculty Code",
        "Teacher Name",
        "Department",
        "Total Reviews",
        "Average Overall",
        "Teaching Quality",
        "Punctuality",
        "Engagement",
        "Renewal Status",
      ];
      const lines = [
        header.join(","),
        ...ranked.map((r) =>
          [
            r.rank,
            csvEscape(r.facultyCode),
            csvEscape(r.teacherName),
            csvEscape(r.departmentName),
            r.totalReviews,
            r.averageOverall ?? "",
            r.averageTeachingQuality ?? "",
            r.averagePunctuality ?? "",
            r.averageEngagement ?? "",
            csvEscape(r.renewalLabel ?? "—"),
          ].join(",")
        ),
      ];
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dhapti-teacher-performance-${stamp}.csv"`
      );
      return res.status(200).send(lines.join("\n"));
    }

    return res.json({
      filters: { departmentId: departmentId || null, facultyId: facultyId || null, academicYear: academicYear || null, semester: semester || null },
      data: ranked,
      eligibleCount: ranked.filter((r) => r.eligibleForRenewal).length,
    });
  }
);

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
