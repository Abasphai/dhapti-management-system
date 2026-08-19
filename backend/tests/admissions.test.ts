import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { Permission, hasPermission } from "../src/lib/permissions.js";
import { patchSystemSettings } from "../src/lib/settings.js";

const app = createApp();

describe("Phase 1M Online Admissions", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let facultyId = "";
  let programId = "";
  let applyId = "";
  let approveId = "";
  let rejectId = "";
  let createdStudentUserId = "";
  const applyEmail = `apply.${suffix}@example.com`;
  const approveEmail = `approve.${suffix}@example.com`;
  const rejectEmail = `reject.${suffix}@example.com`;

  after(async () => {
    if (createdStudentUserId) {
      await prisma.user.delete({ where: { id: createdStudentUserId } }).catch(() => {});
    }
    for (const id of [applyId, approveId, rejectId]) {
      if (id) {
        await prisma.admissionApplication.delete({ where: { id } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  });

  it("permissions catalog includes admissions", () => {
    assert.equal(hasPermission("ADMIN", Permission.ADMISSIONS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.ADMISSIONS_MANAGE), true);
    assert.equal(hasPermission("TEACHER", Permission.ADMISSIONS_READ), false);
    assert.equal(hasPermission("STUDENT", Permission.ADMISSIONS_MANAGE), false);
  });

  it("public apply, admin queue, approve conversion, reject", async () => {
    await patchSystemSettings({ isAdmissionsOpen: true });

    const faculty = await prisma.faculty.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    assert.ok(faculty, "seed faculty required");
    facultyId = faculty.id;

    const course = await prisma.course.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    programId = course?.id ?? "";

    const options = await request(app).get("/api/admissions/options");
    assert.equal(options.status, 200, options.text);
    assert.ok(Array.isArray(options.body.faculties));
    assert.ok(options.body.faculties.length >= 1);

    const bad = await request(app).post("/api/admissions/apply").send({
      fullName: "X",
      email: "not-an-email",
    });
    assert.equal(bad.status, 400);

    const applied = await request(app).post("/api/admissions/apply").send({
      fullName: `Applicant ${suffix}`,
      email: applyEmail,
      phone: "+252 61 700 9999",
      facultyId,
      programId: programId || undefined,
      highSchoolGPA: 85.5,
    });
    assert.equal(applied.status, 201, applied.text);
    assert.equal(applied.body.message, "Application Submitted Successfully!");
    assert.ok(applied.body.trackingId);
    assert.equal(applied.body.application.status, "PENDING");
    applyId = applied.body.application.id;

    const dup = await request(app).post("/api/admissions/apply").send({
      fullName: `Applicant Dup ${suffix}`,
      email: applyEmail,
      facultyId,
    });
    assert.equal(dup.status, 409);

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@dhapti.edu.so",
        password: "DHAPTI@2026",
        expectedRole: "ADMIN",
      });
    assert.equal(adminLogin.status, 200, adminLogin.text);
    adminToken = adminLogin.body.token;

    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "mohamed.ali@dhapti.edu.so",
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
    assert.equal(teacherLogin.status, 200);
    const teacherBlocked = await request(app)
      .get("/api/admin/admissions")
      .set("Authorization", `Bearer ${teacherLogin.body.token}`);
    assert.equal(teacherBlocked.status, 403);

    const unauth = await request(app).get("/api/admin/admissions");
    assert.equal(unauth.status, 401);

    const list = await request(app)
      .get(`/api/admin/admissions?search=${encodeURIComponent(suffix)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(list.status, 200, list.text);
    assert.ok(list.body.data.some((a: { id: string }) => a.id === applyId));
    assert.ok(list.body.counts);

    const detail = await request(app)
      .get(`/api/admin/admissions/${applyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.email, applyEmail);
    assert.equal(detail.body.highSchoolGPA, 85.5);

    // Approve path on a fresh application
    const toApprove = await request(app).post("/api/admissions/apply").send({
      fullName: `Approve Me ${suffix}`,
      email: approveEmail,
      phone: "+252 61 700 8888",
      facultyId,
      highSchoolGPA: 90,
    });
    assert.equal(toApprove.status, 201, toApprove.text);
    approveId = toApprove.body.application.id;

    const approved = await request(app)
      .post(`/api/admin/admissions/${approveId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.body.application.status, "APPROVED");
    assert.ok(approved.body.studentCode.startsWith("DHAPTI-"));
    assert.ok(approved.body.paymentId);
    assert.equal(approved.body.defaultPassword, "DHAPTI@2026");

    const student = await prisma.student.findUnique({
      where: { studentCode: approved.body.studentCode },
      include: { user: true, payments: true },
    });
    assert.ok(student);
    createdStudentUserId = student!.userId;
    assert.equal(student!.user.role, "STUDENT");
    assert.equal(student!.user.email, approveEmail);
    assert.ok(student!.payments.some((p) => p.status === "PENDING"));
    assert.ok(
      student!.payments.some((p) => p.description.includes("Semester 1"))
    );

    const studentLogin = await request(app).post("/api/auth/login").send({
      email: approveEmail,
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    assert.equal(studentLogin.status, 200, studentLogin.text);

    const reApprove = await request(app)
      .post(`/api/admin/admissions/${approveId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(reApprove.status, 409);

    // Reject path
    const toReject = await request(app).post("/api/admissions/apply").send({
      fullName: `Reject Me ${suffix}`,
      email: rejectEmail,
      facultyId,
    });
    assert.equal(toReject.status, 201, toReject.text);
    rejectId = toReject.body.application.id;

    const rejectBad = await request(app)
      .post(`/api/admin/admissions/${rejectId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.equal(rejectBad.status, 400);

    const rejected = await request(app)
      .post(`/api/admin/admissions/${rejectId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Incomplete supporting documents" });
    assert.equal(rejected.status, 200, rejected.text);
    assert.equal(rejected.body.application.status, "REJECTED");
    assert.equal(
      rejected.body.application.rejectionReason,
      "Incomplete supporting documents"
    );

    const reReject = await request(app)
      .post(`/api/admin/admissions/${rejectId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Again" });
    assert.equal(reReject.status, 409);
  });
});
