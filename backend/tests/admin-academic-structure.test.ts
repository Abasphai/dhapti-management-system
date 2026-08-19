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

describe("Phase 1C Academic Structure", () => {
  const suffix = Date.now().toString(36);
  let adminToken = "";
  let studentToken = "";
  let teacherToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";

  after(async () => {
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

  it("rejects unauthenticated faculty list", async () => {
    const res = await request(app).get("/api/faculties");
    assert.equal(res.status, 401);
  });

  it("blocks student/teacher from faculty create", async () => {
    studentToken = await login("mohamudcade143@gmail.com");
    teacherToken = await login("mohamed.ali@dhapti.edu.so");
    adminToken = await login("admin@dhapti.edu.so");

    const studentRes = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ name: "X", code: `X${suffix}` });
    assert.equal(studentRes.status, 403);

    const teacherRes = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "X", code: `Y${suffix}` });
    assert.equal(teacherRes.status, 403);
  });

  it("admin faculty create/read/update/search/paginate/deactivate", async () => {
    const code = `FA${suffix}`.slice(0, 12).toUpperCase();
    const create = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Test Faculty ${suffix}`,
        code,
        description: "Phase 1C test faculty",
      });
    assert.equal(create.status, 201, create.text);
    facultyId = create.body.id;
    assert.equal(create.body.code, code);
    assert.equal(create.body.status, "Active");

    const dup = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Dup", code });
    assert.equal(dup.status, 409);

    const get = await request(app)
      .get(`/api/faculties/${facultyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(get.status, 200);
    assert.equal(get.body.id, facultyId);

    const patch = await request(app)
      .patch(`/api/faculties/${facultyId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ description: "Updated desc" });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.description, "Updated desc");

    const search = await request(app)
      .get(`/api/faculties?q=${code}&page=1&pageSize=5`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(search.status, 200);
    assert.ok(Array.isArray(search.body.data));
    assert.ok(search.body.pagination.total >= 1);
    assert.ok(search.body.data.some((f: { id: string }) => f.id === facultyId));

    const status = await request(app)
      .patch(`/api/faculties/${facultyId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });
    assert.equal(status.status, 200);
    assert.equal(status.body.accountStatus, "INACTIVE");

    await request(app)
      .patch(`/api/faculties/${facultyId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });
  });

  it("admin department create with faculty FK; rejects invalid faculty", async () => {
    const studentList = await request(app)
      .get("/api/departments")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentList.status, 403);

    const invalid = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Bad Dept",
        code: `BD${suffix}`.slice(0, 12),
        facultyId: "nonexistent-faculty-id",
      });
    assert.equal(invalid.status, 400);

    const code = `DP${suffix}`.slice(0, 12).toUpperCase();
    const create = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Test Department ${suffix}`,
        code,
        facultyId,
      });
    assert.equal(create.status, 201, create.text);
    departmentId = create.body.id;
    assert.equal(create.body.facultyId, facultyId);

    const dup = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Dup", code, facultyId });
    assert.equal(dup.status, 409);

    const filtered = await request(app)
      .get(`/api/departments?facultyId=${facultyId}&page=1&pageSize=20`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(filtered.status, 200);
    assert.ok(
      filtered.body.data.every((d: { facultyId: string }) => d.facultyId === facultyId)
    );

    const search = await request(app)
      .get(`/api/departments?q=${code}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.data.some((d: { id: string }) => d.id === departmentId));

    const patch = await request(app)
      .patch(`/api/departments/${departmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Renamed Dept ${suffix}` });
    assert.equal(patch.status, 200);

    const deactivate = await request(app)
      .delete(`/api/departments/${departmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.deactivated, true);

    await request(app)
      .patch(`/api/departments/${departmentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" });
  });

  it("admin course create with department FK; rejects invalid department & duplicates", async () => {
    const teacherCreate = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        code: `TC${suffix}`,
        title: "Blocked",
        departmentId,
      });
    assert.equal(teacherCreate.status, 403);

    const studentCreate = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        code: `SC${suffix}`,
        title: "Blocked",
        departmentId,
      });
    assert.equal(studentCreate.status, 403);

    const invalid = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `CX${suffix}`,
        title: "Bad Course",
        departmentId: "nonexistent-department-id",
      });
    assert.equal(invalid.status, 400);

    const code = `C${suffix}`.slice(0, 12).toUpperCase();
    const create = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: `Test Course ${suffix}`,
        credits: 3,
        departmentId,
        semester: "Semester 1",
      });
    assert.equal(create.status, 201, create.text);
    courseId = create.body.id;
    assert.equal(create.body.departmentId, departmentId);
    assert.equal(create.body.facultyId, facultyId);

    const dup = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, title: "Dup", departmentId });
    assert.equal(dup.status, 409);

    const byDept = await request(app)
      .get(`/api/courses?departmentId=${departmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(byDept.status, 200);
    assert.ok(
      byDept.body.data.some((c: { id: string }) => c.id === courseId)
    );

    const byFac = await request(app)
      .get(`/api/courses?facultyId=${facultyId}&page=1&pageSize=50`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(byFac.status, 200);
    assert.ok(byFac.body.data.some((c: { id: string }) => c.id === courseId));

    const search = await request(app)
      .get(`/api/courses?q=${code}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.data.some((c: { id: string }) => c.id === courseId));

    const patch = await request(app)
      .patch(`/api/courses/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: `Renamed Course ${suffix}`, credits: 4 });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.credits, 4);

    const deactivate = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.deactivated, true);
    assert.equal(deactivate.body.course.accountStatus, "INACTIVE");
  });

  it("pagination metadata is consistent", async () => {
    const res = await request(app)
      .get("/api/faculties?page=1&pageSize=1")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.pageSize, 1);
    assert.ok(res.body.pagination.total >= 1);
    assert.ok(res.body.pagination.totalPages >= 1);
  });
});
