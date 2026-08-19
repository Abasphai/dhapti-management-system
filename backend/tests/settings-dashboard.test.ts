import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { Permission, hasPermission } from "../src/lib/permissions.js";
import { patchSystemSettings } from "../src/lib/settings.js";

const app = createApp();

describe("Phase 1N Settings & Live Dashboards", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let applyId = "";

  after(async () => {
    await patchSystemSettings({ isAdmissionsOpen: true }).catch(() => {});
    if (applyId) {
      await prisma.admissionApplication.delete({ where: { id: applyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("permissions include settings and dashboard.read", () => {
    assert.equal(hasPermission("ADMIN", Permission.SETTINGS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.SETTINGS_MANAGE), true);
    assert.equal(hasPermission("ADMIN", Permission.DASHBOARD_READ), true);
    assert.equal(hasPermission("TEACHER", Permission.DASHBOARD_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.DASHBOARD_READ), true);
    assert.equal(hasPermission("TEACHER", Permission.SETTINGS_MANAGE), false);
  });

  it("settings get/patch, admissions gate, role dashboard stats", async () => {
    const publicSettings = await request(app).get("/api/settings/public");
    assert.equal(publicSettings.status, 200, publicSettings.text);
    assert.equal(typeof publicSettings.body.isAdmissionsOpen, "boolean");
    assert.ok(publicSettings.body.currentAcademicYear);

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    assert.equal(adminLogin.status, 200, adminLogin.text);
    adminToken = adminLogin.body.token;

    const teacherLogin = await request(app).post("/api/auth/login").send({
      email: "mohamed.ali@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "TEACHER",
    });
    assert.equal(teacherLogin.status, 200);
    teacherToken = teacherLogin.body.token;

    const studentLogin = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    assert.equal(studentLogin.status, 200);
    studentToken = studentLogin.body.token;

    const teacherBlocked = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherBlocked.status, 403);

    const settings = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(settings.status, 200, settings.text);
    assert.equal(typeof settings.body.isAdmissionsOpen, "boolean");

    const patched = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        currentAcademicYear: "2025/2026",
        currentSemester: "Semester 1",
        isAdmissionsOpen: false,
        requireAdminGradeApproval: true,
        minAttendanceThreshold: 75,
        passingGradeCutoff: 50,
        maxUploadFileMb: 500,
        defaultTuitionFee: 1200,
        admissionApplicationFee: 50,
        paymentCurrency: "USD",
        paymentGracePeriodDays: 30,
        sendStudentWelcomeEmail: true,
        sendLowAttendanceWarning: true,
        sendGradeApprovalAlert: true,
      });
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.body.isAdmissionsOpen, false);
    assert.equal(patched.body.minAttendanceThreshold, 75);
    assert.equal(patched.body.passingGradeCutoff, 50);
    assert.equal(patched.body.maxUploadFileMb, 500);
    assert.equal(patched.body.defaultTuitionFee, 1200);
    assert.equal(patched.body.paymentCurrency, "USD");
    assert.equal(patched.body.sendLowAttendanceWarning, true);

    const audit = await request(app)
      .get("/api/admin/settings/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(audit.status, 200, audit.text);
    assert.ok(Array.isArray(audit.body.data));

    const backup = await request(app)
      .get("/api/admin/settings/backup")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(backup.status, 200, backup.text);
    assert.ok(String(backup.headers["content-type"] || "").includes("json"));
    assert.ok(backup.text.includes("exportedAt"));

    const faculty = await prisma.faculty.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    assert.ok(faculty);

    const closed = await request(app).post("/api/admissions/apply").send({
      fullName: `Closed Apply ${suffix}`,
      email: `closed.${suffix}@example.com`,
      facultyId: faculty!.id,
    });
    assert.equal(closed.status, 403);

    const reopen = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isAdmissionsOpen: true });
    assert.equal(reopen.status, 200);
    assert.equal(reopen.body.isAdmissionsOpen, true);

    const applied = await request(app).post("/api/admissions/apply").send({
      fullName: `Open Apply ${suffix}`,
      email: `open.${suffix}@example.com`,
      facultyId: faculty!.id,
    });
    assert.equal(applied.status, 201, applied.text);
    applyId = applied.body.application.id;

    const adminDash = await request(app)
      .get("/api/admin/dashboard/stats")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminDash.status, 200, adminDash.text);
    assert.equal(typeof adminDash.body.totalStudents, "number");
    assert.equal(typeof adminDash.body.activeFaculty, "number");
    assert.equal(typeof adminDash.body.currentRevenue, "number");
    assert.equal(typeof adminDash.body.activePrograms, "number");
    assert.ok(Array.isArray(adminDash.body.recentRegistrations));

    const teacherDash = await request(app)
      .get("/api/teacher/dashboard/stats")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherDash.status, 200, teacherDash.text);
    assert.equal(typeof teacherDash.body.activeCourses, "number");
    assert.equal(typeof teacherDash.body.totalStudents, "number");
    assert.equal(typeof teacherDash.body.pendingGrading, "number");
    assert.ok(Array.isArray(teacherDash.body.todayClasses));

    const studentDash = await request(app)
      .get("/api/student/dashboard/stats")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentDash.status, 200, studentDash.text);
    assert.equal(typeof studentDash.body.enrolledCourses, "number");
    assert.ok("attendancePercent" in studentDash.body);
    assert.ok("pendingFeeDues" in studentDash.body);
    assert.ok(studentDash.body.gpaLabel);

    const crossRole = await request(app)
      .get("/api/admin/dashboard/stats")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(crossRole.status, 403);
  });
});
