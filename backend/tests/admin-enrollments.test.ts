import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

async function login(email: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "DHAPTI@2026" });
  assert.equal(res.status, 200, res.text);
  return res.body.token as string;
}

describe("Phase 1E-A Student Enrollment Core", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let classId = "";
  let studentId = "";
  let studentUserId = "";
  let enrollmentId = "";
  let otherStudentId = "";
  let otherStudentUserId = "";

  after(async () => {
    if (classId) {
      await prisma.enrollment
        .deleteMany({ where: { classSectionId: classId } })
        .catch(() => {});
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
    for (const userId of [studentUserId, otherStudentUserId].filter(Boolean)) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("rejects unauthenticated enrollment list", async () => {
    const res = await request(app).get("/api/enrollments");
    assert.equal(res.status, 401);
  });

  it("admin enrolls ACTIVE student; student self-reads; rules enforced", async () => {
    adminToken = await login("admin@dhapti.edu.so");
    teacherToken = await login("mohamed.ali@dhapti.edu.so");
    studentToken = await login("mohamudcade143@gmail.com");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Enr Fac ${suffix}`,
        code: `EF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Enr Dept ${suffix}`,
        code: `ED${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `EC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Enrollment Course ${suffix}`,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacherEmail = `enr.t.${suffix}@dhapti.edu.so`;
    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Enr Teacher ${suffix}`,
        email: teacherEmail,
        facultyCode: `FAC-E-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    // Use the owning teacher JWT (not the seeded demo teacher)
    teacherToken = await login(teacherEmail);

    const assign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(assign.status, 201, assign.text);

    const cls = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
        room: "R1",
      });
    assert.equal(cls.status, 201, cls.text);
    classId = cls.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Enr Student ${suffix}`,
        email: `enr.s.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-E-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
        program: "BSc CS",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    const studentRow = await prisma.student.findUnique({ where: { id: studentId } });
    assert.ok(studentRow);
    studentUserId = studentRow!.userId;

    const other = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Enr ${suffix}`,
        email: `enr.o.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-O-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
      });
    assert.equal(other.status, 201, other.text);
    otherStudentId = other.body.id;
    const otherRow = await prisma.student.findUnique({ where: { id: otherStudentId } });
    otherStudentUserId = otherRow!.userId;

    const studentCreate = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(studentCreate.status, 403);

    const teacherCreate = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(teacherCreate.status, 403);

    const badStudent = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: "missing-student", classSectionId: classId });
    assert.equal(badStudent.status, 404);

    const badClass = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: "missing-class" });
    assert.equal(badClass.status, 404);

    const created = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(created.status, 201, created.text);
    enrollmentId = created.body.id;
    assert.equal(created.body.accountStatus, "ACTIVE");
    assert.equal(created.body.classSectionId, classId);
    assert.equal(created.body.course.id, courseId);
    assert.equal(created.body.teacher.id, teacherId);

    const persisted = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    assert.ok(persisted);
    assert.equal(persisted!.studentId, studentId);
    assert.equal(persisted!.classSectionId, classId);

    const dup = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(dup.status, 409);

    const list = await request(app)
      .get(`/api/enrollments?studentId=${studentId}&classSectionId=${classId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.pagination);
    assert.ok(list.body.data.some((e: { id: string }) => e.id === enrollmentId));

    const classStudents = await request(app)
      .get(`/api/classes/${classId}/students`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(classStudents.status, 200);
    assert.ok(
      classStudents.body.data.some(
        (s: { studentId: string }) => s.studentId === studentId
      )
    );

    const teacherClassStudents = await request(app)
      .get(`/api/classes/${classId}/students`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherClassStudents.status, 200);
    assert.ok(
      teacherClassStudents.body.data.some(
        (s: { studentId: string; attendancePercent: number | null }) =>
          s.studentId === studentId && "attendancePercent" in s
      )
    );

    const otherTeacherLogin = await login("mohamed.ali@dhapti.edu.so");
    const otherTeacherRoster = await request(app)
      .get(`/api/classes/${classId}/students`)
      .set("Authorization", `Bearer ${otherTeacherLogin}`);
    assert.equal(otherTeacherRoster.status, 403);

    const studentLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `enr.s.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "STUDENT",
      });
    assert.equal(studentLogin.status, 200, studentLogin.text);
    const ownToken = studentLogin.body.token as string;

    const me = await request(app)
      .get("/api/students/me/enrollments")
      .set("Authorization", `Bearer ${ownToken}`);
    assert.equal(me.status, 200);
    assert.ok(me.body.data.some((e: { id: string }) => e.id === enrollmentId));
    assert.ok(
      me.body.data.every((e: { studentId: string }) => e.studentId === studentId)
    );

    const meAlias = await request(app)
      .get("/api/enrollments/me")
      .set("Authorization", `Bearer ${ownToken}`);
    assert.equal(meAlias.status, 200);
    assert.ok(meAlias.body.data.some((e: { id: string }) => e.id === enrollmentId));

    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: `enr.o.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "STUDENT",
      });
    assert.equal(otherLogin.status, 200);
    const otherToken = otherLogin.body.token as string;
    const otherMe = await request(app)
      .get("/api/students/me/enrollments")
      .set("Authorization", `Bearer ${otherToken}`);
    assert.equal(otherMe.status, 200);
    assert.ok(
      !otherMe.body.data.some((e: { id: string }) => e.id === enrollmentId)
    );

    const teacherModify = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/status`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ status: "DROPPED" });
    assert.equal(teacherModify.status, 403);

    const deactivate = await request(app)
      .delete(`/api/enrollments/${enrollmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.deactivated, true);
    assert.equal(deactivate.body.enrollment.accountStatus, "DROPPED");

    const stillThere = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    assert.ok(stillThere);
    assert.equal(stillThere!.status, "DROPPED");

    const reactivate = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });
    assert.equal(reactivate.status, 200);
    assert.equal(reactivate.body.accountStatus, "ACTIVE");

    await request(app)
      .delete(`/api/enrollments/${enrollmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const reactivateViaPost = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(reactivateViaPost.status, 200);
    assert.equal(reactivateViaPost.body.id, enrollmentId);
    assert.equal(reactivateViaPost.body.accountStatus, "ACTIVE");
  });

  it("rejects inactive student, class, and course for new enrollment", async () => {
    const inactiveStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Inactive Enr ${suffix}`,
        email: `enr.i.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-I-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
      });
    assert.equal(inactiveStudent.status, 201, inactiveStudent.text);
    const inactiveId = inactiveStudent.body.id;
    const inactiveRow = await prisma.student.findUnique({
      where: { id: inactiveId },
    });
    assert.ok(inactiveRow);

    await request(app)
      .patch(`/api/students/${inactiveId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });

    const rejectInactiveStudent = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: inactiveId, classSectionId: classId });
    assert.equal(rejectInactiveStudent.status, 400);

    await request(app)
      .patch(`/api/classes/${classId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });

    const rejectInactiveClass = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(rejectInactiveClass.status, 400);

    await request(app)
      .patch(`/api/classes/${classId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });

    await request(app)
      .patch(`/api/courses/${courseId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });

    const rejectInactiveCourse = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.equal(rejectInactiveCourse.status, 400);

    await request(app)
      .patch(`/api/courses/${courseId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });

    // cleanup inactive student user
    await prisma.user.delete({ where: { id: inactiveRow!.userId } }).catch(() => {});
  });
});
