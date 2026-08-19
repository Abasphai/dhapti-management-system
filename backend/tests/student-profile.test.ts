import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

describe("Student profile self-service (portal gap close)", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let studentToken = "";
  let studentId = "";
  let studentUserId = "";
  const email = `prof.s.${suffix}@dhapti.edu.so`;

  after(async () => {
    if (studentUserId) {
      await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("student can read and patch only phone/address/photo; identity fields rejected", async () => {
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@dhapti.edu.so",
        password: "DHAPTI@2026",
        expectedRole: "ADMIN",
      });
    assert.equal(adminLogin.status, 200, adminLogin.text);
    adminToken = adminLogin.body.token;

    const created = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Profile Student ${suffix}`,
        motherName: "Mother Name",
        email,
        phone: "+252 61 111 0000",
        address: "Old Address",
        bloodGroup: "O+",
        studentCode: `DHAPTI-P-${suffix}`.slice(0, 20).toUpperCase(),
        program: "BSc CS",
      });
    assert.equal(created.status, 201, created.text);
    studentId = created.body.id;
    const row = await prisma.student.findUnique({ where: { id: studentId } });
    assert.ok(row);
    studentUserId = row!.userId;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "DHAPTI@2026", expectedRole: "STUDENT" });
    assert.equal(login.status, 200, login.text);
    studentToken = login.body.token;

    const me = await request(app)
      .get("/api/students/me")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.fullName, `Profile Student ${suffix}`);
    assert.equal(me.body.motherName, "Mother Name");
    assert.equal(me.body.bloodGroup, "O+");
    assert.equal(me.body.email, email);

    const patched = await request(app)
      .patch("/api/students/me")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        phone: "+252 61 222 3333",
        address: "Wadajir District",
        profilePhoto: "data:image/png;base64,abc",
        fullName: "HACKED NAME",
        motherName: "HACKED MOTHER",
        email: "hacked@evil.test",
        bloodGroup: "AB+",
        studentCode: "HACKED-CODE",
      });
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.body.phone, "+252 61 222 3333");
    assert.equal(patched.body.address, "Wadajir District");
    assert.equal(patched.body.profilePhoto, "data:image/png;base64,abc");
    assert.equal(patched.body.fullName, `Profile Student ${suffix}`);
    assert.equal(patched.body.motherName, "Mother Name");
    assert.equal(patched.body.bloodGroup, "O+");
    assert.equal(patched.body.email, email);
    assert.notEqual(patched.body.studentCode, "HACKED-CODE");
  });
});
