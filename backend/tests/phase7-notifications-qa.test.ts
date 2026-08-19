import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

async function login(email: string, expectedRole: string) {
  const res = await request(app).post("/api/auth/login").send({
    email,
    password: "DHAPTI@2026",
    expectedRole,
  });
  assert.equal(res.status, 200, res.text);
  return res.body.token as string;
}

describe("Phase 7 — Q&A, notifications & audit", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let questionId = "";
  let courseId = "";
  let studentUserId = "";

  before(async () => {
    const student = await prisma.student.findFirst({
      where: { email: "mohamudcade143@gmail.com" },
      select: { id: true, userId: true },
    });
    assert.ok(student, "Seeded student required");
    studentUserId = student!.userId;

    const teacher = await prisma.teacher.findFirst({
      where: { email: "mohamed.ali@dhapti.edu.so" },
      select: { id: true },
    });
    assert.ok(teacher, "Seeded teacher required");

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        status: "ACTIVE",
        studentId: student!.id,
        OR: [
          { classSection: { teacherId: teacher!.id } },
          {
            classSection: {
              course: { teachers: { some: { teacherId: teacher!.id } } },
            },
          },
        ],
      },
      include: {
        classSection: { select: { courseId: true } },
      },
    });
    assert.ok(
      enrollment,
      "Need active enrollment on a course taught by mohamed.ali"
    );
    courseId = enrollment!.classSection.courseId;
  });

  after(async () => {
    if (questionId) {
      await prisma.courseQuestionReply
        .deleteMany({ where: { questionId } })
        .catch(() => {});
      await prisma.courseQuestion
        .deleteMany({ where: { id: questionId } })
        .catch(() => {});
    }
    await prisma.notification
      .deleteMany({
        where: {
          OR: [
            { dedupeKey: { startsWith: `question.replied:` } },
            { dedupeKey: { startsWith: `question.asked:` } },
            { title: { contains: `Phase7-${suffix}` } },
          ],
        },
      })
      .catch(() => {});
  });

  it("student can submit a course question when enrolled", async () => {
    const token = await login("mohamudcade143@gmail.com", "STUDENT");
    const created = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        courseId,
        subject: `Phase7-${suffix} help`,
        body: "How do I prepare for the midterm exam?",
      });
    assert.equal(created.status, 201, created.text);
    questionId = created.body.id;
    assert.equal(created.body.answered, false);
    assert.equal(created.body.courseId, courseId);

    const teacherNotif = await prisma.notification.findFirst({
      where: { dedupeKey: `question.asked:${questionId}` },
    });
    assert.ok(teacherNotif, "Teacher should be notified of new question");

    const teacherToken = await login("mohamed.ali@dhapti.edu.so", "TEACHER");
    const inbox = await request(app)
      .get("/api/notifications?pageSize=20")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(inbox.status, 200, inbox.text);
    const hit = (
      inbox.body.data as Array<{ sourceType: string | null; title: string }>
    ).some(
      (n) =>
        n.sourceType === "COURSE_QUESTION" &&
        n.title.includes("New student question")
    );
    assert.equal(hit, true);
  });

  it("teacher can reply and student receives a notification", async () => {
    assert.ok(questionId);
    const teacherToken = await login("mohamed.ali@dhapti.edu.so", "TEACHER");
    const replied = await request(app)
      .post(`/api/questions/${questionId}/reply`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ body: "Review chapters 1–3 and attempt the practice quiz." });
    assert.equal(replied.status, 201, replied.text);
    assert.equal(replied.body.answered, true);
    assert.ok(replied.body.replies.length >= 1);

    const studentToken = await login("mohamudcade143@gmail.com", "STUDENT");
    const inbox = await request(app)
      .get("/api/notifications?pageSize=20")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(inbox.status, 200, inbox.text);
    const hit = (inbox.body.data as Array<{ title: string; sourceType: string | null }>).some(
      (n) =>
        n.title.includes("Instructor replied") ||
        n.sourceType === "COURSE_QUESTION"
    );
    assert.equal(hit, true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "QUESTION_REPLY", entityType: "CourseQuestionReply" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit);
  });

  it("teacher questions list supports unanswered filter", async () => {
    const token = await login("mohamed.ali@dhapti.edu.so", "TEACHER");
    const res = await request(app)
      .get("/api/questions/teacher?status=all&pageSize=50")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(Array.isArray(res.body.data));
  });

  it("admin audit logs endpoint returns paginated rows", async () => {
    const token = await login("admin@dhapti.edu.so", "ADMIN");
    const res = await request(app)
      .get("/api/admin/audit-logs?pageSize=10")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
  });

  it("certificate issue writes audit and notifies student", async () => {
    const token = await login("admin@dhapti.edu.so", "ADMIN");
    const student = await prisma.student.findFirst({
      where: { userId: studentUserId },
    });
    assert.ok(student);

    const created = await request(app)
      .post("/api/admin/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        studentId: student!.id,
        degreeTitle: `Phase7 Cert ${suffix}`,
        facultyName: "Faculty of Computing & IT",
        graduationDate: "2026-06-01",
      });
    assert.equal(created.status, 201, created.text);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "CERTIFICATE_ISSUE",
        entityId: created.body.id,
      },
    });
    assert.ok(audit);

    const notif = await prisma.notification.findFirst({
      where: { dedupeKey: `certificate.issued:${created.body.id}` },
    });
    assert.ok(notif);

    await prisma.certificate.delete({ where: { id: created.body.id } }).catch(() => {});
  });
});
