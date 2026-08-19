import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

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

async function ensureFixture() {
  await fs.mkdir(fixturesDir, { recursive: true });
  const file = path.join(fixturesDir, "grade-report.pdf");
  await fs.writeFile(file, "%PDF-1.4 grading test content");
  return file;
}

describe("Phase 1F-C Grading, Marks & Results", () => {
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
  let assignmentId = "";
  let otherAssignmentId = "";
  let submissionId = "";
  let otherSubmissionId = "";
  let fixturePath = "";

  after(async () => {
    const classIds = [classId, otherClassId].filter(Boolean);
    if (classIds.length) {
      const asns = await prisma.assignment.findMany({
        where: { classSectionId: { in: classIds } },
        select: { id: true },
      });
      const asnIds = asns.map((a) => a.id);
      if (asnIds.length) {
        await prisma.submission.deleteMany({ where: { assignmentId: { in: asnIds } } }).catch(() => {});
        await prisma.assignment.deleteMany({ where: { id: { in: asnIds } } }).catch(() => {});
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

  it("rejects unauthenticated grade and approve access", async () => {
    fixturePath = await ensureFixture();
    const grade = await request(app).patch("/api/submissions/x/grade").send({ score: 10 });
    assert.equal(grade.status, 401);
    const approve = await request(app).post("/api/grades/x/approve");
    assert.equal(approve.status, 401);
    const results = await request(app).get("/api/students/me/results");
    assert.equal(results.status, 401);
  });

  it("full grading workflow with auth, validation, and student visibility", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Grade Fac ${suffix}`,
        code: `GF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Grade Dept ${suffix}`,
        code: `GD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `GC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Grading Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Grade Teacher ${suffix}`,
        email: `gteach_${suffix}@dhapti.edu.so`,
        facultyCode: `GT${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherToken = await login(`gteach_${suffix}@dhapti.edu.so`, "TEACHER");

    const otherTeacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Grade Teacher ${suffix}`,
        email: `ogteach_${suffix}@dhapti.edu.so`,
        facultyCode: `OG${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherTeacher.status, 201, otherTeacher.text);
    otherTeacherId = otherTeacher.body.id;
    otherTeacherToken = await login(`ogteach_${suffix}@dhapti.edu.so`, "TEACHER");

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
        fullName: `Grade Student ${suffix}`,
        email: `gstud_${suffix}@dhapti.edu.so`,
        studentCode: `GS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (await prisma.student.findUnique({ where: { id: studentId } }))!.userId;
    studentToken = await login(`gstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const otherStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Grade Student ${suffix}`,
        email: `ogstud_${suffix}@dhapti.edu.so`,
        studentCode: `OS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherStudent.status, 201, otherStudent.text);
    otherStudentId = otherStudent.body.id;
    otherStudentUserId = (
      await prisma.student.findUnique({ where: { id: otherStudentId } })
    )!.userId;
    otherStudentToken = await login(`ogstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const en1 = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(en1.status, 201, en1.text);

    const en2 = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: otherStudentId, classSectionId: otherClassId });
    assert.equal(en2.status, 201, en2.text);

    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const asn = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Graded Assignment ${suffix}`,
        maxMarks: 5,
        dueAt: due,
        status: "PUBLISHED",
      });
    assert.equal(asn.status, 201, asn.text);
    assignmentId = asn.body.id;

    const otherAsn = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({
        classSectionId: otherClassId,
        title: `Other Graded Assignment ${suffix}`,
        maxMarks: 5,
        dueAt: due,
        status: "PUBLISHED",
      });
    assert.equal(otherAsn.status, 201, otherAsn.text);
    otherAssignmentId = otherAsn.body.id;

    const upload = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(upload.status, 201, upload.text);
    submissionId = upload.body.id;

    const otherUpload = await request(app)
      .post(`/api/assignments/${otherAssignmentId}/submission`)
      .set("Authorization", `Bearer ${otherStudentToken}`)
      .attach("file", fixturePath);
    assert.equal(otherUpload.status, 201, otherUpload.text);
    otherSubmissionId = otherUpload.body.id;

    // Teacher cannot grade another teacher's submission
    const cross = await request(app)
      .patch(`/api/submissions/${otherSubmissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 2, feedback: "nope" });
    assert.equal(cross.status, 403);

    // Validation: negative / over Dhapti assignment cap
    const neg = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: -1 });
    assert.equal(neg.status, 400);

    const over = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 5.5 });
    assert.equal(over.status, 400);

    // Save grade (4.25 / 5 = 85%)
    const graded = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 4.25, feedback: "Solid work" });
    assert.equal(graded.status, 200, graded.text);
    assert.equal(graded.body.gradeStatus, "GRADED");
    assert.equal(graded.body.score, 4.25);
    assert.equal(graded.body.percentage, 85);

    // Student must NOT see unapproved mark on submission
    const ownSub = await request(app)
      .get(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(ownSub.status, 200);
    assert.equal(ownSub.body.submission.score, null);

    // Student results empty while pending
    let meResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(meResults.status, 200);
    assert.equal(meResults.body.data.length, 0);

    // Teacher cannot approve
    const teacherApprove = await request(app)
      .post(`/api/grades/${submissionId}/approve`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherApprove.status, 403);

    // Submit for approval
    const submitted = await request(app)
      .post(`/api/submissions/${submissionId}/grade/submit`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(submitted.status, 200, submitted.text);
    assert.equal(submitted.body.gradeStatus, "PENDING_APPROVAL");

    // Cannot edit while pending
    const editPending = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 4.5 });
    assert.equal(editPending.status, 409);

    // Admin list / filters
    const pendingList = await request(app)
      .get("/api/grades?status=PENDING_APPROVAL")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(pendingList.status, 200, pendingList.text);
    assert.ok(pendingList.body.data.some((g: { id: string }) => g.id === submissionId));
    assert.ok(pendingList.body.pagination);

    // Admin returns with reason
    const returned = await request(app)
      .post(`/api/grades/${submissionId}/return`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Please adjust feedback" });
    assert.equal(returned.status, 200, returned.text);
    assert.equal(returned.body.gradeStatus, "RETURNED");
    assert.equal(returned.body.returnReason, "Please adjust feedback");

    // Still hidden from student
    meResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(meResults.body.data.length, 0);

    // Teacher corrects and resubmits
    const corrected = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 4.4, feedback: "Revised feedback" });
    assert.equal(corrected.status, 200, corrected.text);
    assert.equal(corrected.body.gradeStatus, "GRADED");

    const resubmit = await request(app)
      .post(`/api/submissions/${submissionId}/grade/submit`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(resubmit.status, 200);
    assert.equal(resubmit.body.gradeStatus, "PENDING_APPROVAL");

    // Admin approves
    const approved = await request(app)
      .post(`/api/grades/${submissionId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.body.gradeStatus, "APPROVED");
    assert.equal(approved.body.percentage, 88);

    // Student sees own approved result
    meResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(meResults.status, 200);
    assert.equal(meResults.body.data.length, 1);
    assert.equal(meResults.body.data[0].score, 4.4);
    assert.equal(meResults.body.data[0].percentage, 88);
    assert.equal(meResults.body.data[0].maxMarks, 5);

    // Other student cannot see it
    const otherResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherResults.status, 200);
    assert.equal(otherResults.body.data.length, 0);

    // Approved immutable
    const immutable = await request(app)
      .patch(`/api/submissions/${submissionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 4.9 });
    assert.equal(immutable.status, 409);

    // Student submission view now shows approved marks
    const ownSubApproved = await request(app)
      .get(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(ownSubApproved.body.submission.score, 4.4);
  });
});
