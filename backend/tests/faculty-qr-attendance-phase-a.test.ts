import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/auth.js";
import { ensureDefaultAttendanceLocations } from "../src/lib/ensureAttendanceLocations.js";
import { hasPermission, Permission } from "../src/lib/permissions.js";
import { prisma } from "../src/lib/prisma.js";
import { getFacultyAttendancePolicy, patchSystemSettings } from "../src/lib/settings.js";

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

describe("Phase A — Faculty QR attendance foundation", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const deptAdminEmail = `dept.qr.${suffix}@dhapti.edu.so`;
  let deptAId = "";
  let deptBId = "";
  let deptAdminUserId = "";
  let locationAId = "";
  let locationBId = "";

  before(async () => {
    const depts = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      take: 2,
      orderBy: { code: "asc" },
    });
    assert.ok(depts.length >= 1, "Need at least one department");
    deptAId = depts[0]!.id;
    deptBId = depts[1]?.id ?? depts[0]!.id;

    await ensureDefaultAttendanceLocations();

    const locA = await prisma.attendanceLocation.findUnique({
      where: { departmentId_code: { departmentId: deptAId, code: "MAIN" } },
    });
    assert.ok(locA);
    locationAId = locA!.id;

    if (deptBId !== deptAId) {
      const locB = await prisma.attendanceLocation.findUnique({
        where: { departmentId_code: { departmentId: deptBId, code: "MAIN" } },
      });
      locationBId = locB?.id ?? "";
    }

    const passwordHash = await hashPassword("DHAPTI@2026");
    const user = await prisma.user.create({
      data: {
        email: deptAdminEmail,
        passwordHash,
        role: "DEPARTMENT_ADMIN",
        admin: {
          create: {
            fullName: "QR Phase A Dept Admin",
            email: deptAdminEmail,
          },
        },
        departmentScope: {
          create: { departmentId: deptAId },
        },
      },
    });
    deptAdminUserId = user.id;
  });

  after(async () => {
    await prisma.userDepartmentScope.deleteMany({
      where: { userId: deptAdminUserId },
    });
    await prisma.admin.deleteMany({ where: { userId: deptAdminUserId } });
    await prisma.user.deleteMany({ where: { id: deptAdminUserId } });
  });

  it("permissions: ADMIN has locations.manage; DEPARTMENT_ADMIN does not", () => {
    assert.equal(
      hasPermission("ADMIN", Permission.ATTENDANCE_LOCATIONS_MANAGE),
      true
    );
    assert.equal(
      hasPermission("DEPARTMENT_ADMIN", Permission.ATTENDANCE_LOCATIONS_MANAGE),
      false
    );
    assert.equal(
      hasPermission("DEPARTMENT_ADMIN", Permission.ATTENDANCE_READ),
      true
    );
  });

  it("SystemSettings faculty QR policy defaults are readable", async () => {
    await patchSystemSettings({
      facultyAttendanceGraceMinutes: 10,
      facultyQrTokenTtlSeconds: 300,
      facultyRequiredClassMinutesFallback: 120,
      allowManualFacultyAttendance: true,
      institutionTimezone: "Africa/Mogadishu",
      facultyQrEarlyStartMinutes: 30,
      facultyQrLateEndMinutes: 60,
    });
    const policy = await getFacultyAttendancePolicy();
    assert.equal(policy.graceMinutes, 10);
    assert.equal(policy.qrTokenTtlSeconds, 300);
    assert.equal(policy.requiredMinutesFallback, 120);
    assert.equal(policy.allowManual, true);
    assert.equal(policy.institutionTimezone, "Africa/Mogadishu");
    assert.equal(policy.earlyStartMinutes, 30);
    assert.equal(policy.lateEndMinutes, 60);
  });

  it("ADMIN can list attendance locations", async () => {
    const token = await login("admin@dhapti.edu.so", "ADMIN");
    const res = await request(app)
      .get("/api/admin/attendance-locations")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
  });

  it("DEPARTMENT_ADMIN list is scoped to own department", async () => {
    const token = await login(deptAdminEmail, "ADMIN");
    const res = await request(app)
      .get("/api/admin/attendance-locations")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    for (const row of res.body.data as Array<{ departmentId: string }>) {
      assert.equal(row.departmentId, deptAId);
    }
  });

  it("DEPARTMENT_ADMIN cannot read another department location", async () => {
    if (!locationBId || locationBId === locationAId) {
      return; // single-department fixture — skip cross-dept check
    }
    const token = await login(deptAdminEmail, "ADMIN");
    const res = await request(app)
      .get(`/api/admin/attendance-locations/${locationBId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403, res.text);
  });

  it("DEPARTMENT_ADMIN cannot create locations", async () => {
    const token = await login(deptAdminEmail, "ADMIN");
    const res = await request(app)
      .post("/api/admin/attendance-locations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        departmentId: deptAId,
        name: "Should Fail",
        code: `X${suffix}`.slice(0, 8),
      });
    assert.equal(res.status, 403, res.text);
  });

  it("ADMIN can patch location status and regenerate (revoke) tokens", async () => {
    const token = await login("admin@dhapti.edu.so", "ADMIN");
    const patch = await request(app)
      .patch(`/api/admin/attendance-locations/${locationAId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roomHint: `Lab-${suffix}` });
    assert.equal(patch.status, 200, patch.text);
    assert.equal(patch.body.roomHint, `Lab-${suffix}`);

    const regen = await request(app)
      .post(`/api/admin/attendance-locations/${locationAId}/regenerate-tokens`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(regen.status, 200, regen.text);
    assert.ok(typeof regen.body.revokedActiveTokens === "number");
  });

  it("manual check-in records checkInMethod MANUAL when policy allows", async () => {
    const passwordHash = await hashPassword("DHAPTI@2026");
    const teacherEmail = `t.qr.${suffix}@dhapti.edu.so`;
    const course =
      (await prisma.course.findFirst({ where: { code: "CS101" } })) ??
      (await prisma.course.findFirst());
    assert.ok(course);

    const teacherUser = await prisma.user.create({
      data: {
        email: teacherEmail,
        passwordHash,
        role: "TEACHER",
        teacher: {
          create: {
            facultyCode: `DHAPTI-FAC-QR${suffix}`.slice(0, 16),
            fullName: "QR Phase A Teacher",
            email: teacherEmail,
            departmentId: deptAId,
          },
        },
      },
      include: { teacher: true },
    });

    const section = await prisma.classSection.create({
      data: {
        courseId: course!.id,
        teacherId: teacherUser.teacher!.id,
        section: `QA${suffix}`.slice(0, 8),
        semester: "1",
        academicYear: "2025/2026",
        startTime: "08:00",
        endTime: "10:00",
      },
    });

    const session = await prisma.classSession.create({
      data: {
        classSectionId: section.id,
        date: new Date("2026-08-16T00:00:00.000Z"),
        scheduledStartTime: "08:00",
        scheduledEndTime: "10:00",
        status: "SCHEDULED",
      },
    });

    try {
      const token = await login(teacherEmail, "TEACHER");
      const start = await request(app)
        .post(`/api/sessions/${session.id}/start`)
        .set("Authorization", `Bearer ${token}`)
        .send({});
      assert.equal(start.status, 200, start.text);

      const ta = await prisma.teacherAttendance.findUnique({
        where: { sessionId: session.id },
      });
      assert.ok(ta);
      assert.equal(ta!.checkInMethod, "MANUAL");
      assert.equal(ta!.status, "ACTIVE");
    } finally {
      await prisma.teacherAttendance.deleteMany({
        where: { sessionId: session.id },
      });
      await prisma.classSession.deleteMany({ where: { id: session.id } });
      await prisma.classSection.deleteMany({ where: { id: section.id } });
      await prisma.teacher.deleteMany({ where: { userId: teacherUser.id } });
      await prisma.user.deleteMany({ where: { id: teacherUser.id } });
    }
  });
});
