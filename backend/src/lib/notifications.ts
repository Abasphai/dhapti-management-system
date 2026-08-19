import {
  Prisma,
  type NotificationPriority,
  type NotificationType,
  type Role,
} from "@prisma/client";

import { prisma } from "./prisma.js";

export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  sourceType?: string | null;
  sourceId?: string | null;
  /** Unique key for auto-events; if already exists, skip creating a new notification. */
  dedupeKey?: string | null;
  link?: string | null;
  createdById?: string | null;
  userIds: string[];
};

export type NotificationAudience =
  | "STUDENTS"
  | "TEACHERS"
  | "ADMINS"
  | "STUDENTS_TEACHERS"
  | "EVERYONE"
  | "USERS";

/**
 * Central notification service (Phase 1I).
 * Domain modules must call these helpers — not write Notification rows directly.
 */
export async function resolveUserIdsForAudience(
  audience: NotificationAudience,
  specificUserIds?: string[]
): Promise<string[]> {
  if (audience === "USERS") {
    const ids = [...new Set((specificUserIds ?? []).filter(Boolean))];
    if (!ids.length) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  const roles: Role[] =
    audience === "STUDENTS"
      ? ["STUDENT"]
      : audience === "TEACHERS"
        ? ["TEACHER"]
        : audience === "ADMINS"
          ? ["ADMIN"]
          : audience === "STUDENTS_TEACHERS"
            ? ["STUDENT", "TEACHER"]
            : ["STUDENT", "TEACHER", "ADMIN"];

  const users = await prisma.user.findMany({
    where: { role: { in: roles }, status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function createNotification(input: CreateNotificationInput) {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (!userIds.length) {
    return { notification: null, recipientCount: 0, skipped: true as const };
  }

  if (input.dedupeKey) {
    const existing = await prisma.notification.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) {
      return {
        notification: existing,
        recipientCount: 0,
        skipped: true as const,
        deduped: true as const,
      };
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          type: input.type,
          title: input.title,
          message: input.message,
          priority: input.priority ?? "NORMAL",
          sourceType: input.sourceType ?? null,
          sourceId: input.sourceId ?? null,
          dedupeKey: input.dedupeKey ?? null,
          link: input.link ?? null,
          createdById: input.createdById ?? null,
        },
      });

      await tx.notificationRecipient.createMany({
        data: userIds.map((userId) => ({
          notificationId: notification.id,
          userId,
        })),
      });

      return notification;
    });

    return {
      notification: created,
      recipientCount: userIds.length,
      skipped: false as const,
    };
  } catch (err) {
    // Concurrent auto-events with the same dedupeKey
    if (
      input.dedupeKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (existing) {
        return {
          notification: existing,
          recipientCount: 0,
          skipped: true as const,
          deduped: true as const,
        };
      }
    }
    throw err;
  }
}

export async function createNotificationForUser(
  userId: string,
  input: Omit<CreateNotificationInput, "userIds">
) {
  return createNotification({ ...input, userIds: [userId] });
}

export async function createNotificationForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userIds">
) {
  return createNotification({ ...input, userIds });
}

export async function createNotificationForRole(
  role: Role,
  input: Omit<CreateNotificationInput, "userIds">
) {
  const users = await prisma.user.findMany({
    where: { role, status: "ACTIVE" },
    select: { id: true },
  });
  return createNotification({
    ...input,
    userIds: users.map((u) => u.id),
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const row = await prisma.notificationRecipient.findUnique({
    where: {
      notificationId_userId: { notificationId, userId },
    },
  });
  if (!row) return null;
  if (row.readAt) return row;
  return prisma.notificationRecipient.update({
    where: { id: row.id },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notificationRecipient.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notificationRecipient.count({
    where: { userId, readAt: null },
  });
}

export const recipientInclude = {
  notification: true,
} as const;

export type RecipientWithNotification = Prisma.NotificationRecipientGetPayload<{
  include: typeof recipientInclude;
}>;

/** Active student userIds enrolled in a ClassSection. */
export async function enrolledStudentUserIds(classSectionId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { classSectionId, status: "ACTIVE" },
    select: {
      student: { select: { userId: true, user: { select: { status: true } } } },
    },
  });
  return enrollments
    .filter((e) => e.student.user.status === "ACTIVE")
    .map((e) => e.student.userId);
}

/** Auto: assignment published → enrolled students (deduped). */
export async function notifyAssignmentPublished(assignment: {
  id: string;
  title: string;
  classSectionId: string;
}) {
  const userIds = await enrolledStudentUserIds(assignment.classSectionId);
  return createNotification({
    type: "ASSIGNMENT",
    title: "Assignment published",
    message: `"${assignment.title}" is now available.`,
    priority: "NORMAL",
    sourceType: "ASSIGNMENT",
    sourceId: assignment.id,
    dedupeKey: `assignment.published:${assignment.id}`,
    link: "/student/assignments",
    userIds,
  });
}

/** Auto: grade approved → student. */
export async function notifyGradeApproved(input: {
  submissionId: string;
  studentUserId: string;
  assignmentTitle: string;
}) {
  return createNotificationForUser(input.studentUserId, {
    type: "GRADE",
    title: "Grade approved",
    message: `Your grade for "${input.assignmentTitle}" has been approved.`,
    priority: "HIGH",
    sourceType: "GRADE",
    sourceId: input.submissionId,
    dedupeKey: `grade.approved:${input.submissionId}`,
    link: "/student/results",
  });
}

/** Auto: admission approved → student welcome / credentials notice. */
export async function notifyStudentWelcome(input: {
  userId: string;
  fullName: string;
  studentCode: string;
  defaultPassword: string;
}) {
  return createNotificationForUser(input.userId, {
    type: "SYSTEM",
    title: "Welcome to Dhapti Portal",
    message: `Welcome ${input.fullName}. Your Student ID is ${input.studentCode}. Sign in with your email and temporary password ${input.defaultPassword}, then change it immediately.`,
    priority: "HIGH",
    sourceType: "ADMISSION",
    sourceId: input.studentCode,
    dedupeKey: `admission.welcome:${input.studentCode}`,
    link: "/student/dashboard",
  });
}

/** Auto: admin grade decision → teacher. */
export async function notifyTeacherGradeDecision(input: {
  teacherUserId: string;
  submissionId: string;
  assignmentTitle: string;
  decision: "approved" | "returned";
}) {
  const approved = input.decision === "approved";
  return createNotificationForUser(input.teacherUserId, {
    type: "GRADE",
    title: approved ? "Grade approved by Admin" : "Grade returned by Admin",
    message: approved
      ? `Your submission for "${input.assignmentTitle}" was approved.`
      : `Your submission for "${input.assignmentTitle}" was returned for correction.`,
    priority: "NORMAL",
    sourceType: "GRADE_REVIEW",
    sourceId: input.submissionId,
    dedupeKey: `grade.teacher.${input.decision}:${input.submissionId}`,
    link: "/teacher/grades",
  });
}

/** Auto: quiz published → enrolled students. */
export async function notifyQuizPublished(quiz: {
  id: string;
  title: string;
  classSectionId: string;
}) {
  const userIds = await enrolledStudentUserIds(quiz.classSectionId);
  return createNotification({
    type: "QUIZ",
    title: "Quiz published",
    message: `"${quiz.title}" is now available.`,
    priority: "NORMAL",
    sourceType: "QUIZ",
    sourceId: quiz.id,
    dedupeKey: `quiz.published:${quiz.id}`,
    link: "/student/quizzes",
    userIds,
  });
}

/** Auto: quiz attempt grade approved → student. */
export async function notifyQuizGradeApproved(input: {
  attemptId: string;
  studentUserId: string;
  quizTitle: string;
}) {
  return createNotificationForUser(input.studentUserId, {
    type: "GRADE",
    title: "Quiz result approved",
    message: `Your result for quiz "${input.quizTitle}" has been approved.`,
    priority: "HIGH",
    sourceType: "QUIZ_GRADE",
    sourceId: input.attemptId,
    dedupeKey: `quiz.grade.approved:${input.attemptId}`,
    link: "/student/results",
  });
}

/** Auto: course-final ResultEntry approved → student. */
export async function notifyCourseResultApproved(input: {
  resultId: string;
  studentUserId: string;
  courseCode: string;
  courseTitle: string;
}) {
  return createNotificationForUser(input.studentUserId, {
    type: "RESULT",
    title: "Course result approved",
    message: `Your final result for ${input.courseCode} — ${input.courseTitle} has been approved.`,
    priority: "HIGH",
    sourceType: "COURSE_RESULT",
    sourceId: input.resultId,
    dedupeKey: `result.approved:${input.resultId}`,
    link: "/student/results",
  });
}

/** Auto: attendance below admin minimum threshold → student. */
export async function notifyLowAttendance(input: {
  studentUserId: string;
  classSectionId: string;
  courseLabel: string;
  percentage: number;
  threshold: number;
}) {
  return createNotificationForUser(input.studentUserId, {
    type: "ATTENDANCE",
    title: "Low attendance warning",
    message: `Your attendance in ${input.courseLabel} is ${input.percentage}% (minimum required: ${input.threshold}%). Attend upcoming sessions to meet the policy.`,
    priority: "HIGH",
    sourceType: "ATTENDANCE",
    sourceId: input.classSectionId,
    dedupeKey: `attendance.low:${input.classSectionId}:${input.studentUserId}`,
    link: "/student/attendance",
  });
}

/** Resolve teacher user IDs assigned to a course (CourseTeacher + ClassSection). */
export async function courseTeacherUserIds(courseId: string): Promise<string[]> {
  const [links, sections] = await Promise.all([
    prisma.courseTeacher.findMany({
      where: { courseId },
      select: { teacher: { select: { userId: true } } },
    }),
    prisma.classSection.findMany({
      where: { courseId },
      select: { teacher: { select: { userId: true } } },
    }),
  ]);
  return [
    ...new Set(
      [
        ...links.map((l) => l.teacher.userId),
        ...sections.map((s) => s.teacher.userId),
      ].filter(Boolean)
    ),
  ];
}

/** Auto: student asks a course question → assigned teachers. */
export async function notifyQuestionAsked(input: {
  questionId: string;
  courseId: string;
  courseCode: string;
  subject: string;
  studentName: string;
}) {
  const userIds = await courseTeacherUserIds(input.courseId);
  return createNotification({
    type: "MESSAGE",
    title: "New student question",
    message: `${input.studentName} asked about "${input.subject}" in ${input.courseCode}.`,
    priority: "NORMAL",
    sourceType: "COURSE_QUESTION",
    sourceId: input.questionId,
    dedupeKey: `question.asked:${input.questionId}`,
    link: "/teacher/questions",
    userIds,
  });
}

/** Auto: teacher replies to course Q&A → student author. */
export async function notifyQuestionReplied(input: {
  questionId: string;
  replyId: string;
  studentUserId: string;
  courseCode: string;
  subject: string;
}) {
  return createNotificationForUser(input.studentUserId, {
    type: "MESSAGE",
    title: "Instructor replied to your question",
    message: `Your question "${input.subject}" in ${input.courseCode} has a new reply.`,
    priority: "NORMAL",
    sourceType: "COURSE_QUESTION",
    sourceId: input.questionId,
    dedupeKey: `question.replied:${input.replyId}`,
    link: "/student/courses",
  });
}

/** Auto: certificate issued → student. */
export async function notifyCertificateIssued(input: {
  certificateId: string;
  studentUserId: string;
  degreeTitle: string;
  verificationCode: string;
}) {
  return createNotificationForUser(input.studentUserId, {
    type: "ACADEMIC",
    title: "Certificate issued",
    message: `Your certificate for "${input.degreeTitle}" is ready. Verification code: ${input.verificationCode}.`,
    priority: "HIGH",
    sourceType: "CERTIFICATE",
    sourceId: input.certificateId,
    dedupeKey: `certificate.issued:${input.certificateId}`,
    link: `/verify/certificate/${input.verificationCode}`,
  });
}
