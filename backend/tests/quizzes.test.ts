import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

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

describe("Phase 1G Quizzes & Online Assessments", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let otherTeacherToken = "";
  let studentToken = "";
  let otherStudentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let otherTeacherId = "";
  let classId = "";
  let otherClassId = "";
  let studentId = "";
  let otherStudentId = "";
  let studentUserId = "";
  let otherStudentUserId = "";
  let quizId = "";
  let questionId = "";
  let correctChoiceId = "";
  let wrongChoiceId = "";
  let attemptId = "";

  after(async () => {
    const classIds = [classId, otherClassId].filter(Boolean);
    if (classIds.length) {
      const quizzes = await prisma.quiz.findMany({
        where: { classSectionId: { in: classIds } },
        select: { id: true },
      });
      const qids = quizzes.map((q) => q.id);
      if (qids.length) {
        const attempts = await prisma.quizAttempt.findMany({
          where: { quizId: { in: qids } },
          select: { id: true },
        });
        const aids = attempts.map((a) => a.id);
        if (aids.length) {
          await prisma.quizAnswer.deleteMany({ where: { attemptId: { in: aids } } }).catch(() => {});
        }
        await prisma.quizAttempt.deleteMany({ where: { quizId: { in: qids } } }).catch(() => {});
        await prisma.quizChoice.deleteMany({
          where: { question: { quizId: { in: qids } } },
        }).catch(() => {});
        await prisma.quizQuestion.deleteMany({ where: { quizId: { in: qids } } }).catch(() => {});
        await prisma.quiz.deleteMany({ where: { id: { in: qids } } }).catch(() => {});
      }
      await prisma.enrollment.deleteMany({ where: { classSectionId: { in: classIds } } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { id: { in: classIds } } }).catch(() => {});
    }
    if (courseId) {
      await prisma.courseTeacher.deleteMany({ where: { courseId } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    for (const id of [teacherId, otherTeacherId].filter(Boolean)) {
      const t = await prisma.teacher.findUnique({ where: { id } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    for (const uid of [studentUserId, otherStudentUserId].filter(Boolean)) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    if (facultyId) await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("rejects unauthenticated quiz access", async () => {
    const res = await request(app).get("/api/quizzes/me");
    assert.equal(res.status, 401);
    const start = await request(app).post("/api/quizzes/x/attempts");
    assert.equal(start.status, 401);
  });

  it("quiz lifecycle, security, auto-grade, and approval", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Quiz Fac ${suffix}`,
        code: `QF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Quiz Dept ${suffix}`,
        code: `QD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `QC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Quiz Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Quiz Teacher ${suffix}`,
        email: `qteach_${suffix}@dhapti.edu.so`,
        facultyCode: `QT${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherToken = await login(`qteach_${suffix}@dhapti.edu.so`, "TEACHER");

    const otherTeacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Quiz T ${suffix}`,
        email: `oqteach_${suffix}@dhapti.edu.so`,
        facultyCode: `OQ${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherTeacher.status, 201, otherTeacher.text);
    otherTeacherId = otherTeacher.body.id;
    otherTeacherToken = await login(`oqteach_${suffix}@dhapti.edu.so`, "TEACHER");

    await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    await request(app)
      .post(`/api/teachers/${otherTeacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });

    const cls = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2025-2026",
        semester: "Semester 1",
        capacity: 40,
      });
    assert.equal(cls.status, 201, cls.text);
    classId = cls.body.id;

    const otherCls = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId: otherTeacherId,
        section: "B",
        academicYear: "2025-2026",
        semester: "Semester 1",
        capacity: 40,
      });
    assert.equal(otherCls.status, 201, otherCls.text);
    otherClassId = otherCls.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Quiz Student ${suffix}`,
        email: `qstud_${suffix}@dhapti.edu.so`,
        studentCode: `QS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (await prisma.student.findUnique({ where: { id: studentId } }))!.userId;
    studentToken = await login(`qstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const otherStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Quiz S ${suffix}`,
        email: `oqstud_${suffix}@dhapti.edu.so`,
        studentCode: `OQS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherStudent.status, 201, otherStudent.text);
    otherStudentId = otherStudent.body.id;
    otherStudentUserId = (
      await prisma.student.findUnique({ where: { id: otherStudentId } })
    )!.userId;
    otherStudentToken = await login(`oqstud_${suffix}@dhapti.edu.so`, "STUDENT");

    assert.equal(
      (
        await request(app)
          .post("/api/enrollments")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ studentId, classSectionId: classId })
      ).status,
      201
    );
    assert.equal(
      (
        await request(app)
          .post("/api/enrollments")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ studentId: otherStudentId, classSectionId: otherClassId })
      ).status,
      201
    );

    // Cannot create for another teacher's class
    const crossCreate = await request(app)
      .post("/api/quizzes")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: otherClassId,
        title: "Bad quiz",
        durationMinutes: 30,
      });
    assert.equal(crossCreate.status, 403);

    const created = await request(app)
      .post("/api/quizzes")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Unit Quiz ${suffix}`,
        instructions: "Answer carefully",
        durationMinutes: 30,
        maxAttempts: 1,
      });
    assert.equal(created.status, 201, created.text);
    quizId = created.body.id;
    assert.equal(created.body.accountStatus, "DRAFT");

    // Empty quiz cannot publish
    const emptyPublish = await request(app)
      .patch(`/api/quizzes/${quizId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });
    assert.equal(emptyPublish.status, 400);

    // Invalid MC rejected
    const badQ = await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "MULTIPLE_CHOICE_SINGLE",
        prompt: "Bad",
        marks: 5,
        choices: [
          { label: "A", isCorrect: true },
          { label: "B", isCorrect: true },
        ],
      });
    assert.equal(badQ.status, 400);

    const negMarks = await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "TRUE_FALSE",
        prompt: "Earth is round",
        marks: 0,
        correctBoolean: true,
      });
    assert.equal(negMarks.status, 400);

    const q1 = await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "MULTIPLE_CHOICE_SINGLE",
        prompt: "2 + 2 = ?",
        marks: 5,
        choices: [
          { label: "3", isCorrect: false },
          { label: "4", isCorrect: true },
        ],
      });
    assert.equal(q1.status, 201, q1.text);
    questionId = q1.body.id ?? q1.body.questions?.find((x: { prompt: string }) => x.prompt.includes("2 + 2"))?.id;

    // Reload quiz for choice ids
    let detail = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(detail.status, 200, detail.text);
    const mc = detail.body.questions.find(
      (q: { type: string }) => q.type === "MULTIPLE_CHOICE_SINGLE"
    );
    questionId = mc.id;
    correctChoiceId = mc.choices.find((c: { isCorrect: boolean }) => c.isCorrect).id;
    wrongChoiceId = mc.choices.find((c: { isCorrect: boolean }) => !c.isCorrect).id;

    const tf = await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "TRUE_FALSE",
        prompt: "Sky can be blue",
        marks: 5,
        correctBoolean: true,
      });
    assert.equal(tf.status, 201, tf.text);

    const sa = await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "SHORT_ANSWER",
        prompt: "Capital of France?",
        marks: 5,
        acceptedAnswers: ["Paris", "paris"],
      });
    assert.equal(sa.status, 201, sa.text);

    detail = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(detail.body.totalMarks, 15);

    // Other teacher cannot edit
    const otherEdit = await request(app)
      .patch(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({ title: "Hacked" });
    assert.equal(otherEdit.status, 403);

    const published = await request(app)
      .patch(`/api/quizzes/${quizId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.accountStatus, "PUBLISHED");

    // Student not enrolled cannot see / start
    const otherList = await request(app)
      .get("/api/students/me/quizzes")
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherList.status, 200);
    assert.equal(
      otherList.body.data.some((q: { id: string }) => q.id === quizId),
      false
    );

    const otherStart = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherStart.status, 403);

    // Enrolled student sees quiz without answer keys
    const list = await request(app)
      .get("/api/students/me/quizzes")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(list.status, 200, list.text);
    assert.ok(list.body.data.some((q: { id: string }) => q.id === quizId));

    const studentQuiz = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentQuiz.status, 200, studentQuiz.text);
    const studentQ = studentQuiz.body.questions.find(
      (q: { id: string }) => q.id === questionId
    );
    assert.ok(studentQ);
    assert.equal(studentQ.choices[0].isCorrect, undefined);
    assert.ok(!("acceptedAnswers" in studentQ) || studentQ.acceptedAnswers == null);

    const started = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(started.status, 201, started.text);
    attemptId = started.body.id;
    assert.equal(started.body.status, "IN_PROGRESS");
    assert.ok(started.body.expiresAt);

    // Max attempts / concurrent
    const second = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok(second.status === 409 || second.status === 400);

    // Other student cannot access attempt
    const steal = await request(app)
      .get(`/api/attempts/${attemptId}`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(steal.status, 403);

    // Save answers + forge score ignored
    detail = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const tfQ = detail.body.questions.find(
      (q: { type: string }) => q.type === "TRUE_FALSE"
    );
    const saQ = detail.body.questions.find(
      (q: { type: string }) => q.type === "SHORT_ANSWER"
    );
    const trueChoice = tfQ.choices.find((c: { label: string }) =>
      /^true$/i.test(c.label)
    );

    const save = await request(app)
      .patch(`/api/attempts/${attemptId}/answers`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        score: 999,
        percentage: 100,
        answers: [
          { questionId, choiceId: correctChoiceId },
          { questionId: tfQ.id, choiceId: trueChoice.id },
          { questionId: saQ.id, answerText: "  Paris  " },
        ],
      });
    assert.equal(save.status, 200, save.text);

    const submitted = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ score: 999, percentage: 100 });
    assert.equal(submitted.status, 200, submitted.text);
    assert.equal(submitted.body.status, "SUBMITTED");
    assert.equal(submitted.body.gradeStatus, "PENDING_APPROVAL");
    // Student serializer hides score until APPROVED
    assert.equal(submitted.body.score, null);

    // Double submit rejected
    const double = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(double.status, 409);

    // Verify server score in DB
    const dbAttempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    assert.equal(dbAttempt?.score, 15);
    assert.equal(dbAttempt?.maxScore, 15);
    assert.equal(dbAttempt?.percentage, 100);

    // Incorrect MC scores 0 for that question — new quiz for wrong answer path briefly via regrade check
    // Student results empty while pending
    let results = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(results.status, 200);
    assert.equal(
      results.body.data.some((r: { id: string }) => r.id === attemptId),
      false
    );

    // Teacher cannot approve
    const tApprove = await request(app)
      .post(`/api/quiz-attempts/${attemptId}/approve`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(tApprove.status, 403);

    const approved = await request(app)
      .post(`/api/quiz-attempts/${attemptId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.body.gradeStatus, "APPROVED");

    results = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok(results.body.data.some((r: { id: string; score: number }) => r.id === attemptId && r.score === 15));

    const otherResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(
      otherResults.body.data.some((r: { id: string }) => r.id === attemptId),
      false
    );

    // Wrong answer grading on a fresh quiz
    const quiz2 = await request(app)
      .post("/api/quizzes")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Wrong Ans Quiz ${suffix}`,
        durationMinutes: 20,
        maxAttempts: 2,
      });
    assert.equal(quiz2.status, 201, quiz2.text);
    const qWrong = await request(app)
      .post(`/api/quizzes/${quiz2.body.id}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "MULTIPLE_CHOICE_SINGLE",
        prompt: "1+1?",
        marks: 10,
        choices: [
          { label: "1", isCorrect: false },
          { label: "2", isCorrect: true },
        ],
      });
    assert.equal(qWrong.status, 201, qWrong.text);
    await request(app)
      .patch(`/api/quizzes/${quiz2.body.id}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });

    const d2 = await request(app)
      .get(`/api/quizzes/${quiz2.body.id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const mq = d2.body.questions[0];
    const wrong = mq.choices.find((c: { isCorrect: boolean }) => !c.isCorrect).id;

    const a2 = await request(app)
      .post(`/api/quizzes/${quiz2.body.id}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(a2.status, 201, a2.text);
    await request(app)
      .patch(`/api/attempts/${a2.body.id}/answers`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: mq.id, choiceId: wrong }] });
    await request(app)
      .post(`/api/attempts/${a2.body.id}/submit`)
      .set("Authorization", `Bearer ${studentToken}`);
    const db2 = await prisma.quizAttempt.findUnique({ where: { id: a2.body.id } });
    assert.equal(db2?.score, 0);
    assert.equal(db2?.maxScore, 10);

    void wrongChoiceId;
  });
});
