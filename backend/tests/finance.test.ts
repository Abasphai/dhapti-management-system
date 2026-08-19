import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { Permission, hasPermission } from "../src/lib/permissions.js";

const app = createApp();

describe("Phase 1L Finance & Fees Engine", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let studentToken = "";
  let studentId = "";
  let studentUserId = "";
  let pendingId = "";
  const email = `fin.s.${suffix}@dhapti.edu.so`;

  after(async () => {
    if (studentId) {
      await prisma.payment.deleteMany({ where: { studentId } }).catch(() => {});
    }
    if (studentUserId) {
      await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("permissions catalog includes finance/payments", () => {
    assert.equal(hasPermission("ADMIN", Permission.FINANCE_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.FINANCE_MANAGE), true);
    assert.equal(hasPermission("STUDENT", Permission.PAYMENTS_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.PAYMENTS_PAY), true);
    assert.equal(hasPermission("TEACHER", Permission.FINANCE_READ), false);
  });

  it("student ledger, pay flow, admin summary/record; ownership enforced", async () => {
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
        fullName: `Finance Student ${suffix}`,
        email,
        studentCode: `DHAPTI-F-${suffix}`.slice(0, 20).toUpperCase(),
        program: "BSc CS",
      });
    assert.equal(created.status, 201, created.text);
    studentId = created.body.id;
    const row = await prisma.student.findUnique({ where: { id: studentId } });
    assert.ok(row);
    studentUserId = row!.userId;

    const studentLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "DHAPTI@2026", expectedRole: "STUDENT" });
    assert.equal(studentLogin.status, 200, studentLogin.text);
    studentToken = studentLogin.body.token;

    const unauth = await request(app).get("/api/payments/me");
    assert.equal(unauth.status, 401);

    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "mohamed.ali@dhapti.edu.so",
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    assert.equal(teacherLogin.status, 200);
    const teacherBlocked = await request(app)
      .get("/api/admin/finance/summary")
      .set("Authorization", `Bearer ${teacherLogin.body.token}`);
    assert.equal(teacherBlocked.status, 403);

    const charge = await request(app)
      .post("/api/admin/finance/record-payment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId,
        amount: 500,
        description: `Tuition Fee — ${suffix}`,
        semester: "Semester 1",
        status: "PENDING",
      });
    assert.equal(charge.status, 201, charge.text);
    assert.equal(charge.body.status, "PENDING");
    pendingId = charge.body.id;

    const ledger = await request(app)
      .get("/api/payments/me")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(ledger.status, 200, ledger.text);
    assert.ok(ledger.body.summary.totalDue >= 500);
    assert.ok(
      ledger.body.data.some((p: { id: string }) => p.id === pendingId)
    );

    const payOther = await request(app)
      .post("/api/payments/pay")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ paymentId: "missing-payment" });
    assert.equal(payOther.status, 404);

    const paid = await request(app)
      .post("/api/payments/pay")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ paymentId: pendingId, paymentMethod: "EVC Plus" });
    assert.equal(paid.status, 200, paid.text);
    assert.equal(paid.body.status, "PAID");
    assert.ok(paid.body.receiptNumber);

    const repay = await request(app)
      .post("/api/payments/pay")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ paymentId: pendingId });
    assert.equal(repay.status, 409);

    const cash = await request(app)
      .post("/api/admin/finance/record-payment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId,
        amount: 250,
        description: `Manual cash ${suffix}`,
        paymentMethod: "Cash Desk",
        status: "PAID",
      });
    assert.equal(cash.status, 201, cash.text);
    assert.equal(cash.body.status, "PAID");
    assert.ok(cash.body.receiptNumber);

    const summary = await request(app)
      .get("/api/admin/finance/summary")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(summary.status, 200);
    assert.ok(summary.body.totalRevenue >= 750);

    const txns = await request(app)
      .get(`/api/admin/finance/transactions?q=${suffix}&status=PAID`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(txns.status, 200);
    assert.ok(txns.body.pagination);
    assert.ok(txns.body.data.length >= 1);

    const studentAdmin = await request(app)
      .get("/api/admin/finance/transactions")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentAdmin.status, 403);
  });
});
