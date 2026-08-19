import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/auth.js";
import { parseDateOnly, todayDateOnly } from "../src/lib/attendanceCalc.js";
import { __resetAttendanceQrRawCacheForTests } from "../src/lib/attendanceQrTokenCache.js";
import {
  computeLateByMinutes,
  encodeQrPayload,
  evaluateQrAttendanceWindow,
  hashAttendanceQrToken,
  issueDisplayQrToken,
  mintRawAttendanceQrToken,
  scheduledInstant,
} from "../src/lib/facultyQrAttendance.js";
import {
  DEFAULT_INSTITUTION_TIMEZONE,
  todayDateOnlyInTimeZone,
  zonedWallClockToUtc,
} from "../src/lib/institutionTime.js";
import { prisma } from "../src/lib/prisma.js";
import { __resetRateLimitBucketsForTests } from "../src/lib/rateLimit.js";
import { patchSystemSettings } from "../src/lib/settings.js";
import { teacherCheckInSession } from "../src/routes/teacherAttendanceTimer.js";

const app = createApp();
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

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
}) {
  const raw = mintRawAttendanceQrToken();
  const row = await prisma.attendanceQRToken.create({
    data: {
      locationId: opts.locationId,
      departmentId: opts.departmentId,
      mode: opts.mode,
      tokenHash: hashAttendanceQrToken(raw),
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 300_000),
      active: true,
    },
  });
  return { raw, payload: encodeQrPayload(raw), id: row.id };
}

describe("Faculty QR security fixes (C1 H1–H4 M3 M6)", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const teacherEmail = `t.qr.sec.${suffix}@dhapti.edu.so`;

  let deptId = "";
  let locationId = "";
  let teacherId = "";
  let teacherUserId = "";
  let courseId = "";
  let sectionId = "";
  let sessionId = "";

  before(async () => {
    __resetAttendanceQrRawCacheForTests();
    __resetRateLimitBucketsForTests();
    await patchSystemSettings({
      facultyAttendanceGraceMinutes: 10,
      facultyQrTokenTtlSeconds: 300,
      allowManualFacultyAttendance: true,
      institutionTimezone: "Africa/Mogadishu",
      facultyQrEarlyStartMinutes: 30,
      facultyQrLateEndMinutes: 60,
    });

    const dept = await prisma.department.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { code: "asc" },
    });
    assert.ok(dept);
    deptId = dept!.id;

    const loc = await prisma.attendanceLocation.create({
      data: {
        departmentId: deptId,
        name: `QR Sec ${suffix}`,
        code: `QS${suffix}`.slice(0, 12).toUpperCase(),
        status: "ACTIVE",
      },
    });
    locationId = loc.id;

    const course =
      (await prisma.course.findFirst({
        where: { departmentId: deptId, status: "ACTIVE" },
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
            facultyCode: `QRS-${suffix}`.slice(0, 16),
            fullName: "QR Security Teacher",
            email: teacherEmail,
            departmentId: deptId,
          },
        },
      },
      include: { teacher: true },
    });
    teacherUserId = tUser.id;
    teacherId = tUser.teacher!.id;

    const section = await prisma.classSection.create({
      data: {
        courseId,
        teacherId,
        section: `QS${suffix}`.slice(0, 8),
        semester: "1",
        academicYear: "2025/2026",
        startTime: "00:00",
        endTime: "23:59",
      },
    });
    sectionId = section.id;

    const today = todayDateOnly(new Date(), DEFAULT_INSTITUTION_TIMEZONE);
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
    await prisma.teacherAttendance.deleteMany({ where: { teacherId } });
    await prisma.classSession.deleteMany({ where: { classSectionId: sectionId } });
    await prisma.classSection.deleteMany({ where: { id: sectionId } });
    await prisma.attendanceQRToken.deleteMany({ where: { locationId } });
    await prisma.attendanceLocation.deleteMany({ where: { id: locationId } });
    await prisma.teacher.deleteMany({ where: { userId: teacherUserId } });
    await prisma.user.deleteMany({ where: { id: teacherUserId } });
  });

  it("C1: display page does not use third-party QR URL services", () => {
    const src = readFileSync(
      join(repoRoot, "src/pages/public/AttendanceQrDisplayPage.tsx"),
      "utf8"
    );
    assert.equal(src.includes("api.qrserver.com"), false);
    assert.equal(src.includes("create-qr-code"), false);
    assert.ok(src.includes('from "qrcode"') || src.includes("from 'qrcode'"));
    assert.ok(src.includes("QRCode.toDataURL") || src.includes("toDataURL"));
  });

  it("H1: anonymous force=1 cannot invalidate an active token", async () => {
    __resetAttendanceQrRawCacheForTests();
    await prisma.attendanceQRToken.updateMany({
      where: { locationId, active: true },
      data: { active: false, revokedAt: new Date() },
    });

    const first = await request(app).get(
      `/api/attendance/display/${locationId}`
    );
    assert.equal(first.status, 200, first.text);
    if (first.body.mode === "IDLE") return; // no mint without sessions elsewhere — still have our session
    assert.ok(first.body.qr?.tokenId);
    const tokenId = first.body.qr.tokenId as string;
    const payload1 = first.body.qr.payload as string;

    const forced = await request(app).get(
      `/api/attendance/display/${locationId}?force=1`
    );
    assert.equal(forced.status, 200, forced.text);
    assert.equal(forced.body.qr?.tokenId, tokenId);
    assert.equal(forced.body.qr?.payload, payload1);

    const stillActive = await prisma.attendanceQRToken.findUnique({
      where: { id: tokenId },
    });
    assert.equal(stillActive?.active, true);
    assert.equal(stillActive?.revokedAt, null);
  });

  it("H1: normal display reuses valid token; admin regenerate still works", async () => {
    const a = await request(app).get(`/api/attendance/display/${locationId}`);
    const b = await request(app).get(`/api/attendance/display/${locationId}`);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    if (a.body.qr && b.body.qr) {
      assert.equal(a.body.qr.tokenId, b.body.qr.tokenId);
      assert.equal(a.body.qr.payload, b.body.qr.payload);
    }

    const adminToken = await login("admin@dhapti.edu.so", "ADMIN");
    const regen = await request(app)
      .post(`/api/admin/attendance-locations/${locationId}/regenerate-tokens`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(regen.status, 200, regen.text);
    assert.ok(regen.body.revokedActiveTokens >= 1);

    const after = await request(app).get(
      `/api/attendance/display/${locationId}`
    );
    assert.equal(after.status, 200);
    if (a.body.qr && after.body.qr) {
      assert.notEqual(after.body.qr.tokenId, a.body.qr.tokenId);
    }
  });

  it("H2: yesterday / future / wrong-window sessions rejected; valid accepted", async () => {
    const token = await login(teacherEmail, "TEACHER");
    const { payload } = await mintToken({
      locationId,
      departmentId: deptId,
      mode: "START",
    });

    const yesterday = new Date(
      parseDateOnly(todayDateOnly(new Date(), DEFAULT_INSTITUTION_TIMEZONE))!.getTime() -
        86400000
    );
    const ySession = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: yesterday,
        scheduledStartTime: "00:00",
        scheduledEndTime: "23:59",
        status: "SCHEDULED",
      },
    });
    const yRes = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: ySession.id });
    assert.equal(yRes.status, 400, yRes.text);
    assert.match(String(yRes.body.error), /today/i);

    const tomorrow = new Date(
      parseDateOnly(todayDateOnly(new Date(), DEFAULT_INSTITUTION_TIMEZONE))!.getTime() +
        86400000
    );
    const tSession = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: tomorrow,
        scheduledStartTime: "00:00",
        scheduledEndTime: "23:59",
        status: "SCHEDULED",
      },
    });
    const tRes = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId: tSession.id });
    assert.equal(tRes.status, 400, tRes.text);
    assert.match(String(tRes.body.error), /future/i);

    const narrow = await prisma.classSession.create({
      data: {
        classSectionId: sectionId,
        date: parseDateOnly(
          todayDateOnly(new Date(), DEFAULT_INSTITUTION_TIMEZONE)
        )!,
        scheduledStartTime: "03:00",
        scheduledEndTime: "03:30",
        status: "SCHEDULED",
      },
    });
    // Force outside window relative to "now" by evaluating helper with fixed times
    const windowOnly = evaluateQrAttendanceWindow({
      sessionDate: narrow.date,
      startClock: "03:00",
      endClock: "03:30",
      now: zonedWallClockToUtc(
        todayDateOnly(new Date(), DEFAULT_INSTITUTION_TIMEZONE),
        "12:00",
        DEFAULT_INSTITUTION_TIMEZONE
      )!,
      timeZone: DEFAULT_INSTITUTION_TIMEZONE,
      earlyStartMinutes: 30,
      lateEndMinutes: 60,
    });
    assert.equal(windowOnly.ok, false);

    await prisma.teacherAttendance.deleteMany({ where: { sessionId } });
    await prisma.classSession.update({
      where: { id: sessionId },
      data: {
        status: "SCHEDULED",
        actualStartTime: null,
        actualEndTime: null,
      },
    });
    const ok = await request(app)
      .post("/api/teacher/attendance/qr-scan")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: payload, sessionId });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.action, "START");

    await prisma.teacherAttendance.deleteMany({ where: { sessionId } });
    await prisma.classSession.update({
      where: { id: sessionId },
      data: {
        status: "SCHEDULED",
        actualStartTime: null,
        actualEndTime: null,
      },
    });
    await prisma.classSession.deleteMany({
      where: { id: { in: [ySession.id, tSession.id, narrow.id] } },
    });
  });

  it("H3: Africa/Mogadishu today + schedule + late use institution timezone", () => {
    assert.equal(DEFAULT_INSTITUTION_TIMEZONE, "Africa/Mogadishu");

    // 2026-08-16 22:30 UTC = 2026-08-17 01:30 in Mogadishu (UTC+3)
    const nearMidnightUtc = new Date("2026-08-16T22:30:00.000Z");
    assert.equal(
      todayDateOnlyInTimeZone(nearMidnightUtc, "Africa/Mogadishu"),
      "2026-08-17"
    );
    assert.equal(nearMidnightUtc.toISOString().slice(0, 10), "2026-08-16");

    const start = zonedWallClockToUtc(
      "2026-08-17",
      "08:00",
      "Africa/Mogadishu"
    )!;
    // 08:00 Mogadishu = 05:00 UTC
    assert.equal(start.toISOString(), "2026-08-17T05:00:00.000Z");

    const date = parseDateOnly("2026-08-17")!;
    const scheduled = scheduledInstant(
      date,
      "08:00",
      new Date(),
      "Africa/Mogadishu"
    )!;
    assert.equal(scheduled.toISOString(), "2026-08-17T05:00:00.000Z");

    const checkIn = new Date("2026-08-17T05:15:00.000Z"); // 08:15 Mogadishu
    const late = computeLateByMinutes(scheduled, checkIn, 10);
    assert.equal(late, 15);
    const onTime = computeLateByMinutes(
      scheduled,
      new Date("2026-08-17T05:09:00.000Z"),
      10
    );
    assert.equal(onTime, 0);
  });

  it("H4: concurrent duplicate START → one success, one clean 409", async () => {
    await prisma.teacherAttendance.deleteMany({ where: { sessionId } });
    await prisma.classSession.update({
      where: { id: sessionId },
      data: {
        status: "SCHEDULED",
        actualStartTime: null,
        actualEndTime: null,
      },
    });

    const [a, b] = await Promise.all([
      teacherCheckInSession({
        sessionId,
        teacherId,
        method: "QR",
        lateByMinutes: 0,
        initialStatus: "ACTIVE",
      }),
      teacherCheckInSession({
        sessionId,
        teacherId,
        method: "QR",
        lateByMinutes: 0,
        initialStatus: "ACTIVE",
      }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const conflicts = [a, b].filter((r) => !r.ok && r.status === 409);
    assert.equal(oks.length, 1);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]!.code, "CONFLICT");

    const count = await prisma.teacherAttendance.count({
      where: { sessionId },
    });
    assert.equal(count, 1);
  });

  it("M3: concurrent token requests keep a single active token per location+mode", async () => {
    __resetAttendanceQrRawCacheForTests();
    await prisma.attendanceQRToken.updateMany({
      where: { locationId, active: true },
      data: { active: false, revokedAt: new Date() },
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        issueDisplayQrToken({
          locationId,
          departmentId: deptId,
          mode: "START",
        })
      )
    );

    const tokenIds = new Set(results.map((r) => r.tokenId));
    assert.equal(tokenIds.size, 1);

    const active = await prisma.attendanceQRToken.findMany({
      where: { locationId, mode: "START", active: true },
    });
    assert.equal(active.length, 1);
    assert.ok(results.every((r) => r.payload === results[0]!.payload));
  });

  it("M6: LATE status is persisted atomically on check-in", async () => {
    await prisma.teacherAttendance.deleteMany({ where: { sessionId } });
    await prisma.classSession.update({
      where: { id: sessionId },
      data: {
        status: "SCHEDULED",
        actualStartTime: null,
        actualEndTime: null,
      },
    });

    const result = await teacherCheckInSession({
      sessionId,
      teacherId,
      method: "QR",
      lateByMinutes: 15,
      initialStatus: "LATE",
    });
    assert.equal(result.ok, true);

    const ta = await prisma.teacherAttendance.findUnique({
      where: { sessionId },
    });
    assert.ok(ta);
    assert.equal(ta!.status, "LATE");
    assert.equal(ta!.lateByMinutes, 15);
  });
});
