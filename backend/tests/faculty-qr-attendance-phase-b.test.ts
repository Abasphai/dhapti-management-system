import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/auth.js";
import { parseDateOnly, todayDateOnly } from "../src/lib/attendanceCalc.js";
import {
  encodeQrPayload,
  hashAttendanceQrToken,
  mintRawAttendanceQrToken,
} from "../src/lib/facultyQrAttendance.js";
import { ensureDefaultAttendanceLocations } from "../src/lib/ensureAttendanceLocations.js";
import { getInstitutionTimezone } from "../src/lib/settings.js";
import { prisma } from "../src/lib/prisma.js";
import { patchSystemSettings } from "../src/lib/settings.js";

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

async function mintToken(opts: {
  locationId: string;
  departmentId: string;
  mode: "START" | "END";
  expiresAt?: Date;
  active?: boolean;
}) {
  const raw = mintRawAttendanceQrToken();
  const row = await prisma.attendanceQRToken.create({
    data: {
      locationId: opts.locationId,
      departmentId: opts.departmentId,
      mode: opts.mode,
      tokenHash: hashAttendanceQrToken(raw),
      issuedAt: new Date(),
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 300_000),
      active: opts.active ?? true,
    },
  });
  return { raw, payload: encodeQrPayload(raw), id: row.id };
}

describe("Phase B — Dynamic QR Faculty Attendance", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const teacherEmail = `t.qr.b.${suffix}@dhapti.edu.so`;
  const otherTeacherEmail = `t.qr.b2.${suffix}@dhapti.edu.so`;
  const deptAdminEmail = `dept.qr.b.${suffix}@dhapti.edu.so`;

  let deptAId = "";
  let deptBId = "";
  let locationAId = "";
  let locationBId = "";
  let teacherId = "";
  let teacherUserId = "";
  let otherTeacherId = "";
  let otherUserId = "";
  let deptAdminUserId = "";
  let courseId = "";
  let sectionId = "";
  let otherSectionId = "";
  let sessionId = "";

  before(async () => {
    await patchSystemSettings({
      facultyAttendanceGraceMinutes: 10,
      facultyQrTokenTtlSeconds: 300,
      allowManualFacultyAttendance: true,
      institutionTimezone: "Africa/Mogadishu",
      facultyQrEarlyStartMinutes: 30,
      facultyQrLateEndMinutes: 60,
    });

    const depts = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      take: 2,
      orderBy: { code: "asc" },
    });
    assert.ok(depts.length >= 1);
    deptAId = depts[0]!.id;
    deptBId = depts[1]?.id ?? depts[0]!.id;

    await ensureDefaultAttendanceLocations();
    const locA = await prisma.attendanceLocation.create({
      data: {
        departmentId: deptAId,
        name: `QR Phase B Display ${suffix}`,
        code: `QRB${suffix}`.slice(0, 12).toUpperCase(),
        status: "ACTIVE",
      },
    });
    locationAId = locA.id;

    if (deptBId !== deptAId) {
      const locB = await prisma.attendanceLocation.create({
        data: {
          departmentId: deptBId,
          name: `QR Phase B Other ${suffix}`,
          code: `QRO${suffix}`.slice(0, 12).toUpperCase(),
          status: "ACTIVE",
        },
      });
      locationBId = locB.id;
    } else {
      locationBId = locationAId;
    }

    const course =
      (await prisma.course.findFirst({
        where: { departmentId: deptAId, status: "ACTIVE" },
      })) ?? (await prisma.course.findFirst({ where: { status: "ACTIVE" } }));
    assert.ok(course);
    courseId = course!.id;

    const passwordHash = await hashPassword("DHAPTI@2026");

    const tUser = await prisma.user.create({
      data: {
        email: teacherEmail,
        passwordHash,
        role: "TEACHER",
        teacher: {
          create: {
            facultyCode: `QRB-${suffix}`.slice(0, 16),
            fullName: "QR Phase B Teacher",
            email: teacherEmail,
            departmentId: deptAId,
          },
        },
      },
      include: { teacher: true },
    });
    teacherUserId = tUser.id;
    teacherId = tUser.teacher!.id;

    const oUser = await prisma.user.create({
      data: {
        email: otherTeacherEmail,
        passwordHash,
        role: "TEACHER",
        teacher: {
          create: {
            facultyCode: `QRB2-${suffix}`.slice(0, 16),
            fullName: "Other Dept Teacher",
            email: otherTeacherEmail,
            departmentId: deptBId !== deptAId ? deptBId : deptAId,
          },
        },
      },
      include: { teacher: true },
    });
    otherUserId = oUser.id;
    otherTeacherId = oUser.teacher!.id;

    const dAdmin = await prisma.user.create({
      data: {
        email: deptAdminEmail,
        passwordHash,
        role: "DEPARTMENT_ADMIN",
        admin: {
          create: { fullName: "Dept Admin B", email: deptAdminEmail },
        },
        departmentScope: { create: { departmentId: deptAId } },
      },
    });
    deptAdminUserId = dAdmin.id;

    const section = await prisma.classSection.create({
      data: {
        courseId,
        teacherId,
        section: `QB${suffix}`.slice(0, 8),
        semester: "1",
        academicYear: "2025/2026",
        startTime: "00:00",
        endTime: "23:59",
        room: "IT-2",
      },
    });
    sectionId = section.id;

    const otherSection = await prisma.classSection.create({
      data: {
        courseId,
        teacherId: otherTeacherId,
        section: `QO${suffix}`.slice(0, 8),
        semester: "1",
        academicYear: "2025/2026",
        startTime: "00:00",
        endTime: "23:59",
      },
    });
    otherSectionId = otherSection.id;

    const tz = await getInstitutionTimezone();
    const today = todayDateOnly(new Date(), tz);
    const session = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: parseDateOnly(today)!,
        scheduledStartTime: "00:00",
        scheduledEndTime: "23:59",
        status: "SCHEDULED",
      },
    });
    sessionId = session.id;
  });

  after(async () => {
    await prisma.teacherAttendance.deleteMany({
      where: { teacherId: { in: [teacherId, otherTeacherId] } },
    });
    await prisma.classSession.deleteMany({
      where: { classSectionId: { in: [sectionId, otherSectionId] } },
    });
    await prisma.classSection.deleteMany({
      where: { id: { in: [sectionId, otherSectionId] } },
    });
    await prisma.attendanceQRToken.deleteMany({
      where: { locationId: { in: [locationAId, locationBId] } },
    });
    await prisma.attendanceLocation.deleteMany({
      where: { id: { in: [locationAId, locationBId] } },
    });
    await prisma.userDepartmentScope.deleteMany({
      where: { userId: deptAdminUserId },
    });
    await prisma.admin.deleteMany({ where: { userId: deptAdminUserId } });
    await prisma.teacher.deleteMany({
      where: { userId: { in: [teacherUserId, otherUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacherUserId, otherUserId, deptAdminUserId] } },
    });
  });

  it("display issues START/END QR without PII", async () => {
    const res = await request(app).get(
      `/api/attendance/display/${locationAId}`
    );
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.universityName);
    assert.ok(res.body.department?.code);
    assert.ok(["START", "END", "IDLE"].includes(res.body.mode));
    if (res.body.mode !== "IDLE") {
      assert.ok(res.body.qr?.payload?.startsWith("DHAPTI-ATT:"));
      assert.ok(res.body.qr?.expiresAt);
    }
    assert.equal(res.body.teacherId, undefined);
    assert.equal(res.body.password, undefined);
  });

  it("QR token TTL setting applies to newly minted tokens", async () => {
    await patchSystemSettings({ facultyQrTokenTtlSeconds: 120 });
    await prisma.attendanceQRToken.updateMany({
      where: { locationId: locationAId, active: true },
      data: { active: false, revokedAt: new Date() },
    });
    const res = await request(app).get(
      `/api/attendance/display/${locationAId}`
    );
    assert.equal(res.status, 200, res.text);
    if (res.body.qr) {
      assert.equal(res.body.qr.ttlSeconds, 120);
      const issued = new Date(res.body.qr.issuedAt).getTime();
      const exp = new Date(res.body.qr.expiresAt).getTime();
      assert.ok(Math.abs(exp - issued - 120_000) < 2000);
    }
    await patchSystemSettings({ facultyQrTokenTtlSeconds: 300 });
  });

  it("valid START QR creates TeacherAttendance via shared service", async () => {
    await prisma.teacherAttendance.deleteMany({ where: { sessionId } });
    await prisma.classSession.update({
      where: { id: sessionId },
      data: {
        status: "SCHEDULED",
        actualStartTime: null,
        actualEndTime: null,
      },
    });

    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "START",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.action, "START");
    assert.ok(["ON_TIME", "LATE"].includes(res.body.statusLabel));

    const ta = await prisma.teacherAttendance.findUnique({
      where: { sessionId },
    });
    assert.ok(ta);
    assert.equal(ta!.checkInMethod, "QR");
    assert.ok(["ACTIVE", "LATE"].includes(ta!.status));
    assert.equal(ta!.attendanceLocationId, locationAId);
  });

  it("duplicate START is rejected", async () => {
    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "START",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId });
    assert.equal(res.status, 409, res.text);
    assert.match(res.body.error, /already been started/i);
  });

  it("START token cannot be used as END (wrong mode / already started)", async () => {
    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "START",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId });
    assert.equal(res.status, 409);
  });

  it("END without START is rejected", async () => {
    const tz = await getInstitutionTimezone();
    const today = todayDateOnly(new Date(), tz);
    const freshSession = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: parseDateOnly(today)!,
        scheduledStartTime: "00:01",
        scheduledEndTime: "23:59",
        status: "SCHEDULED",
      },
    });
    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "END",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: freshSession.id });
    assert.equal(res.status, 400, res.text);
    assert.match(res.body.error, /cannot be ended before/i);
    await prisma.classSession.delete({ where: { id: freshSession.id } });
  });

  it("valid END QR completes via shared timer (or early-exit confirm)", async () => {
    const token = await login(teacherEmail, "TEACHER");

    async function endOnce(confirmEarlyExit?: boolean) {
      const { payload } = await mintToken({
        locationId: locationAId,
        departmentId: deptAId,
        mode: "END",
      });
      return request(app)
        .post("/api/teacher/attendance/qr-scan")
        .set("Authorization", `Bearer ${token}`)
        .send({
          token: payload,
          sessionId,
          confirmEarlyExit: confirmEarlyExit || undefined,
        });
    }

    const first = await endOnce();
    if (
      first.status === 409 &&
      first.body.code === "EARLY_EXIT_CONFIRMATION_REQUIRED"
    ) {
      const confirmed = await endOnce(true);
      assert.equal(confirmed.status, 200, confirmed.text);
      assert.equal(confirmed.body.action, "END");
      assert.ok(["COMPLETED", "EARLY_END"].includes(confirmed.body.statusLabel));
    } else {
      assert.equal(first.status, 200, first.text);
      assert.equal(first.body.action, "END");
    }

    const ta = await prisma.teacherAttendance.findUnique({
      where: { sessionId },
    });
    assert.ok(ta?.endedAt);
    assert.equal(ta!.checkOutMethod, "QR");
  });

  it("duplicate END is rejected", async () => {
    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "END",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId, confirmEarlyExit: true });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already been completed/i);
  });

  it("expired QR is rejected", async () => {
    const tz = await getInstitutionTimezone();
    const today = todayDateOnly(new Date(), tz);
    const session2 = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: parseDateOnly(today)!,
        scheduledStartTime: "00:02",
        scheduledEndTime: "23:59",
        status: "SCHEDULED",
      },
    });
    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "START",
      expiresAt: new Date(Date.now() - 1000),
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: session2.id });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /expired/i);
    await prisma.classSession.delete({ where: { id: session2.id } });
  });

  it("invalid QR is rejected", async () => {
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: "DHAPTI-ATT:not-a-real-token-value-xxx", sessionId });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid attendance QR/i);
  });

  it("wrong department QR is rejected", async () => {
    if (locationBId === locationAId || deptBId === deptAId) return;

    const session3 = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: new Date("2026-08-19T00:00:00.000Z"),
        scheduledStartTime: "08:00",
        scheduledEndTime: "10:00",
        status: "SCHEDULED",
      },
    });
    const { payload } = await mintToken({
      locationId: locationBId,
      departmentId: deptBId,
      mode: "START",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: session3.id });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /another department/i);
    await prisma.classSession.delete({ where: { id: session3.id } });
  });

  it("teacher not assigned to ClassSession is rejected", async () => {
    const foreignSession = await prisma.classSession.create({
      data: {
        classSectionId: otherSectionId,
        date: new Date("2026-08-16T00:00:00.000Z"),
        scheduledStartTime: "08:00",
        scheduledEndTime: "10:00",
        status: "SCHEDULED",
      },
    });
    const { payload } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "START",
    });
    const token = await login(teacherEmail, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: foreignSession.id });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /not assigned/i);
    await prisma.classSession.delete({ where: { id: foreignSession.id } });
  });

  it("unauthorized user cannot scan", async () => {
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .send({ token: "DHAPTI-ATT:x", sessionId });
    assert.equal(res.status, 401);
  });

  it("student cannot scan faculty QR", async () => {
    const token = await login("mohamudcade143@gmail.com", "STUDENT");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: "DHAPTI-ATT:abcdef0123456789abcd", sessionId });
    assert.equal(res.status, 403);
  });

  it("department admin can load scoped live monitor", async () => {
    const token = await login(deptAdminEmail, "ADMIN");
    const res = await request(app)
      .get("/api/admin/teacher-attendance/live-monitor")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.summary);
  });

  it("START token remains valid for another teacher (no global consume)", async () => {
    if (deptBId === deptAId) return;
    // Multi-teacher same dept: create second teacher in dept A
    const passwordHash = await hashPassword("DHAPTI@2026");
    const email = `t.qr.same.${suffix}@dhapti.edu.so`;
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "TEACHER",
        teacher: {
          create: {
            facultyCode: `QRS-${suffix}`.slice(0, 16),
            fullName: "Same Dept Teacher",
            email,
            departmentId: deptAId,
          },
        },
      },
      include: { teacher: true },
    });
    const sec = await prisma.classSection.create({
      data: {
        courseId,
        teacherId: u.teacher!.id,
        section: `QS${suffix}`.slice(0, 8),
        semester: "1",
        academicYear: "2025/2026",
        startTime: "00:00",
        endTime: "23:59",
      },
    });
    const tz = await getInstitutionTimezone();
    const today = todayDateOnly(new Date(), tz);
    const sess = await prisma.classSession.create({
      data: {
        classSectionId: sec.id,
        date: parseDateOnly(today)!,
        scheduledStartTime: "00:00",
        scheduledEndTime: "23:59",
        status: "SCHEDULED",
      },
    });

    const { payload, id } = await mintToken({
      locationId: locationAId,
      departmentId: deptAId,
      mode: "START",
    });
    const token = await login(email, "TEACHER");
    const res = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: sess.id });
    assert.equal(res.status, 200, res.text);

    const stillActive = await prisma.attendanceQRToken.findUnique({
      where: { id },
    });
    assert.equal(stillActive?.active, true);

    await prisma.teacherAttendance.deleteMany({ where: { sessionId: sess.id } });
    await prisma.classSession.delete({ where: { id: sess.id } });
    await prisma.classSection.delete({ where: { id: sec.id } });
    await prisma.teacher.delete({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  });
});
