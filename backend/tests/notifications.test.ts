import assert from "node:assert/strict";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  createNotification,
  notifyAssignmentPublished,
} from "../src/lib/notifications.js";
import { hasPermission, Permission } from "../src/lib/permissions.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "report.pdf");

async function login(email: string, expectedRole?: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({
      email,
      password: "DHAPTI@2026",
      ...(expectedRole ? { expectedRole } : {}),
    });
  assert.equal(res.status, 200, res.text);
  return res.body.token as string;
}

describe("Phase 1I Notifications Foundation", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let otherStudentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let classId = "";
  let studentId = "";
  let otherStudentId = "";
  let studentUserId = "";
  let otherStudentUserId = "";
  let teacherUserId = "";
  const createdNotificationIds: string[] = [];
  let assignmentId = "";
  let quizId = "";
  let submissionId = "";

  after(async () => {
    if (createdNotificationIds.length) {
      await prisma.notification
        .deleteMany({ where: { id: { in: createdNotificationIds } } })
        .catch(() => {});
    }
    await prisma.notification
      .deleteMany({
        where: {
          OR: [
            { dedupeKey: { startsWith: `assignment.published:` } },
            { dedupeKey: { startsWith: `quiz.published:` } },
            { dedupeKey: { startsWith: `grade.approved:` } },
            { title: { contains: suffix } },
          ],
        },
      })
      .catch(() => {});

    if (submissionId) {
      await prisma.submission.deleteMany({ where: { id: submissionId } }).catch(() => {});
    }
    if (assignmentId) {
      await prisma.assignment.deleteMany({ where: { id: assignmentId } }).catch(() => {});
    }
    if (quizId) {
      await prisma.quizAnswer.deleteMany({ where: { attempt: { quizId } } }).catch(() => {});
      await prisma.quizAttempt.deleteMany({ where: { quizId } }).catch(() => {});
      await prisma.quizChoice.deleteMany({ where: { question: { quizId } } }).catch(() => {});
      await prisma.quizQuestion.deleteMany({ where: { quizId } }).catch(() => {});
      await prisma.quiz.deleteMany({ where: { id: quizId } }).catch(() => {});
    }
    if (classId) {
      await prisma.enrollment.deleteMany({ where: { classSectionId: classId } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { id: classId } }).catch(() => {});
    }
    if (courseId) {
      await prisma.courseTeacher.deleteMany({ where: { courseId } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    if (teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    for (const uid of [studentUserId, otherStudentUserId].filter(Boolean)) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("permission catalog: inbox read for all roles; create/manage admin only", () => {
    assert.equal(hasPermission("ADMIN", Permission.NOTIFICATIONS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.NOTIFICATIONS_CREATE), true);
    assert.equal(hasPermission("ADMIN", Permission.NOTIFICATIONS_MANAGE), true);
    assert.equal(hasPermission("TEACHER", Permission.NOTIFICATIONS_READ), true);
    assert.equal(hasPermission("TEACHER", Permission.NOTIFICATIONS_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.NOTIFICATIONS_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.NOTIFICATIONS_CREATE), false);
  });

  it("rejects unauthenticated notification access", async () => {
    assert.equal((await request(app).get("/api/notifications")).status, 401);
    assert.equal(
      (await request(app).get("/api/notifications/unread-count")).status,
      401
    );
    assert.equal(
      (await request(app).post("/api/notifications/read-all")).status,
      401
    );
    assert.equal((await request(app).post("/api/notifications")).status, 401);
  });

  it("admin/student/teacher inbox ownership, read state, audiences, auto-notify", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Notif Fac ${suffix}`,
        code: `NF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Notif Dept ${suffix}`,
        code: `ND${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `NC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Notif Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Notif Teacher ${suffix}`,
        email: `nteach_${suffix}@dhapti.edu.so`,
        facultyCode: `NT${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherUserId = (
      await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId } })
    ).userId;
    teacherToken = await login(`nteach_${suffix}@dhapti.edu.so`, "TEACHER");

    await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });

    const klass = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2025-2026",
        semester: "1",
      });
    assert.equal(klass.status, 201, klass.text);
    classId = klass.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Notif Student ${suffix}`,
        email: `nstud_${suffix}@dhapti.edu.so`,
        studentCode: `NS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: studentId } })
    ).userId;
    studentToken = await login(`nstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const otherStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Notif S ${suffix}`,
        email: `onstud_${suffix}@dhapti.edu.so`,
        studentCode: `ON${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherStudent.status, 201, otherStudent.text);
    otherStudentId = otherStudent.body.id;
    otherStudentUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: otherStudentId } })
    ).userId;
    otherStudentToken = await login(`onstud_${suffix}@dhapti.edu.so`, "STUDENT");

    await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });

    // Student/teacher cannot create
    const studentCreate = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        title: `Blocked ${suffix}`,
        message: "nope",
        audience: "STUDENTS",
      });
    assert.equal(studentCreate.status, 403);

    const teacherCreate = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: `Blocked T ${suffix}`,
        message: "nope",
        audience: "TEACHERS",
      });
    assert.equal(teacherCreate.status, 403);

    // Admin targets students
    const annStudents = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Students Ann ${suffix}`,
        message: "Hello students",
        type: "ANNOUNCEMENT",
        priority: "HIGH",
        audience: "STUDENTS",
      });
    assert.equal(annStudents.status, 201, annStudents.text);
    createdNotificationIds.push(annStudents.body.id);
    assert.ok(annStudents.body.recipientCount >= 2);

    // Admin targets specific users (teacher only)
    const annUser = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `User Ann ${suffix}`,
        message: "Hello teacher only",
        audience: "USERS",
        userIds: [teacherUserId],
        priority: "NORMAL",
      });
    assert.equal(annUser.status, 201, annUser.text);
    createdNotificationIds.push(annUser.body.id);
    assert.equal(annUser.body.recipientCount, 1);

    // Duplicate recipients prevented at service layer (unique constraint)
    const dup = await createNotification({
      type: "SYSTEM",
      title: `Dup ${suffix}`,
      message: "dup test",
      userIds: [studentUserId, studentUserId, studentUserId],
    });
    assert.equal(dup.skipped, false);
    assert.equal(dup.recipientCount, 1);
    if (dup.notification) createdNotificationIds.push(dup.notification.id);
    const recipCount = await prisma.notificationRecipient.count({
      where: { notificationId: dup.notification!.id },
    });
    assert.equal(recipCount, 1);

    // Student sees own inbox; other student does not see teacher-only note
    const studentInbox = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentInbox.status, 200, studentInbox.text);
    assert.ok(studentInbox.body.pagination);
    assert.equal(typeof studentInbox.body.pagination.total, "number");
    assert.ok(
      studentInbox.body.data.some(
        (n: { title: string }) => n.title === `Students Ann ${suffix}`
      )
    );
    assert.ok(
      !studentInbox.body.data.some(
        (n: { title: string }) => n.title === `User Ann ${suffix}`
      )
    );

    const otherInbox = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherInbox.status, 200);
    assert.ok(
      otherInbox.body.data.some(
        (n: { title: string }) => n.title === `Students Ann ${suffix}`
      )
    );

    const teacherInbox = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherInbox.status, 200);
    assert.ok(
      teacherInbox.body.data.some(
        (n: { title: string }) => n.title === `User Ann ${suffix}`
      )
    );

    // Unread filter + unread count (own only)
    const unreadBefore = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(unreadBefore.status, 200);
    assert.ok(unreadBefore.body.count >= 1);

    const unreadList = await request(app)
      .get("/api/notifications?unread=true")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(unreadList.status, 200);
    assert.ok(unreadList.body.data.every((n: { read: boolean }) => n.read === false));

    const typeFilter = await request(app)
      .get("/api/notifications?type=ANNOUNCEMENT")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(typeFilter.status, 200);
    assert.ok(
      typeFilter.body.data.every(
        (n: { type: string }) => n.type === "ANNOUNCEMENT"
      )
    );

    const targetId = studentInbox.body.data.find(
      (n: { title: string }) => n.title === `Students Ann ${suffix}`
    ).id as string;

    // Student cannot mark another user's recipient via their token on a shared notification —
    // marking is per JWT userId, so student marking is fine; other student remains unread.
    const markRead = await request(app)
      .patch(`/api/notifications/${targetId}/read`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(markRead.status, 200, markRead.text);
    assert.equal(markRead.body.read, true);

    const otherDetail = await request(app)
      .get(`/api/notifications/${targetId}`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherDetail.status, 200);
    assert.equal(otherDetail.body.read, false);

    // Student cannot access notification they are not a recipient of
    const foreign = await request(app)
      .get(`/api/notifications/${annUser.body.id}`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(foreign.status, 404);

    const foreignRead = await request(app)
      .patch(`/api/notifications/${annUser.body.id}/read`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(foreignRead.status, 404);

    // Mark-all only own
    const markAll = await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(markAll.status, 200);
    assert.ok(typeof markAll.body.updated === "number");

    const unreadAfter = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(unreadAfter.body.count, 0);

    const otherUnread = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.ok(otherUnread.body.count >= 1);

    // Admin sent list
    const sent = await request(app)
      .get(`/api/notifications/sent?q=${encodeURIComponent(suffix)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(sent.status, 200);
    assert.ok(sent.body.data.length >= 2);
    assert.ok(sent.body.pagination.totalPages >= 1);

    const sentForbidden = await request(app)
      .get("/api/notifications/sent")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(sentForbidden.status, 403);

    // --- Auto: assignment published ---
    const assignment = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Notif Assign ${suffix}`,
        dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxMarks: 5,
        status: "DRAFT",
      });
    assert.equal(assignment.status, 201, assignment.text);
    assignmentId = assignment.body.id;

    const publish = await request(app)
      .patch(`/api/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });
    assert.equal(publish.status, 200, publish.text);

    // Allow async notify catch to settle
    await new Promise((r) => setTimeout(r, 50));

    const afterPublish = await request(app)
      .get("/api/notifications?type=ASSIGNMENT&unread=true")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(afterPublish.status, 200);
    assert.ok(
      afterPublish.body.data.some(
        (n: { sourceId: string | null }) => n.sourceId === assignmentId
      )
    );

    // Not enrolled student does not get assignment notification
    const otherAssign = await request(app)
      .get("/api/notifications?type=ASSIGNMENT")
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.ok(
      !otherAssign.body.data.some(
        (n: { sourceId: string | null }) => n.sourceId === assignmentId
      )
    );

    // Dedupe: second publish notify is skipped
    const again = await notifyAssignmentPublished({
      id: assignmentId,
      title: `Notif Assign ${suffix}`,
      classSectionId: classId,
    });
    assert.equal(again.deduped || again.skipped, true);

    const assignNotifCount = await prisma.notification.count({
      where: { dedupeKey: `assignment.published:${assignmentId}` },
    });
    assert.equal(assignNotifCount, 1);

    // --- Auto: quiz published ---
    const quiz = await request(app)
      .post("/api/quizzes")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Notif Quiz ${suffix}`,
        durationMinutes: 30,
        maxAttempts: 1,
        status: "DRAFT",
      });
    assert.equal(quiz.status, 201, quiz.text);
    quizId = quiz.body.id;

    const q = await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "TRUE_FALSE",
        prompt: "Is Dhapti great?",
        marks: 5,
        correctBoolean: true,
      });
    assert.equal(q.status, 201, q.text);

    const quizPublish = await request(app)
      .patch(`/api/quizzes/${quizId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });
    assert.equal(quizPublish.status, 200, quizPublish.text);

    await new Promise((r) => setTimeout(r, 50));

    const quizNotes = await request(app)
      .get("/api/notifications?type=QUIZ")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok(
      quizNotes.body.data.some(
        (n: { sourceId: string | null }) => n.sourceId === quizId
      )
    );

    // --- Auto: grade approved ---
    const submit = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(submit.status, 201, submit.text);
    submissionId = submit.body.id;
    assert.ok(submissionId);

    const grade = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 4.4, feedback: "Good" });
    assert.equal(grade.status, 200, grade.text);

    const submitApproval = await request(app)
      .post(`/api/submissions/${submissionId}/grade/submit`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(submitApproval.status, 200, submitApproval.text);

    const approve = await request(app)
      .post(`/api/grades/${submissionId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approve.status, 200, approve.text);

    await new Promise((r) => setTimeout(r, 50));

    const gradeNotes = await request(app)
      .get("/api/notifications?type=GRADE")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok(
      gradeNotes.body.data.some(
        (n: { sourceId: string | null }) => n.sourceId === submissionId
      )
    );

    // Pagination shape
    const page1 = await request(app)
      .get("/api/notifications?page=1&pageSize=1")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(page1.status, 200);
    assert.equal(page1.body.data.length, 1);
    assert.equal(page1.body.pagination.page, 1);
    assert.equal(page1.body.pagination.pageSize, 1);
    assert.ok(page1.body.pagination.total >= 1);
    assert.ok(page1.body.pagination.totalPages >= 1);
  });
});
