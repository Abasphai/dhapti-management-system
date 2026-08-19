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

describe("Phase 1D-A Teacher ↔ Course Assignment", () => {
  const suffix = Date.now().toString(36);
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let otherTeacherId = "";
  let inactiveTeacherId = "";
  let inactiveCourseId = "";

  after(async () => {
    await prisma.courseTeacher
      .deleteMany({
        where: {
          OR: [
            { teacherId: { in: [teacherId, otherTeacherId, inactiveTeacherId].filter(Boolean) } },
            { courseId: { in: [courseId, inactiveCourseId].filter(Boolean) } },
          ],
        },
      })
      .catch(() => {});

    for (const id of [courseId, inactiveCourseId].filter(Boolean)) {
      await prisma.course.deleteMany({ where: { id } }).catch(() => {});
    }
    for (const id of [teacherId, otherTeacherId, inactiveTeacherId].filter(Boolean)) {
      const t = await prisma.teacher.findUnique({ where: { id } });
      if (t) {
        await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
      }
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("rejects unauthenticated assignment", async () => {
    const res = await request(app)
      .post("/api/teachers/x/courses")
      .send({ courseId: "y" });
    assert.equal(res.status, 401);
  });

  it("admin can assign, list, duplicate-conflict, and remove", async () => {
    adminToken = await login("admin@dhapti.edu.so");
    teacherToken = await login("mohamed.ali@dhapti.edu.so");
    studentToken = await login("mohamudcade143@gmail.com");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Assign Fac ${suffix}`,
        code: `AF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Assign Dept ${suffix}`,
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
        title: `Assignable Course ${suffix}`,
        departmentId,
        credits: 3,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Assign Teacher ${suffix}`,
        email: `assign.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-A-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
        designation: "Lecturer",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;

    const other = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Teacher ${suffix}`,
        email: `other.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-O-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(other.status, 201, other.text);
    otherTeacherId = other.body.id;

    const studentAssign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId });
    assert.equal(studentAssign.status, 403);

    const teacherAssign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ courseId });
    assert.equal(teacherAssign.status, 403);

    const assign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(assign.status, 201, assign.text);
    assert.equal(assign.body.courseId, courseId);
    assert.equal(assign.body.code, course.body.code);

    const dup = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(dup.status, 409);

    const list = await request(app)
      .get(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((c: { courseId: string }) => c.courseId === courseId));

    const courseTeachers = await request(app)
      .get(`/api/courses/${courseId}/teachers`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(courseTeachers.status, 200);
    assert.ok(
      courseTeachers.body.data.some(
        (t: { teacherId: string }) => t.teacherId === teacherId
      )
    );

    const teacherRemove = await request(app)
      .delete(`/api/teachers/${teacherId}/courses/${courseId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherRemove.status, 403);

    const remove = await request(app)
      .delete(`/api/teachers/${teacherId}/courses/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(remove.status, 200);
    assert.equal(remove.body.removed, true);

    const listAfter = await request(app)
      .get(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(listAfter.status, 200);
    assert.ok(
      !listAfter.body.data.some((c: { courseId: string }) => c.courseId === courseId)
    );

    // re-assign for teacher me/courses test
    const reassign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(reassign.status, 201);
  });

  it("rejects inactive teacher and inactive course", async () => {
    const inactiveTeacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Inactive T ${suffix}`,
        email: `inactive.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-IN-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(inactiveTeacher.status, 201, inactiveTeacher.text);
    inactiveTeacherId = inactiveTeacher.body.id;

    await request(app)
      .patch(`/api/teachers/${inactiveTeacherId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });

    const badTeacher = await request(app)
      .post(`/api/teachers/${inactiveTeacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(badTeacher.status, 400);

    const inactiveCourse = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `IC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Inactive Course ${suffix}`,
        departmentId,
      });
    assert.equal(inactiveCourse.status, 201);
    inactiveCourseId = inactiveCourse.body.id;

    await request(app)
      .patch(`/api/courses/${inactiveCourseId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });

    const badCourse = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId: inactiveCourseId });
    assert.equal(badCourse.status, 400);

    const missingTeacher = await request(app)
      .post(`/api/teachers/nonexistent-teacher/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(missingTeacher.status, 404);

    const missingCourse = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId: "nonexistent-course" });
    assert.equal(missingCourse.status, 404);
  });

  it("seeded teacher sees only own assigned courses via /me/courses", async () => {
    // Assign course to other teacher as well — me endpoint must not leak
    await request(app)
      .post(`/api/teachers/${otherTeacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });

    const meAsStudent = await request(app)
      .get("/api/teachers/me/courses")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(meAsStudent.status, 403);

    // Login as newly created teacher
    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({
        email: `assign.t.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    assert.equal(loginNew.status, 200, loginNew.text);
    const newTeacherToken = loginNew.body.token as string;

    const mine = await request(app)
      .get("/api/teachers/me/courses")
      .set("Authorization", `Bearer ${newTeacherToken}`);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.some((c: { courseId: string }) => c.courseId === courseId));

    // Seeded teacher should not see the test assignment unless also assigned
    const seeded = await request(app)
      .get("/api/teachers/me/courses")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(seeded.status, 200);
    assert.ok(
      !seeded.body.data.some((c: { courseId: string }) => c.courseId === courseId)
    );

    const teacherCannotListOther = await request(app)
      .get(`/api/teachers/${otherTeacherId}/courses`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherCannotListOther.status, 403);
  });
});
