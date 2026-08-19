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

describe("Phase 1F-A Assignment Core", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let otherTeacherToken = "";
  let studentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let otherTeacherId = "";
  let classId = "";
  let otherClassId = "";
  let studentId = "";
  let studentUserId = "";
  let assignmentId = "";
  let draftId = "";

  after(async () => {
    const classIds = [classId, otherClassId].filter(Boolean);
    if (classIds.length) {
      await prisma.assignment
        .deleteMany({ where: { classSectionId: { in: classIds } } })
        .catch(() => {});
      await prisma.enrollment
        .deleteMany({ where: { classSectionId: { in: classIds } } })
        .catch(() => {});
      await prisma.classSection
        .deleteMany({ where: { id: { in: classIds } } })
        .catch(() => {});
    }
    if (courseId) {
      await prisma.courseTeacher.deleteMany({ where: { courseId } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    for (const id of [teacherId, otherTeacherId].filter(Boolean)) {
      const t = await prisma.teacher.findUnique({ where: { id } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    if (studentUserId) {
      await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("rejects unauthenticated assignment list", async () => {
    const res = await request(app).get("/api/assignments/me");
    assert.equal(res.status, 401);
  });

  it("teacher creates/publishes; ownership and student visibility enforced", async () => {
    adminToken = await login("admin@dhapti.edu.so");
    teacherToken = await login("mohamed.ali@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Asn Fac ${suffix}`,
        code: `AF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Asn Dept ${suffix}`,
        code: `AD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `AC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Assignment Course ${suffix}`,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Asn Teacher ${suffix}`,
        email: `asn.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-A-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;

    const other = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Asn T ${suffix}`,
        email: `asn.o.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-B-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(other.status, 201, other.text);
    otherTeacherId = other.body.id;

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
        fullName: `Asn Student ${suffix}`,
        email: `asn.s.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-A-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    const studentRow = await prisma.student.findUnique({ where: { id: studentId } });
    studentUserId = studentRow!.userId;

    await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });

    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `asn.t.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    assert.equal(teacherLogin.status, 200, teacherLogin.text);
    teacherToken = teacherLogin.body.token;

    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `asn.o.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    assert.equal(otherLogin.status, 200);
    otherTeacherToken = otherLogin.body.token;

    const studentLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `asn.s.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "STUDENT",
      });
    assert.equal(studentLogin.status, 200);
    studentToken = studentLogin.body.token;

    const studentCreate = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        classSectionId: classId,
        title: "Should fail",
        dueAt: new Date("2026-09-15T23:59:00.000Z").toISOString(),
        maxMarks: 20,
      });
    assert.equal(studentCreate.status, 403);

    const wrongClass = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: otherClassId,
        title: "Other class assignment",
        dueAt: new Date("2026-09-15T23:59:00.000Z").toISOString(),
        maxMarks: 20,
      });
    assert.equal(wrongClass.status, 403);

    const badClass = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: "missing-class",
        title: "Bad class",
        dueAt: new Date("2026-09-15T23:59:00.000Z").toISOString(),
      });
    assert.equal(badClass.status, 404);

    const badDue = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: "Bad due",
        dueAt: "not-a-date",
        maxMarks: 20,
      });
    assert.equal(badDue.status, 400);

    const badMarks = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: "Bad marks",
        dueAt: new Date("2026-09-15T23:59:00.000Z").toISOString(),
        maxMarks: -5,
      });
    assert.equal(badMarks.status, 400);

    const draft = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classId,
        title: `Draft Assignment ${suffix}`,
        description: "Read the chapter",
        instructions: "Submit PDF later",
        dueAt: new Date("2026-09-15T23:59:00.000Z").toISOString(),
        maxMarks: 20,
      });
    assert.equal(draft.status, 201, draft.text);
    draftId = draft.body.id;
    assert.equal(draft.body.accountStatus, "DRAFT");
    assert.equal(draft.body.classSectionId, classId);
    assert.equal(draft.body.maxMarks, 20);

    const studentDraft = await request(app)
      .get("/api/students/me/assignments")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentDraft.status, 200);
    assert.ok(
      !studentDraft.body.data.some((a: { id: string }) => a.id === draftId)
    );

    const published = await request(app)
      .patch(`/api/assignments/${draftId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "PUBLISHED" });
    assert.equal(published.status, 200);
    assert.equal(published.body.accountStatus, "PUBLISHED");
    assignmentId = draftId;

    const mine = await request(app)
      .get("/api/assignments/me")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.some((a: { id: string }) => a.id === assignmentId));

    const edited = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: `Updated Assignment ${suffix}`, maxMarks: 25 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.maxMarks, 25);

    const otherEdit = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({ title: "Hijack" });
    assert.equal(otherEdit.status, 403);

    const studentVisible = await request(app)
      .get("/api/students/me/assignments")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentVisible.status, 200);
    assert.ok(
      studentVisible.body.data.some((a: { id: string }) => a.id === assignmentId)
    );

    const studentGet = await request(app)
      .get(`/api/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentGet.status, 200);

    const studentModify = await request(app)
      .patch(`/api/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Nope" });
    assert.equal(studentModify.status, 403);

    // Other class published assignment — student not enrolled
    const otherAsn = await request(app)
      .post("/api/assignments")
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({
        classSectionId: otherClassId,
        title: `Other Sec Assignment ${suffix}`,
        dueAt: new Date("2026-10-01T23:59:00.000Z").toISOString(),
        maxMarks: 10,
        status: "PUBLISHED",
      });
    assert.equal(otherAsn.status, 201, otherAsn.text);

    const studentOther = await request(app)
      .get("/api/students/me/assignments")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok(
      !studentOther.body.data.some((a: { id: string }) => a.id === otherAsn.body.id)
    );

    const studentOtherGet = await request(app)
      .get(`/api/assignments/${otherAsn.body.id}`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentOtherGet.status, 404);

    const archived = await request(app)
      .delete(`/api/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(archived.status, 200);
    assert.equal(archived.body.archived, true);
    assert.equal(archived.body.assignment.accountStatus, "ARCHIVED");

    const studentAfterArchive = await request(app)
      .get("/api/students/me/assignments")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.ok(
      !studentAfterArchive.body.data.some(
        (a: { id: string }) => a.id === assignmentId
      )
    );

    const seededStudent = await login("mohamudcade143@gmail.com");
    const seededList = await request(app)
      .get("/api/students/me/assignments")
      .set("Authorization", `Bearer ${seededStudent}`);
    assert.equal(seededList.status, 200);
    assert.ok(
      !seededList.body.data.some((a: { id: string }) => a.id === assignmentId)
    );
  });
});
