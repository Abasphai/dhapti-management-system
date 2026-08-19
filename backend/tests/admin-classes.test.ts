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

describe("Phase 1D-B Classes & Sections", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let otherTeacherId = "";
  let classId = "";

  after(async () => {
    const classIds = classId ? [classId] : [];
    if (courseId || teacherId || otherTeacherId) {
      const related = await prisma.classSection.findMany({
        where: {
          OR: [
            courseId ? { courseId } : undefined,
            teacherId || otherTeacherId
              ? { teacherId: { in: [teacherId, otherTeacherId].filter(Boolean) } }
              : undefined,
          ].filter(Boolean) as { courseId?: string; teacherId?: { in: string[] } }[],
        },
        select: { id: true },
      });
      classIds.push(...related.map((r) => r.id));
    }
    if (classIds.length) {
      await prisma.enrollment
        .deleteMany({ where: { classSectionId: { in: classIds } } })
        .catch(() => {});
    }
    if (classId) {
      await prisma.classSection.deleteMany({ where: { id: classId } }).catch(() => {});
    }
    await prisma.classSection
      .deleteMany({
        where: {
          OR: [
            { courseId: courseId || undefined },
            { teacherId: { in: [teacherId, otherTeacherId].filter(Boolean) } },
          ],
        },
      })
      .catch(() => {});
    await prisma.courseTeacher
      .deleteMany({
        where: {
          OR: [
            { courseId: courseId || undefined },
            { teacherId: { in: [teacherId, otherTeacherId].filter(Boolean) } },
          ],
        },
      })
      .catch(() => {});
    if (courseId) await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    for (const id of [teacherId, otherTeacherId].filter(Boolean)) {
      const t = await prisma.teacher.findUnique({ where: { id } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("rejects unauthenticated class list", async () => {
    const res = await request(app).get("/api/classes");
    assert.equal(res.status, 401);
  });

  it("admin can create/list/filter/search/paginate/edit/deactivate class", async () => {
    adminToken = await login("admin@dhapti.edu.so");
    teacherToken = await login("mohamed.ali@dhapti.edu.so");
    studentToken = await login("mohamudcade143@gmail.com");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Class Fac ${suffix}`,
        code: `CF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Class Dept ${suffix}`,
        code: `CD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `CC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Class Course ${suffix}`,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Class Teacher ${suffix}`,
        email: `class.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-T-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;

    const other = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Class T ${suffix}`,
        email: `class.o.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-O-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(other.status, 201, other.text);
    otherTeacherId = other.body.id;

    // Assign course only to first teacher
    const assign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.equal(assign.status, 201, assign.text);

    const studentCreate = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
      });
    assert.equal(studentCreate.status, 403);

    const teacherCreate = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
      });
    assert.equal(teacherCreate.status, 403);

    const unassigned = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId: otherTeacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
        room: "Lab 1",
        dayOfWeek: "Mon / Wed",
        startTime: "08:00",
        endTime: "10:00",
      });
    assert.equal(unassigned.status, 400);

    const created = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
        room: "Lab 1",
        dayOfWeek: "Mon / Wed",
        startTime: "08:00",
        endTime: "10:00",
      });
    assert.equal(created.status, 201, created.text);
    classId = created.body.id;
    assert.equal(created.body.section, "A");
    assert.equal(created.body.courseId, courseId);
    assert.equal(created.body.teacherId, teacherId);
    assert.ok(created.body.schedule);

    const dup = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
      });
    assert.equal(dup.status, 409);

    const list = await request(app)
      .get(`/api/classes?courseId=${courseId}&page=1&pageSize=10`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((c: { id: string }) => c.id === classId));
    assert.ok(list.body.pagination.total >= 1);

    const byDept = await request(app)
      .get(`/api/classes?departmentId=${departmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(byDept.status, 200);
    assert.ok(byDept.body.data.some((c: { id: string }) => c.id === classId));

    const byFac = await request(app)
      .get(`/api/classes?facultyId=${facultyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(byFac.status, 200);
    assert.ok(byFac.body.data.some((c: { id: string }) => c.id === classId));

    const search = await request(app)
      .get(`/api/classes?q=Lab 1`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.data.some((c: { id: string }) => c.id === classId));

    const patch = await request(app)
      .patch(`/api/classes/${classId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ room: "Lab 2", section: "A" });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.room, "Lab 2");

    const deactivate = await request(app)
      .delete(`/api/classes/${classId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.deactivated, true);
    assert.equal(deactivate.body.class.accountStatus, "INACTIVE");

    await request(app)
      .patch(`/api/classes/${classId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });
  });

  it("teacher sees only own classes via /me/classes", async () => {
    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({
        email: `class.t.${suffix}@dhapti.edu.so`,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    assert.equal(loginNew.status, 200, loginNew.text);
    const newToken = loginNew.body.token as string;

    const mine = await request(app)
      .get("/api/teachers/me/classes")
      .set("Authorization", `Bearer ${newToken}`);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.some((c: { id: string }) => c.id === classId));

    const seeded = await request(app)
      .get("/api/teachers/me/classes")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(seeded.status, 200);
    assert.ok(!seeded.body.data.some((c: { id: string }) => c.id === classId));

    const studentMe = await request(app)
      .get("/api/teachers/me/classes")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentMe.status, 403);

    const teacherAdminList = await request(app)
      .get("/api/classes")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherAdminList.status, 403);
  });
});
