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

describe("Teacher assigned courses sync to My Classes", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let teacherToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";

  after(async () => {
    if (teacherId) {
      await prisma.classSection
        .deleteMany({ where: { teacherId } })
        .catch(() => {});
      await prisma.courseTeacher
        .deleteMany({ where: { teacherId } })
        .catch(() => {});
      const t = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    if (courseId) {
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department
        .deleteMany({ where: { id: departmentId } })
        .catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("auto-creates ClassSection A when course is assigned but no section exists", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Sync Fac ${suffix}`,
        code: `SF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Sync Dept ${suffix}`,
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
        title: `Sync Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Sync Teacher ${suffix}`,
        email: `sync_t_${suffix}@dhapti.edu.so`,
        facultyCode: `ST${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherToken = await login(`sync_t_${suffix}@dhapti.edu.so`, "TEACHER");

    // Assign course without creating a ClassSection manually
    const assign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(assign.status, 201, assign.text);

    const classes = await request(app)
      .get("/api/teachers/me/classes")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(classes.status, 200, classes.text);
    assert.ok(
      classes.body.data.some(
        (c: { courseId: string; section: string }) =>
          c.courseId === courseId && c.section === "A"
      ),
      "assigned course should appear as ClassSection A on My Classes"
    );

    const sessions = await request(app)
      .get("/api/teachers/me/sessions")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(sessions.status, 200, sessions.text);
    assert.ok(
      sessions.body.data.some(
        (r: { classSection: { id: string; courseCode: string } }) =>
          r.classSection.courseCode === course.body.code
      )
    );

    const checkIn = await request(app)
      .post("/api/teacher/attendance/check-in")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        classSectionId: classes.body.data.find(
          (c: { courseId: string }) => c.courseId === courseId
        ).id,
      });
    assert.equal(checkIn.status, 200, checkIn.text);
    assert.equal(checkIn.body.accountStatus, "OPEN");
    assert.equal(checkIn.body.teacherAttendance?.status, "ACTIVE");

    await request(app)
      .post("/api/teacher/attendance/check-out")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        sessionId: checkIn.body.id,
        confirmEarlyExit: true,
      });
  });

  it("seeded Mohamed teacher has ClassSections for assigned courses", async () => {
    const token = await login("mohamed.ali@dhapti.edu.so", "TEACHER");
    const courses = await request(app)
      .get("/api/teachers/me/courses")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(courses.status, 200, courses.text);
    assert.ok(courses.body.data.length >= 1);

    const classes = await request(app)
      .get("/api/teachers/me/classes")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(classes.status, 200, classes.text);

    const courseIds = new Set(
      courses.body.data.map((c: { courseId: string }) => c.courseId)
    );
    const classCourseIds = new Set(
      classes.body.data.map((c: { courseId: string }) => c.courseId)
    );
    for (const id of courseIds) {
      assert.ok(
        classCourseIds.has(id),
        `assigned course ${id} should have a ClassSection on My Classes`
      );
    }
  });
});
