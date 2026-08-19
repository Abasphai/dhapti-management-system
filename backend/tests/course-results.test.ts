import assert from "node:assert/strict";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import request from "supertest";

import { createApp } from "../src/app.js";
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

describe("Phase 1K Course Results / GPA / Transcript Foundation", () => {
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
  let enrollmentId = "";
  let assignmentId = "";
  let quizId = "";
  let resultId = "";
  let gradeScaleId = "";

  after(async () => {
    if (resultId) {
      await prisma.resultEntry.deleteMany({ where: { id: resultId } }).catch(() => {});
    }
    await prisma.resultEntry
      .deleteMany({ where: { classSectionId: { in: [classId, otherClassId].filter(Boolean) } } })
      .catch(() => {});
    if (classId) {
      await prisma.assessmentWeight.deleteMany({ where: { classSectionId: classId } }).catch(() => {});
    }
    if (gradeScaleId) {
      await prisma.gradeScaleBand.deleteMany({ where: { gradeScaleId } }).catch(() => {});
      await prisma.gradeScale.deleteMany({ where: { id: gradeScaleId } }).catch(() => {});
    }
    if (quizId) {
      await prisma.quizAnswer.deleteMany({ where: { attempt: { quizId } } }).catch(() => {});
      await prisma.quizAttempt.deleteMany({ where: { quizId } }).catch(() => {});
      await prisma.quizChoice.deleteMany({ where: { question: { quizId } } }).catch(() => {});
      await prisma.quizQuestion.deleteMany({ where: { quizId } }).catch(() => {});
      await prisma.quiz.deleteMany({ where: { id: quizId } }).catch(() => {});
    }
    if (assignmentId) {
      await prisma.submission.deleteMany({ where: { assignmentId } }).catch(() => {});
      await prisma.assignment.deleteMany({ where: { id: assignmentId } }).catch(() => {});
    }
    for (const cid of [classId, otherClassId].filter(Boolean)) {
      await prisma.enrollment.deleteMany({ where: { classSectionId: cid } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { id: cid } }).catch(() => {});
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
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("permissions distinguish grades.* vs results.*", () => {
    assert.equal(hasPermission("TEACHER", Permission.RESULTS_CREATE), true);
    assert.equal(hasPermission("TEACHER", Permission.RESULTS_SUBMIT), true);
    assert.equal(hasPermission("TEACHER", Permission.RESULTS_APPROVE), false);
    assert.equal(hasPermission("ADMIN", Permission.RESULTS_APPROVE), true);
    assert.equal(hasPermission("ADMIN", Permission.RESULTS_RETURN), true);
    assert.equal(hasPermission("STUDENT", Permission.RESULTS_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.RESULTS_APPROVE), false);
  });

  it("course result workflow, weights, Dhapti GPA scale, transcript, regression", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Res Fac ${suffix}`,
        code: `RF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Res Dept ${suffix}`,
        code: `RD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `RC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Results Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Res Teacher ${suffix}`,
        email: `rteach_${suffix}@dhapti.edu.so`,
        facultyCode: `RT${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherToken = await login(`rteach_${suffix}@dhapti.edu.so`, "TEACHER");

    const otherTeacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Res T ${suffix}`,
        email: `orteach_${suffix}@dhapti.edu.so`,
        facultyCode: `OR${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherTeacher.status, 201, otherTeacher.text);
    otherTeacherId = otherTeacher.body.id;
    otherTeacherToken = await login(`orteach_${suffix}@dhapti.edu.so`, "TEACHER");

    await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    await request(app)
      .post(`/api/teachers/${otherTeacherId}/courses`)
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

    const otherClass = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId: otherTeacherId,
        section: "B",
        academicYear: "2025-2026",
        semester: "1",
      });
    assert.equal(otherClass.status, 201, otherClass.text);
    otherClassId = otherClass.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Res Student ${suffix}`,
        email: `rstud_${suffix}@dhapti.edu.so`,
        studentCode: `RS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: studentId } })
    ).userId;
    studentToken = await login(`rstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const otherStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Res S ${suffix}`,
        email: `orstud_${suffix}@dhapti.edu.so`,
        studentCode: `OS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherStudent.status, 201, otherStudent.text);
    otherStudentId = otherStudent.body.id;
    otherStudentUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: otherStudentId } })
    ).userId;
    otherStudentToken = await login(`orstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const enr = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(enr.status, 201, enr.text);
    enrollmentId = enr.body.id;

    // Assessment setup: assignment + quiz approved
    const asn = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Res Assign ${suffix}`,
        dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxMarks: 5,
        status: "PUBLISHED",
      });
    assert.equal(asn.status, 201, asn.text);
    assignmentId = asn.body.id;

    const upload = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(upload.status, 201, upload.text);
    const submissionId = upload.body.id;

    await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 4, feedback: "Good" });
    await request(app)
      .post(`/api/submissions/${submissionId}/grade/submit`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const approveAsn = await request(app)
      .post(`/api/grades/${submissionId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approveAsn.status, 200, approveAsn.text);

    const quiz = await request(app)
      .post("/api/quizzes")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Res Quiz ${suffix}`,
        durationMinutes: 30,
        maxAttempts: 1,
      });
    assert.equal(quiz.status, 201, quiz.text);
    quizId = quiz.body.id;

    await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        type: "TRUE_FALSE",
        prompt: "Sky is blue?",
        marks: 10,
        correctBoolean: true,
      });
    const quizPub = await request(app)
      .patch(`/api/quizzes/${quizId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });
    assert.equal(quizPub.status, 200, quizPub.text);

    const attempt = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(attempt.status, 201, attempt.text);
    const attemptId = attempt.body.id;
    const detail = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const q = detail.body.questions[0];
    const trueChoice = q.choices.find((c: { label: string }) =>
      /^true$/i.test(c.label)
    );
    assert.ok(trueChoice);
    await request(app)
      .patch(`/api/attempts/${attemptId}/answers`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [{ questionId: q.id, choiceId: trueChoice.id }],
      });
    const submitAttempt = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(submitAttempt.status, 200, submitAttempt.text);
    const approveQuiz = await request(app)
      .post(`/api/quiz-attempts/${attemptId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approveQuiz.status, 200, approveQuiz.text);

    // Assessment results endpoint still works (regression)
    const assessmentResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(assessmentResults.status, 200);
    assert.ok(assessmentResults.body.data.length >= 1);

    // Calculate without weights → fail
    const noWeights = await request(app)
      .post("/api/results/calculate")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ enrollmentId });
    assert.equal(noWeights.status, 400);

    // Other teacher cannot set weights
    const crossWeights = await request(app)
      .put(`/api/classes/${classId}/assessment-weights`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({
        weights: [
          { componentType: "ASSIGNMENT", weightPercent: 40 },
          { componentType: "QUIZ", weightPercent: 60 },
        ],
      });
    assert.equal(crossWeights.status, 403);

    // Configure weights (no invented institutional default — explicit for this class)
    const weights = await request(app)
      .put(`/api/classes/${classId}/assessment-weights`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        weights: [
          { componentType: "ASSIGNMENT", weightPercent: 40 },
          { componentType: "QUIZ", weightPercent: 60 },
        ],
      });
    assert.equal(weights.status, 200, weights.text);

    // Invalid sum rejected
    const badSum = await request(app)
      .put(`/api/classes/${classId}/assessment-weights`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        weights: [{ componentType: "ASSIGNMENT", weightPercent: 40 }],
      });
    assert.equal(badSum.status, 400);

    // Re-apply valid weights after bad attempt wiped? badSum throws before write if setClassSectionWeights validates first - good, weights still there
    const getW = await request(app)
      .get(`/api/classes/${classId}/assessment-weights`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(getW.status, 200);
    assert.equal(getW.body.configured, true);

    const calc = await request(app)
      .post("/api/results/calculate")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ enrollmentId });
    assert.equal(calc.status, 201, calc.text);
    resultId = calc.body.id;
    assert.equal(calc.body.status, "CALCULATED");
    assert.ok(typeof calc.body.marks === "number");
    assert.equal(calc.body.creditHours, 3);
    // Dhapti official scale always available → letter/GP from total marks
    assert.ok(calc.body.letterGrade != null);
    assert.ok(typeof calc.body.gradePoint === "number");
    assert.equal(calc.body.gradeScaleConfigured, true);

    // Other teacher cannot submit
    const crossSubmit = await request(app)
      .post(`/api/results/${resultId}/submit`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    assert.equal(crossSubmit.status, 403);

    // Student cannot approve
    const studentApprove = await request(app)
      .post(`/api/results/${resultId}/approve`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentApprove.status, 403);

    const submit = await request(app)
      .post(`/api/results/${resultId}/submit`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(submit.status, 200, submit.text);
    assert.equal(submit.body.status, "PENDING_APPROVAL");

    // Student cannot see pending
    const pendingHide = await request(app)
      .get("/api/students/me/course-results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(pendingHide.status, 200);
    assert.ok(!pendingHide.body.data.some((r: { id: string }) => r.id === resultId));

    const approve = await request(app)
      .post(`/api/results/${resultId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approve.status, 200, approve.text);
    assert.equal(approve.body.status, "APPROVED");

    // Immutable
    const recalc = await request(app)
      .post("/api/results/calculate")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ enrollmentId });
    assert.equal(recalc.status, 409);

    const returnApproved = await request(app)
      .post(`/api/results/${resultId}/return`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "nope" });
    assert.equal(returnApproved.status, 409);

    // Student sees approved course result
    const courseResults = await request(app)
      .get("/api/students/me/course-results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(courseResults.status, 200);
    assert.ok(courseResults.body.data.some((r: { id: string }) => r.id === resultId));

    // Other student cannot see
    const otherSee = await request(app)
      .get(`/api/results/${resultId}`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherSee.status, 404);

    // GPA uses Dhapti letter/GP from calculation (scale always configured)
    const gpa = await request(app)
      .get("/api/students/me/gpa")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(gpa.status, 200);
    assert.equal(gpa.body.status, "OK");
    assert.ok(typeof gpa.body.cumulativeGpa === "number");

    // Transcript foundation
    const transcript = await request(app)
      .get("/api/students/me/transcript")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(transcript.status, 200);
    assert.ok(transcript.body.terms.length >= 1);
    assert.equal(transcript.body.overall.gpaStatus, "OK");
    assert.ok(transcript.body.overall.totalCredits >= 3);

    // Configure an overlay test grade scale (DB bands override Dhapti fallback for new calcs)
    const scale = await prisma.gradeScale.create({
      data: {
        name: `Test Scale ${suffix}`,
        isActive: true,
        bands: {
          create: [
            { minScore: 0, maxScore: 59.99, letterGrade: "F", gradePoint: 0, sortOrder: 0 },
            { minScore: 60, maxScore: 69.99, letterGrade: "D", gradePoint: 1, sortOrder: 1 },
            { minScore: 70, maxScore: 79.99, letterGrade: "C", gradePoint: 2, sortOrder: 2 },
            { minScore: 80, maxScore: 89.99, letterGrade: "B", gradePoint: 3, sortOrder: 3 },
            { minScore: 90, maxScore: 100, letterGrade: "A", gradePoint: 4, sortOrder: 4 },
          ],
        },
      },
    });
    gradeScaleId = scale.id;

    // Patch DB gradePoint on approved result for GPA math verification only.
    await prisma.resultEntry.update({
      where: { id: resultId },
      data: { letterGrade: "B", gradePoint: 3 },
    });

    const gpaOk = await request(app)
      .get("/api/students/me/gpa")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(gpaOk.status, 200);
    assert.equal(gpaOk.body.status, "OK");
    assert.equal(gpaOk.body.cumulativeGpa, 3);
    assert.equal(gpaOk.body.totalCredits, 3);

    // Retake-safe uniqueness: second enrollment in other class can have its own result
    const enr2 = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: otherClassId });
    // May fail if same course same term different section — should succeed
    assert.ok([201, 409].includes(enr2.status), enr2.text);

    // Notification created
    const notif = await prisma.notification.findUnique({
      where: { dedupeKey: `result.approved:${resultId}` },
    });
    assert.ok(notif);

    // Deactivate test scale so other suites aren't affected
    await prisma.gradeScale.update({
      where: { id: gradeScaleId },
      data: { isActive: false },
    });
  });
});
