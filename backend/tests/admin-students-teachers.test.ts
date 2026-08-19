import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";

const app = createApp();

async function adminToken() {
  const res = await request(app).post("/api/auth/login").send({
    email: "admin@dhapti.edu.so",
    password: "DHAPTI@2026",
    expectedRole: "ADMIN",
  });
  assert.equal(res.status, 200);
  return res.body.token as string;
}

async function studentToken() {
  const res = await request(app).post("/api/auth/login").send({
    email: "mohamudcade143@gmail.com",
    password: "DHAPTI@2026",
    expectedRole: "STUDENT",
  });
  return res.body.token as string;
}

async function teacherToken() {
  const res = await request(app).post("/api/auth/login").send({
    email: "mohamed.ali@dhapti.edu.so",
    password: "DHAPTI@2026",
    expectedRole: "TEACHER",
  });
  return res.body.token as string;
}

describe("Phase 1B Admin Students", () => {
  it("rejects unauthenticated list", async () => {
    const res = await request(app).get("/api/students");
    assert.equal(res.status, 401);
  });

  it("blocks student from admin list", async () => {
    const token = await studentToken();
    const res = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("blocks teacher from admin list", async () => {
    const token = await teacherToken();
    const res = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("admin can create, read, update, search, paginate, deactivate student", async () => {
    const token = await adminToken();
    const stamp = Date.now();
    const email = `phase1b.student.${stamp}@student.biu.edu.so`;
    const code = `DHAPTI-T-${stamp}`;

    const created = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email,
        fullName: "Phase1B Test Student",
        phone: "+252 61 999 0001",
        semester: "Semester 1",
        program: "Computing & IT",
        studentCode: code,
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.studentCode, code);
    assert.equal(created.body.status, "Active");
    assert.ok(!JSON.stringify(created.body).includes("passwordHash"));

    const id = created.body.id as string;

    const dupEmail = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email,
        fullName: "Dup Email",
        studentCode: `DHAPTI-T-${stamp}-B`,
      });
    assert.equal(dupEmail.status, 409);

    const dupCode = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `phase1b.student.${stamp}.b@student.biu.edu.so`,
        fullName: "Dup Code",
        studentCode: code,
      });
    assert.equal(dupCode.status, 409);

    const one = await request(app)
      .get(`/api/students/${id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(one.status, 200);
    assert.equal(one.body.id, id);

    const updated = await request(app)
      .patch(`/api/students/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+252 61 999 0002", fullName: "Phase1B Student Updated" });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.phone, "+252 61 999 0002");
    assert.equal(updated.body.name, "Phase1B Student Updated");

    const search = await request(app)
      .get(`/api/students?q=${encodeURIComponent(code)}&page=1&pageSize=5`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.data.some((s: { id: string }) => s.id === id));
    assert.equal(search.body.pagination.pageSize, 5);
    assert.ok(search.body.pagination.total >= 1);
    assert.ok(search.body.pagination.totalPages >= 1);

    const deactivated = await request(app)
      .patch(`/api/students/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "INACTIVE" });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.status, "Inactive");

    const softDelete = await request(app)
      .delete(`/api/students/${id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(softDelete.status, 200);
    assert.equal(softDelete.body.deactivated, true);
    assert.equal(softDelete.body.student.status, "Inactive");
  });
});

describe("Phase 1B Admin Teachers", () => {
  it("blocks student from teachers list", async () => {
    const token = await studentToken();
    const res = await request(app)
      .get("/api/teachers")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("blocks teacher from creating teachers", async () => {
    const token = await teacherToken();
    const res = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "nope@dhapti.edu.so",
        fullName: "Nope",
      });
    assert.equal(res.status, 403);
  });

  it("admin can create, read, update, search, paginate, deactivate teacher", async () => {
    const token = await adminToken();
    const stamp = Date.now();
    const email = `phase1b.teacher.${stamp}@dhapti.edu.so`;
    const code = `DHAPTI-FAC-T${String(stamp).slice(-5)}`;

    const created = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email,
        fullName: "Dr. Test Teacher Temporary",
        designation: "Lecturer",
        facultyCode: code,
        bio: "Test bio",
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.facultyCode, code);
    assert.equal(created.body.status, "Active");
    assert.ok(!JSON.stringify(created.body).includes("passwordHash"));

    const id = created.body.id as string;

    const dupEmail = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email,
        fullName: "Dup",
        facultyCode: `${code}X`,
      });
    assert.equal(dupEmail.status, 409);

    const dupCode = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `phase1b.teacher.${stamp}.b@dhapti.edu.so`,
        fullName: "Dup Code",
        facultyCode: code,
      });
    assert.equal(dupCode.status, 409);

    const one = await request(app)
      .get(`/api/teachers/${id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(one.status, 200);
    assert.equal(one.body.id, id);

    const updated = await request(app)
      .patch(`/api/teachers/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        designation: "Senior Lecturer",
        fullName: "Dr. Amina Warsame Hassan",
      });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.designation, "Senior Lecturer");

    const search = await request(app)
      .get(`/api/teachers?q=${encodeURIComponent(code)}&page=1&pageSize=5`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.data.some((t: { id: string }) => t.id === id));
    assert.equal(search.body.pagination.pageSize, 5);

    const deactivated = await request(app)
      .patch(`/api/teachers/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "INACTIVE" });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.status, "Inactive");

    // Soft-remove so admin UI is not polluted by automation rows.
    await request(app)
      .delete(`/api/teachers/${id}`)
      .set("Authorization", `Bearer ${token}`);
  });
});
