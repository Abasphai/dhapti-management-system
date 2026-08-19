import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { hashPassword } from "../src/lib/auth.js";
import { createApp } from "../src/app.js";
import { hasPermission, Permission } from "../src/lib/permissions.js";
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

describe("Step 1 — Exam Control & Admit Card clearance", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const examAdminEmail = `exam.step1.${suffix}@dhapti.edu.so`;
  const heldStudentEmail = `held.att.${suffix}@dhapti.edu.so`;
  const feeStudentEmail = `held.fee.${suffix}@dhapti.edu.so`;
  const clearedStudentEmail = `cleared.${suffix}@dhapti.edu.so`;

  let examAdminUserId = "";
  let sessionId = "";
  let courseId = "";
  let classSectionId = "";
  let classSessionId = "";
  let heldStudentId = "";
  let feeStudentId = "";
  let clearedStudentId = "";
  let feePaymentId = "";

  before(async () => {
    const passwordHash = await hashPassword("DHAPTI@2026");
    const course =
      (await prisma.course.findFirst({ where: { code: "CS101" } })) ??
      (await prisma.course.findFirst());
    assert.ok(course, "Need a course");
    courseId = course!.id;

    let section = await prisma.classSection.findFirst({
      where: { courseId },
    });
    if (!section) {
      const teacher = await prisma.teacher.findFirst();
      assert.ok(teacher, "Need a teacher for class section");
      section = await prisma.classSection.create({
        data: {
          courseId,
          teacherId: teacher!.id,
          section: `EX${suffix}`.slice(0, 8),
          semester: "1",
          academicYear: "2025/2026",
        },
      });
    }
    classSectionId = section.id;

    const meeting = await prisma.classSession.create({
      data: {
        classSectionId,
        date: new Date("2026-03-01T00:00:00.000Z"),
        status: "COMPLETED",
        topic: `Exam clearance fixture ${suffix}`,
      },
    });
    classSessionId = meeting.id;

    const examAdmin = await prisma.user.create({
      data: {
        email: examAdminEmail,
        passwordHash,
        role: "EXAM_ADMIN",
        admin: {
          create: {
            fullName: "Step1 Exam Admin",
            email: examAdminEmail,
          },
        },
      },
    });
    examAdminUserId = examAdmin.id;

    const faculty = await prisma.faculty.findFirst();
    const department = await prisma.department.findFirst();

    async function makeStudent(
      email: string,
      code: string
    ): Promise<{ userId: string; studentId: string }> {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: "STUDENT",
          student: {
            create: {
              studentCode: code,
              fullName: `Student ${code}`,
              email,
              facultyId: faculty?.id,
              departmentId: department?.id,
              semester: "4",
              program: "BSc CS",
            },
          },
        },
        include: { student: true },
      });
      assert.ok(user.student);
      await prisma.enrollment.create({
        data: {
          studentId: user.student!.id,
          classSectionId,
          status: "ACTIVE",
        },
      });
      return { userId: user.id, studentId: user.student!.id };
    }

    const held = await makeStudent(
      heldStudentEmail,
      `HLD-${suffix}`.slice(0, 16)
    );
    heldStudentId = held.studentId;
    // 1 present + 2 absent = 33% (< 75%)
    await prisma.studentAttendance.createMany({
      data: [
        {
          sessionId: classSessionId,
          studentId: heldStudentId,
          status: "PRESENT",
          teacherId: (await prisma.teacher.findFirst())!.id,
        },
      ],
    });
    const meeting2 = await prisma.classSession.create({
      data: {
        classSectionId,
        date: new Date("2026-03-02T00:00:00.000Z"),
        status: "COMPLETED",
        topic: `Abs1 ${suffix}`,
      },
    });
    const meeting3 = await prisma.classSession.create({
      data: {
        classSectionId,
        date: new Date("2026-03-03T00:00:00.000Z"),
        status: "COMPLETED",
        topic: `Abs2 ${suffix}`,
      },
    });
    const teacherId = (await prisma.teacher.findFirst())!.id;
    await prisma.studentAttendance.createMany({
      data: [
        {
          sessionId: meeting2.id,
          studentId: heldStudentId,
          status: "ABSENT",
          teacherId,
        },
        {
          sessionId: meeting3.id,
          studentId: heldStudentId,
          status: "ABSENT",
          teacherId,
        },
      ],
    });

    const fee = await makeStudent(feeStudentEmail, `FEE-${suffix}`.slice(0, 16));
    feeStudentId = fee.studentId;
    // 100% attendance
    await prisma.studentAttendance.create({
      data: {
        sessionId: classSessionId,
        studentId: feeStudentId,
        status: "PRESENT",
        teacherId,
      },
    });
    const payment = await prisma.payment.create({
      data: {
        studentId: feeStudentId,
        amount: 300,
        description: `Overdue tuition ${suffix}`,
        status: "OVERDUE",
        dueDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    feePaymentId = payment.id;

    const cleared = await makeStudent(
      clearedStudentEmail,
      `CLR-${suffix}`.slice(0, 16)
    );
    clearedStudentId = cleared.studentId;
    await prisma.studentAttendance.create({
      data: {
        sessionId: classSessionId,
        studentId: clearedStudentId,
        status: "PRESENT",
        teacherId,
      },
    });

    const session = await prisma.examSession.create({
      data: {
        title: `Step1 Midterm ${suffix}`,
        semester: "4",
        status: "ACTIVE",
        published: true,
        createdById: examAdminUserId,
      },
    });
    sessionId = session.id;

    await prisma.examSchedule.create({
      data: {
        examSessionId: sessionId,
        courseId,
        examDate: new Date("2026-08-20T08:00:00.000Z"),
        timeSlot: "08:00 – 11:00",
        room: "Hall B",
        chiefInvigilator: "Dr. Invigilator",
      },
    });
  });

  after(async () => {
    await prisma.examAdmitCard
      .deleteMany({ where: { examSessionId: sessionId } })
      .catch(() => {});
    await prisma.examSchedule
      .deleteMany({ where: { examSessionId: sessionId } })
      .catch(() => {});
    await prisma.examSession
      .deleteMany({ where: { id: sessionId } })
      .catch(() => {});
    if (feePaymentId) {
      await prisma.payment.deleteMany({ where: { id: feePaymentId } }).catch(() => {});
    }
    for (const sid of [heldStudentId, feeStudentId, clearedStudentId]) {
      if (!sid) continue;
      await prisma.studentAttendance
        .deleteMany({ where: { studentId: sid } })
        .catch(() => {});
      await prisma.enrollment
        .deleteMany({ where: { studentId: sid } })
        .catch(() => {});
      await prisma.student.deleteMany({ where: { id: sid } }).catch(() => {});
    }
    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [
              examAdminEmail,
              heldStudentEmail,
              feeStudentEmail,
              clearedStudentEmail,
            ],
          },
        },
      })
      .catch(() => {});
    await prisma.classSession
      .deleteMany({
        where: { topic: { contains: suffix } },
      })
      .catch(() => {});
  });

  it("EXAM_ADMIN permissions exclude finance, settings, and CMS", () => {
    assert.equal(hasPermission("EXAM_ADMIN", Permission.EXAMS_READ), true);
    assert.equal(hasPermission("EXAM_ADMIN", Permission.EXAMS_MANAGE), true);
    assert.equal(
      hasPermission("EXAM_ADMIN", Permission.ADMITCARDS_GENERATE),
      true
    );
    assert.equal(hasPermission("EXAM_ADMIN", Permission.RESULTS_PUBLISH), true);
    assert.equal(hasPermission("EXAM_ADMIN", Permission.FINANCE_READ), false);
    assert.equal(hasPermission("EXAM_ADMIN", Permission.FINANCE_MANAGE), false);
    assert.equal(hasPermission("EXAM_ADMIN", Permission.SETTINGS_MANAGE), false);
    assert.equal(
      hasPermission("EXAM_ADMIN", Permission.CMS_PAGES_MANAGE),
      false
    );
  });

  it("EXAM_ADMIN login via admin portal works; finance and CMS return 403", async () => {
    const token = await login(examAdminEmail, "ADMIN");
    const finance = await request(app)
      .get("/api/admin/finance/summary")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(finance.status, 403);

    const cms = await request(app)
      .get("/api/admin/cms/settings")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(cms.status, 403);

    const settingsAdmin = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(settingsAdmin.status, 403);
  });

  it("attendance < 75% blocks admit card (HELD)", async () => {
    const token = await login(heldStudentEmail, "STUDENT");
    const res = await request(app)
      .get("/api/student/admit-card")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.status, "HELD");
    assert.ok(
      (res.body.clearance?.blockers ?? []).some((b: string) =>
        /Attendance/i.test(b)
      ),
      JSON.stringify(res.body.clearance)
    );
    assert.equal(res.body.admitCard, null);
  });

  it("fee due > 0 blocks admit card (HELD)", async () => {
    const token = await login(feeStudentEmail, "STUDENT");
    const res = await request(app)
      .get("/api/student/admit-card")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.status, "HELD");
    assert.ok(
      (res.body.clearance?.blockers ?? []).some((b: string) =>
        /Tuition|Outstanding|Financial/i.test(b)
      ),
      JSON.stringify(res.body.clearance)
    );
  });

  it("cleared students get 200 with CLEARED admit card payload", async () => {
    const token = await login(clearedStudentEmail, "STUDENT");
    const res = await request(app)
      .get("/api/student/admit-card")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.status, "CLEARED");
    assert.ok(res.body.admitCard?.verificationCode);
    assert.ok(Array.isArray(res.body.timetable));
    assert.equal(res.body.student.studentCode.startsWith("CLR-"), true);
  });

  it("EXAM_ADMIN can load clearance roster and apply override", async () => {
    const token = await login(examAdminEmail, "ADMIN");
    const roster = await request(app)
      .get(`/api/admin/exams/clearance-roster?examSessionId=${sessionId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(roster.status, 200, roster.text);
    const heldRow = roster.body.rows.find(
      (r: { studentId: string }) => r.studentId === heldStudentId
    );
    assert.ok(heldRow, "held student in roster");
    assert.equal(heldRow.status, "HELD");

    const override = await request(app)
      .patch(`/api/admin/exams/clearance/${heldRow.id}/override`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Dean special approval for medical leave", status: "CLEARED" });
    assert.equal(override.status, 200, override.text);
    assert.equal(override.body.status, "CLEARED");

    const studentToken = await login(heldStudentEmail, "STUDENT");
    const admit = await request(app)
      .get("/api/student/admit-card")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(admit.status, 200);
    assert.equal(admit.body.status, "CLEARED");
    assert.equal(admit.body.clearance.manualOverride, true);
  });
});
