import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { Permission, hasPermission } from "../src/lib/permissions.js";

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

describe("Admin User Management", () => {
  it("permissions catalog includes users.read and users.manage for ADMIN only", () => {
    assert.equal(hasPermission("ADMIN", Permission.USERS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.USERS_MANAGE), true);
    assert.equal(hasPermission("STUDENT", Permission.USERS_READ), false);
    assert.equal(hasPermission("TEACHER", Permission.USERS_MANAGE), false);
  });

  it("rejects unauthenticated list", async () => {
    const res = await request(app).get("/api/admin/users");
    assert.equal(res.status, 401);
  });

  it("blocks student from user management", async () => {
    const token = await studentToken();
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("admin can list, create, filter, reset password, and toggle status", async () => {
    const token = await adminToken();
    const stamp = Date.now();

    const list = await request(app)
      .get("/api/admin/users?page=1&pageSize=10")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.data));
    assert.ok(list.body.pagination.total >= 1);

    const studentEmail = `users.student.${stamp}@student.biu.edu.so`;
    const createdStudent = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Users API Student",
        email: studentEmail,
        role: "STUDENT",
        password: "DHAPTI@2026",
      });
    assert.equal(createdStudent.status, 201);
    assert.equal(createdStudent.body.role, "STUDENT");
    assert.equal(createdStudent.body.status, "Active");
    assert.equal(createdStudent.body.fullName, "Users API Student");
    assert.ok(!JSON.stringify(createdStudent.body).includes("passwordHash"));

    const studentUserId = createdStudent.body.id as string;

    const teacherEmail = `users.teacher.${stamp}@dhapti.edu.so`;
    const createdTeacher = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Users API Teacher",
        email: teacherEmail,
        role: "TEACHER",
        password: "TempPass1",
      });
    assert.equal(createdTeacher.status, 201);
    assert.equal(createdTeacher.body.role, "TEACHER");

    const adminEmail = `users.admin.${stamp}@dhapti.edu.so`;
    const createdAdmin = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Users API Admin",
        email: adminEmail,
        role: "ADMIN",
        password: "AdminPass1",
      });
    assert.equal(createdAdmin.status, 201);
    assert.equal(createdAdmin.body.role, "ADMIN");

    const dup = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Dup",
        email: studentEmail,
        role: "STUDENT",
      });
    assert.equal(dup.status, 409);

    const filtered = await request(app)
      .get(`/api/admin/users?role=STUDENT&q=Users%20API%20Student`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(filtered.status, 200);
    assert.ok(
      filtered.body.data.some((u: { id: string }) => u.id === studentUserId)
    );

    const loginBefore = await request(app).post("/api/auth/login").send({
      email: studentEmail,
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    assert.equal(loginBefore.status, 200);

    const reset = await request(app)
      .patch(`/api/admin/users/${studentUserId}/reset-password`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "NewPass99" });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.ok, true);

    const oldLogin = await request(app).post("/api/auth/login").send({
      email: studentEmail,
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await request(app).post("/api/auth/login").send({
      email: studentEmail,
      password: "NewPass99",
      expectedRole: "STUDENT",
    });
    assert.equal(newLogin.status, 200);

    const suspended = await request(app)
      .patch(`/api/admin/users/${studentUserId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "SUSPENDED" });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, "Suspended");

    const blocked = await request(app).post("/api/auth/login").send({
      email: studentEmail,
      password: "NewPass99",
      expectedRole: "STUDENT",
    });
    assert.equal(blocked.status, 401);

    const reactivated = await request(app)
      .patch(`/api/admin/users/${studentUserId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.body.status, "Active");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(me.status, 200);
    const selfId = me.body.id as string;
    assert.ok(selfId);

    const selfSuspend = await request(app)
      .patch(`/api/admin/users/${selfId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "SUSPENDED" });
    assert.equal(selfSuspend.status, 400);
  });
});
