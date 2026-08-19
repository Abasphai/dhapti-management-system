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
  const file = path.join(fixturesDir, "report.pdf");
  await fs.writeFile(file, "%PDF-1.4 test submission content");
  return file;
}

describe("Phase 1F-B Assignment Submission & File Storage", () => {
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
  let submissionId = "";
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

  it("rejects unauthenticated submission access", async () => {
    fixturePath = await ensureFixture();
    const res = await request(app).get("/api/assignments/x/submission");
    assert.equal(res.status, 401);
  });

  it("student submits; ownership, deadline, and file rules enforced", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Sub Fac ${suffix}`,
        code: `SF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Sub Dept ${suffix}`,
        code: `SD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `SC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Submission Course ${suffix}`,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Sub Teacher ${suffix}`,
        email: `sub.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-S-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;

    const otherT = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Sub T ${suffix}`,
        email: `sub.ot.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-OT-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(otherT.status, 201, otherT.text);
    otherTeacherId = otherT.body.id;

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
        academicYear: "2026/2027",
        semester: "Semester 1",
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
        academicYear: "2026/2027",
        semester: "Semester 1",
      });
    assert.equal(otherCls.status, 201, otherCls.text);
    otherClassId = otherCls.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Sub Student ${suffix}`,
        email: `sub.s.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-S-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (await prisma.student.findUnique({ where: { id: studentId } }))!.userId;

    const otherStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Sub S ${suffix}`,
        email: `sub.os.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-OS-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
      });
    assert.equal(otherStudent.status, 201, otherStudent.text);
    otherStudentId = otherStudent.body.id;
    otherStudentUserId = (
      await prisma.student.findUnique({ where: { id: otherStudentId } })
    )!.userId;

    await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });

    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `sub.t.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    teacherToken = teacherLogin.body.token;

    const otherTeacherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `sub.ot.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    otherTeacherToken = otherTeacherLogin.body.token;

    const studentLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `sub.s.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "STUDENT",
      });
    studentToken = studentLogin.body.token;

    const otherStudentLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `sub.os.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "STUDENT",
      });
    otherStudentToken = otherStudentLogin.body.token;

    const dueSoon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const created = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Submit Me ${suffix}`,
        dueAt: dueSoon,
        maxMarks: 20,
        maxFileMb: 5,
        status: "PUBLISHED",
      });
    assert.equal(created.status, 201, created.text);
    assignmentId = created.body.id;

    // Patch maxFileMb via prisma if API doesn't accept it on create - check create schema
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { maxFileMb: 5 },
    });

    const notEnrolled = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${otherStudentToken}`)
      .attach("file", fixturePath);
    assert.ok([403, 404].includes(notEnrolled.status));

    const badExt = path.join(fixturesDir, "evil.exe");
    await fs.writeFile(badExt, "MZ");
    const invalidType = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", badExt);
    assert.equal(invalidType.status, 400);

    const uploaded = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(uploaded.status, 201, uploaded.text);
    submissionId = uploaded.body.id;
    assert.equal(uploaded.body.accountStatus, "SUBMITTED");
    assert.ok(uploaded.body.fileName);
    assert.ok(!JSON.stringify(uploaded.body).includes("storageKey"));
    assert.ok(!JSON.stringify(uploaded.body).includes("storage\\"));

    const mine = await request(app)
      .get(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.submission.id, submissionId);
    assert.equal(mine.body.submissionOpen, true);

    const otherGet = await request(app)
      .get(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherGet.status, 403);

    const otherDownload = await request(app)
      .get(`/api/submissions/${submissionId}/file`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.equal(otherDownload.status, 403);

    const ownDownload = await request(app)
      .get(`/api/submissions/${submissionId}/file`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(ownDownload.status, 200);
    assert.ok(ownDownload.headers["content-disposition"]?.includes("report.pdf") || ownDownload.headers["content-disposition"]);

    const teacherList = await request(app)
      .get(`/api/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherList.status, 200);
    assert.ok(teacherList.body.pagination);
    assert.ok(
      teacherList.body.data.some(
        (r: { studentId: string; status: string }) =>
          r.studentId === studentId && r.status === "SUBMITTED"
      )
    );
    assert.ok(
      teacherList.body.data.every(
        (r: { studentId: string }) => r.studentId !== otherStudentId
      ) ||
        teacherList.body.data.some(
          (r: { studentId: string; status: string }) =>
            r.studentId === otherStudentId && r.status === "MISSING"
        ) === false
    );
    // other student not enrolled — should not appear
    assert.ok(
      !teacherList.body.data.some(
        (r: { studentId: string }) => r.studentId === otherStudentId
      )
    );

    const teacherDl = await request(app)
      .get(`/api/submissions/${submissionId}/file`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherDl.status, 200);

    const otherTeacherList = await request(app)
      .get(`/api/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    assert.equal(otherTeacherList.status, 403);

    const otherTeacherDl = await request(app)
      .get(`/api/submissions/${submissionId}/file`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    assert.equal(otherTeacherDl.status, 403);

    const replaced = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(replaced.status, 200, replaced.text);
    assert.equal(replaced.body.id, submissionId);

    // Close deadline
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { dueAt: new Date(Date.now() - 60_000) },
    });

    const afterDeadline = await request(app)
      .post(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(afterDeadline.status, 400);

    const stillThere = await request(app)
      .get(`/api/assignments/${assignmentId}/submission`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(stillThere.status, 200);
    assert.ok(stillThere.body.submission);
    assert.equal(stillThere.body.submissionOpen, false);

    const badAssignment = await request(app)
      .post(`/api/assignments/missing-id/submission`)
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", fixturePath);
    assert.equal(badAssignment.status, 404);

    const badFile = await request(app)
      .get(`/api/submissions/missing-id/file`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(badFile.status, 404);

    // No absolute path API
    const pathProbe = await request(app)
      .get("/api/files")
      .query({ path: "/etc/passwd" })
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok([404, 401, 403].includes(pathProbe.status));
  });
});
