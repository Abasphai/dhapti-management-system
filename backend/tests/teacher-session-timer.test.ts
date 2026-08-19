import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import {
  REQUIRED_CLASS_MINUTES,
  addMinutes,
  formatCountdown,
  isEarlyExit,
  minutesBetween,
  remainingMs,
  resolveTimerStatus,
} from "../src/lib/teacherSessionTimer.js";

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

describe("Teacher 2-hour session timer policy (unit)", () => {
  it("requires exactly 120 minutes and flags early exit", () => {
    assert.equal(REQUIRED_CLASS_MINUTES, 120);
    const checkIn = new Date("2026-08-11T08:00:00.000Z");
    const earlyOut = addMinutes(checkIn, 45);
    const onTime = addMinutes(checkIn, 120);
    const late = addMinutes(checkIn, 125);

    assert.equal(minutesBetween(checkIn, earlyOut), 45);
    assert.equal(isEarlyExit(checkIn, earlyOut), true);
    assert.equal(resolveTimerStatus(checkIn, earlyOut), "EARLY_EXIT");
    assert.equal(isEarlyExit(checkIn, onTime), false);
    assert.equal(resolveTimerStatus(checkIn, onTime), "COMPLETED");
    assert.equal(resolveTimerStatus(checkIn, late), "COMPLETED");

    const remaining = remainingMs(checkIn, 120, addMinutes(checkIn, 30));
    assert.equal(remaining, 90 * 60_000);
    assert.equal(formatCountdown(remaining).label, "01h : 30m : 00s");
  });
});

describe("Teacher 2-hour session timer APIs", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let classId = "";
  let sessionId = "";

  after(async () => {
    if (classId) {
      const sessions = await prisma.classSession.findMany({
        where: { classSectionId: classId },
        select: { id: true },
      });
      const sids = sessions.map((s) => s.id);
      if (sids.length) {
        await prisma.teacherAttendance
          .deleteMany({ where: { sessionId: { in: sids } } })
          .catch(() => {});
        await prisma.classSession
          .deleteMany({ where: { id: { in: sids } } })
          .catch(() => {});
      }
      await prisma.classSection
        .deleteMany({ where: { id: classId } })
        .catch(() => {});
    }
    if (courseId) {
      await prisma.courseTeacher
        .deleteMany({ where: { courseId } })
        .catch(() => {});
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    if (teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
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

  it("check-in starts ACTIVE timer; early check-out needs confirm; admin live monitor", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Timer Fac ${suffix}`,
        code: `TF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Timer Dept ${suffix}`,
        code: `TD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `TC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Timer Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Timer Teacher ${suffix}`,
        email: `timer_t_${suffix}@dhapti.edu.so`,
        facultyCode: `TT${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherToken = await login(`timer_t_${suffix}@dhapti.edu.so`, "TEACHER");

    const assign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.ok([200, 201].includes(assign.status), assign.text);

    const cls = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2025-2026",
        semester: "Semester 1",
        dayOfWeek: "MONDAY",
        startTime: "08:00",
        endTime: "10:00",
        room: "T1",
      });
    assert.equal(cls.status, 201, cls.text);
    classId = cls.body.id;

    const checkIn = await request(app)
      .post("/api/teacher/attendance/check-in")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ classSectionId: classId });
    assert.equal(checkIn.status, 200, checkIn.text);
    sessionId = checkIn.body.id;
    assert.equal(checkIn.body.accountStatus, "OPEN");
    assert.equal(checkIn.body.teacherAttendance?.status, "ACTIVE");
    assert.equal(checkIn.body.teacherAttendance?.requiredMinutes, 120);
    assert.ok(checkIn.body.teacherAttendance?.expectedCheckOutAt);
    assert.ok(checkIn.body.timer?.countdown);

    const active = await request(app)
      .get("/api/teacher/attendance/active-session")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(active.status, 200, active.text);
    assert.equal(active.body.active, true);
    assert.equal(active.body.session.sessionId, sessionId);
    assert.equal(active.body.session.status, "ACTIVE");
    assert.equal(active.body.session.canCheckOutFreely, false);
    assert.ok(active.body.session.countdown);

    const blocked = await request(app)
      .post("/api/teacher/attendance/check-out")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ sessionId });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, "EARLY_EXIT_CONFIRMATION_REQUIRED");
    assert.ok(typeof blocked.body.completedMinutes === "number");
    assert.equal(blocked.body.requiredMinutes, 120);

    const early = await request(app)
      .post("/api/teacher/attendance/check-out")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ sessionId, confirmEarlyExit: true });
    assert.equal(early.status, 200, early.text);
    assert.equal(early.body.timerStatus, "EARLY_EXIT");
    assert.equal(early.body.teacherAttendance?.status, "EARLY_EXIT");
    assert.ok(typeof early.body.completedMinutes === "number");
    assert.ok(early.body.completedMinutes! < 120);

    const inactive = await request(app)
      .get("/api/teacher/attendance/active-session")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(inactive.status, 200);
    assert.equal(inactive.body.active, false);

    // Simulate completed (full 120m) on a second session via DB clock backdate
    const ensured = await request(app)
      .post(`/api/classes/${classId}/sessions/ensure`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ date: "2099-01-02" });
    assert.ok([200, 201].includes(ensured.status), ensured.text);
    const session2 = ensured.body.id as string;

    const start2 = await request(app)
      .post("/api/teacher/attendance/check-in")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ sessionId: session2 });
    assert.equal(start2.status, 200, start2.text);

    const past = addMinutes(new Date(), -121);
    await prisma.teacherAttendance.update({
      where: { sessionId: session2 },
      data: {
        startedAt: past,
        expectedCheckOutAt: addMinutes(past, 120),
      },
    });
    await prisma.classSession.update({
      where: { id: session2 },
      data: { actualStartTime: past },
    });

    const done = await request(app)
      .post("/api/teacher/attendance/check-out")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ sessionId: session2 });
    assert.equal(done.status, 200, done.text);
    assert.equal(done.body.timerStatus, "COMPLETED");
    assert.equal(done.body.teacherAttendance?.status, "COMPLETED");
    assert.ok((done.body.completedMinutes ?? 0) >= 120);

    const monitor = await request(app)
      .get("/api/admin/teacher-attendance/live-monitor")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(monitor.status, 200, monitor.text);
    assert.ok(Array.isArray(monitor.body.earlyExits));
    assert.ok(Array.isArray(monitor.body.activeClasses));
    assert.ok(Array.isArray(monitor.body.missedClasses));
    assert.ok(Array.isArray(monitor.body.monthlyPayrollRows));
    assert.ok(
      monitor.body.earlyExits.some(
        (r: { sessionId: string }) => r.sessionId === sessionId
      ) ||
        monitor.body.monthlyPayrollRows.some(
          (r: { status: string }) => r.status === "EARLY_EXIT"
        )
    );

    // Manual / makeup check-in on a date with no prior session appears on live monitor
    const makeupDate = "2099-06-15";
    const makeup = await request(app)
      .post("/api/teacher/attendance/check-in")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ classSectionId: classId, date: makeupDate });
    assert.equal(makeup.status, 200, makeup.text);
    assert.equal(makeup.body.accountStatus, "OPEN");
    assert.equal(makeup.body.teacherAttendance?.status, "ACTIVE");
    const makeupSessionId = makeup.body.id as string;

    const liveMakeup = await request(app)
      .get(
        `/api/admin/teacher-attendance/live-monitor?date=${encodeURIComponent(makeupDate)}`
      )
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(liveMakeup.status, 200, liveMakeup.text);
    assert.ok(
      liveMakeup.body.activeClasses.some(
        (r: { sessionId: string }) => r.sessionId === makeupSessionId
      ),
      "manually started session should appear in admin live monitor"
    );

    await request(app)
      .post("/api/teacher/attendance/check-out")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ sessionId: makeupSessionId, confirmEarlyExit: true });
  });
});
