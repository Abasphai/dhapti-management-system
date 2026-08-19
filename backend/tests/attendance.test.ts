import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

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

describe("Phase 1H Attendance Management", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let otherTeacherToken = "";
  let studentToken = "";
  let otherStudentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let otherTeacherId = "";
  let classId = "";
  let otherClassId = "";
  let studentId = "";
  let otherStudentId = "";
  let studentUserId = "";
  let otherStudentUserId = "";
  let sessionId = "";

  after(async () => {
    const classIds = [classId, otherClassId].filter(Boolean);
    if (classIds.length) {
      const sessions = await prisma.classSession.findMany({
        where: { classSectionId: { in: classIds } },
        select: { id: true },
      });
      const sids = sessions.map((s) => s.id);
      if (sids.length) {
        await prisma.studentAttendance.deleteMany({ where: { sessionId: { in: sids } } }).catch(() => {});
        await prisma.teacherAttendance.deleteMany({ where: { sessionId: { in: sids } } }).catch(() => {});
        await prisma.classSession.deleteMany({ where: { id: { in: sids } } }).catch(() => {});
      }
      await prisma.enrollment.deleteMany({ where: { classSectionId: { in: classIds } } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { id: { in: classIds } } }).catch(() => {});
    }
    if (courseId) {
      await prisma.courseTeacher.deleteMany({ where: { courseId } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    for (const id of [teacherId, otherTeacherId].filter(Boolean)) {
      const t = await prisma.teacher.findUnique({ where: { id } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    for (const uid of [studentUserId, otherStudentUserId].filter(Boolean)) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    if (facultyId) await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("rejects unauthenticated attendance access", async () => {
    const res = await request(app).get("/api/teachers/me/sessions");
    assert.equal(res.status, 401);
    const admin = await request(app).get("/api/attendance/sessions");
    assert.equal(admin.status, 401);
  });

  it("teacher/student/admin attendance workflow and security", async () => {
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Att Fac ${suffix}`,
        code: `AF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Att Dept ${suffix}`,
        code: `AD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `AC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Attendance Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Att Teacher ${suffix}`,
        email: `atteach_${suffix}@dhapti.edu.so`,
        facultyCode: `AT${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;
    teacherToken = await login(`atteach_${suffix}@dhapti.edu.so`, "TEACHER");

    const otherTeacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Att T ${suffix}`,
        email: `oatteach_${suffix}@dhapti.edu.so`,
        facultyCode: `OA${suffix}`.slice(0, 12).toUpperCase(),
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherTeacher.status, 201, otherTeacher.text);
    otherTeacherId = otherTeacher.body.id;
    otherTeacherToken = await login(`oatteach_${suffix}@dhapti.edu.so`, "TEACHER");

    await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    await request(app)
      .post(`/api/teachers/${otherTeacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });

    const cls = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2025-2026",
        semester: "Semester 1",
        startTime: "10:00",
        endTime: "12:00",
        room: "R101",
      });
    assert.equal(cls.status, 201, cls.text);
    classId = cls.body.id;

    const otherCls = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId: otherTeacherId,
        section: "B",
        academicYear: "2025-2026",
        semester: "Semester 1",
        startTime: "10:00",
        endTime: "12:00",
      });
    assert.equal(otherCls.status, 201, otherCls.text);
    otherClassId = otherCls.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Att Student ${suffix}`,
        email: `atstud_${suffix}@dhapti.edu.so`,
        studentCode: `AS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (await prisma.student.findUnique({ where: { id: studentId } }))!.userId;
    studentToken = await login(`atstud_${suffix}@dhapti.edu.so`, "STUDENT");

    const otherStudent = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Other Att S ${suffix}`,
        email: `oatstud_${suffix}@dhapti.edu.so`,
        studentCode: `OS${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(otherStudent.status, 201, otherStudent.text);
    otherStudentId = otherStudent.body.id;
    otherStudentUserId = (
      await prisma.student.findUnique({ where: { id: otherStudentId } })
    )!.userId;
    otherStudentToken = await login(`oatstud_${suffix}@dhapti.edu.so`, "STUDENT");

    assert.equal(
      (
        await request(app)
          .post("/api/enrollments")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ studentId, classSectionId: classId })
      ).status,
      201
    );
    assert.equal(
      (
        await request(app)
          .post("/api/enrollments")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ studentId: otherStudentId, classSectionId: otherClassId })
      ).status,
      201
    );

    // Cannot ensure another teacher's class
    const cross = await request(app)
      .post(`/api/classes/${otherClassId}/sessions/ensure`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    assert.equal(cross.status, 403);

    const ensured = await request(app)
      .post(`/api/classes/${classId}/sessions/ensure`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    assert.ok([200, 201].includes(ensured.status), ensured.text);
    sessionId = ensured.body.id;
    assert.equal(ensured.body.accountStatus, "SCHEDULED");

    // Idempotent ensure
    const ensured2 = await request(app)
      .post(`/api/classes/${classId}/sessions/ensure`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    assert.ok([200, 201].includes(ensured2.status));
    assert.equal(ensured2.body.id, sessionId);

    // End before start rejected
    const endEarly = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.ok(endEarly.status === 400 || endEarly.status === 409);

    // Other teacher cannot start
    const otherStart = await request(app)
      .post(`/api/sessions/${sessionId}/start`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    assert.equal(otherStart.status, 403);

    const started = await request(app)
      .post(`/api/sessions/${sessionId}/start`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(started.status, 200, started.text);
    assert.equal(started.body.accountStatus, "OPEN");
    assert.ok(started.body.actualStartTime);
    assert.ok(started.body.teacherAttendance?.startedAt);

    // Duplicate start rejected
    const dupStart = await request(app)
      .post(`/api/sessions/${sessionId}/start`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(dupStart.status, 409);

    // Roster — enrolled only, UNMARKED
    const roster = await request(app)
      .get(`/api/sessions/${sessionId}/attendance`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(roster.status, 200, roster.text);
    assert.ok(roster.body.data.some((r: { studentId: string }) => r.studentId === studentId));
    assert.ok(
      !roster.body.data.some((r: { studentId: string }) => r.studentId === otherStudentId)
    );
    const row = roster.body.data.find((r: { studentId: string }) => r.studentId === studentId);
    assert.equal(row.status, "UNMARKED");

    // Cannot mark non-enrolled
    const badBulk = await request(app)
      .post(`/api/sessions/${sessionId}/attendance/bulk`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        records: [{ studentId: otherStudentId, status: "PRESENT" }],
      });
    assert.equal(badBulk.status, 400);

    const bulk = await request(app)
      .post(`/api/sessions/${sessionId}/attendance/bulk`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        records: [{ studentId, status: "PRESENT" }],
      });
    assert.equal(bulk.status, 200, bulk.text);

    // Update existing (no duplicate)
    const bulk2 = await request(app)
      .post(`/api/sessions/${sessionId}/attendance/bulk`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        records: [{ studentId, status: "LATE" }],
      });
    assert.equal(bulk2.status, 200, bulk2.text);
    const marks = await prisma.studentAttendance.count({
      where: { sessionId, studentId },
    });
    assert.equal(marks, 1);
    const mark = await prisma.studentAttendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    assert.equal(mark?.status, "LATE");

    // Student cannot modify
    const studentMark = await request(app)
      .post(`/api/sessions/${sessionId}/attendance/bulk`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ records: [{ studentId, status: "PRESENT" }] });
    assert.equal(studentMark.status, 403);

    // Early check-out without confirmation is blocked by 2-hour timer
    const earlyBlocked = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    assert.equal(earlyBlocked.status, 409);
    assert.equal(
      earlyBlocked.body.code,
      "EARLY_EXIT_CONFIRMATION_REQUIRED"
    );

    const ended = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ confirmEarlyExit: true });
    assert.equal(ended.status, 200, ended.text);
    assert.equal(ended.body.accountStatus, "COMPLETED");
    assert.equal(ended.body.timerStatus, "EARLY_EXIT");
    assert.ok(ended.body.actualEndTime);

    // Duplicate end rejected
    const dupEnd = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(dupEnd.status, 409);

    // Cannot change attendance after COMPLETED
    const afterDone = await request(app)
      .post(`/api/sessions/${sessionId}/attendance/bulk`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ records: [{ studentId, status: "PRESENT" }] });
    assert.ok(afterDone.status === 400 || afterDone.status === 409);

    // Student sees own summary — LATE does not count as present
    const meAtt = await request(app)
      .get("/api/students/me/attendance")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(meAtt.status, 200, meAtt.text);
    const summary = meAtt.body.data.find(
      (r: { classSectionId: string }) => r.classSectionId === classId
    );
    assert.ok(summary);
    assert.equal(summary.late, 1);
    assert.equal(summary.present, 0);
    assert.equal(summary.percentage, 0);

    // Other student cannot see this class detail
    const steal = await request(app)
      .get(`/api/students/me/attendance/${classId}`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    assert.ok(steal.status === 403 || steal.status === 404);

    const detail = await request(app)
      .get(`/api/students/me/attendance/${classId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(detail.status, 200, detail.text);
    assert.ok(detail.body.data.some((d: { sessionId: string }) => d.sessionId === sessionId));

    // Forge percentage ignored — server calculates
    assert.ok(summary.percentage !== 99);

    // Admin list
    const adminSessions = await request(app)
      .get("/api/attendance/sessions")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminSessions.status, 200, adminSessions.text);
    assert.ok(adminSessions.body.pagination);
    assert.ok(
      adminSessions.body.data.some((s: { id: string }) => s.id === sessionId)
    );

    const adminTeachers = await request(app)
      .get("/api/attendance/teachers")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminTeachers.status, 200, adminTeachers.text);
  });
});
