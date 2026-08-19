import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { Permission, hasPermission } from "../src/lib/permissions.js";

const app = createApp();

describe("Financial hold & teacher ratings", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let studentToken = "";
  let teacherToken = "";
  let studentId = "";
  let teacherId = "";
  let courseId = "";
  let paymentId = "";
  let ratingId = "";
  let semester = "";
  let academicYear = "";

  after(async () => {
    if (ratingId) {
      await prisma.teacherRating.delete({ where: { id: ratingId } }).catch(() => {});
    }
    if (paymentId) {
      await prisma.payment.delete({ where: { id: paymentId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("permission catalog includes ratings", () => {
    assert.equal(hasPermission("STUDENT", Permission.RATINGS_CREATE), true);
    assert.equal(hasPermission("TEACHER", Permission.RATINGS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.RATINGS_REPORT), true);
    assert.equal(hasPermission("STUDENT", Permission.RATINGS_REPORT), false);
  });

  it("financial hold blocks student results until dues are cleared", async () => {
    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    assert.equal(adminLogin.status, 200, adminLogin.text);
    adminToken = adminLogin.body.token;

    const studentLogin = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    assert.equal(studentLogin.status, 200, studentLogin.text);
    studentToken = studentLogin.body.token;

    const teacherLogin = await request(app).post("/api/auth/login").send({
      email: "mohamed.ali@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "TEACHER",
    });
    assert.equal(teacherLogin.status, 200, teacherLogin.text);
    teacherToken = teacherLogin.body.token;

    const student = await prisma.student.findFirst({
      where: { user: { email: "mohamudcade143@gmail.com" } },
      select: { id: true },
    });
    assert.ok(student);
    studentId = student!.id;

    const holdBefore = await request(app)
      .get("/api/students/me/financial-hold")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(holdBefore.status, 200, holdBefore.text);

    // Ensure outstanding dues exist for this student.
    const charge = await request(app)
      .post("/api/admin/finance/record-payment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId,
        amount: 75,
        description: `Hold test fee ${suffix}`,
        semester: "Semester 1",
        status: "PENDING",
        dueDate: new Date(Date.now() - 86400000).toISOString(),
      });
    assert.equal(charge.status, 201, charge.text);
    paymentId = charge.body.id ?? charge.body.payment?.id;
    if (!paymentId && charge.body?.data?.id) paymentId = charge.body.data.id;

    // Fallback: locate newest unpaid payment for student
    if (!paymentId) {
      const created = await prisma.payment.findFirst({
        where: { studentId, description: { contains: suffix } },
        orderBy: { createdAt: "desc" },
      });
      paymentId = created?.id ?? "";
    }
    assert.ok(paymentId, "payment should be created");

    const hold = await request(app)
      .get("/api/students/me/financial-hold")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(hold.status, 200, hold.text);
    assert.equal(hold.body.active, true);
    assert.ok(hold.body.pendingDues > 0);

    const blockedResults = await request(app)
      .get("/api/students/me/results")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(blockedResults.status, 403);
    assert.equal(blockedResults.body.code, "FINANCIAL_HOLD");

    const blockedGpa = await request(app)
      .get("/api/students/me/gpa")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(blockedGpa.status, 403);
    assert.equal(blockedGpa.body.code, "FINANCIAL_HOLD");

    const feesOpen = await request(app)
      .get("/api/payments/me")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(feesOpen.status, 200, feesOpen.text);
    assert.equal(feesOpen.body.financialHold.active, true);

    const pay = await request(app)
      .post("/api/payments/pay")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ paymentId });
    assert.equal(pay.status, 200, pay.text);

    const holdAfter = await request(app)
      .get("/api/students/me/financial-hold")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(holdAfter.status, 200);
    // May still be active if other dues exist — only assert results unlock when inactive
    if (!holdAfter.body.active) {
      const openResults = await request(app)
        .get("/api/students/me/results")
        .set("Authorization", `Bearer ${studentToken}`);
      assert.equal(openResults.status, 200, openResults.text);
    } else {
      // Clear remaining dues for clean state
      await prisma.payment.updateMany({
        where: { studentId, status: { in: ["PENDING", "OVERDUE"] } },
        data: { status: "PAID", paidAt: new Date() },
      });
      const openResults = await request(app)
        .get("/api/students/me/results")
        .set("Authorization", `Bearer ${studentToken}`);
      assert.equal(openResults.status, 200, openResults.text);
    }
  });

  it("student can rate lecturer; teacher/admin can read performance report", async () => {
    const studentRow = await prisma.student.findUnique({
      where: { id: studentId },
      select: { semester: true },
    });
    const currentSemester = studentRow?.semester || "Semester 4";

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        status: { in: ["ACTIVE", "COMPLETED"] },
        classSection: { semester: currentSemester },
      },
      include: {
        classSection: {
          select: {
            teacherId: true,
            courseId: true,
            semester: true,
            academicYear: true,
          },
        },
      },
    });
    assert.ok(enrollment, "seeded student should have a current-semester enrollment");
    assert.ok(enrollment!.classSection.teacherId, "enrollment needs a teacher");
    teacherId = enrollment!.classSection.teacherId;
    courseId = enrollment!.classSection.courseId;
    semester = enrollment!.classSection.semester;
    academicYear = enrollment!.classSection.academicYear;

    // Remove prior rating for this unique key if any
    await prisma.teacherRating
      .deleteMany({
        where: {
          studentId,
          teacherId,
          courseId,
          semester,
          academicYear,
        },
      })
      .catch(() => {});

    const eligible = await request(app)
      .get("/api/ratings/eligible")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(eligible.status, 200, eligible.text);
    assert.ok(Array.isArray(eligible.body.data));

    const created = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        teacherId,
        courseId,
        semester,
        academicYear,
        overallRating: 5,
        teachingQuality: 5,
        punctuality: 4,
        engagement: 5,
        comments: `Excellent lecturer ${suffix}`,
      });
    assert.equal(created.status, 201, created.text);
    ratingId = created.body.id;
    assert.equal(created.body.overallRating, 5);

    const duplicate = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        teacherId,
        courseId,
        semester,
        academicYear,
        overallRating: 4,
        teachingQuality: 4,
        punctuality: 4,
        engagement: 4,
      });
    assert.equal(duplicate.status, 409);

    const performance = await request(app)
      .get("/api/teachers/me/performance")
      .set("Authorization", `Bearer ${teacherToken}`);
    // teacherToken is mohamed.ali — may not be the rated teacher; login as rated teacher if needed
    if (performance.status === 200 && performance.body.teacherId === teacherId) {
      assert.ok(performance.body.totalReviews >= 1);
      assert.ok(performance.body.averageOverall != null);
    } else {
      const ratedTeacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: { select: { email: true } } },
      });
      assert.ok(ratedTeacher);
      const ratedLogin = await request(app).post("/api/auth/login").send({
        email: ratedTeacher!.user.email,
        password: "DHAPTI@2026",
        expectedRole: "TEACHER",
      });
      if (ratedLogin.status === 200) {
        const own = await request(app)
          .get("/api/teachers/me/performance")
          .set("Authorization", `Bearer ${ratedLogin.body.token}`);
        assert.equal(own.status, 200, own.text);
        assert.ok(own.body.totalReviews >= 1);
        assert.ok(
          own.body.feedback.some((f: { comments: string }) =>
            String(f.comments || "").includes(suffix)
          )
        );
      }
    }

    const report = await request(app)
      .get("/api/admin/ratings/report")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(report.status, 200, report.text);
    assert.ok(Array.isArray(report.body.data));
    const row = report.body.data.find(
      (r: { teacherId: string }) => r.teacherId === teacherId
    );
    assert.ok(row);
    assert.ok(row.totalReviews >= 1);
    assert.equal(row.eligibleForRenewal, true);

    const csv = await request(app)
      .get("/api/admin/ratings/report?format=csv")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(csv.status, 200, csv.text);
    assert.ok(String(csv.headers["content-type"] || "").includes("csv"));
    assert.ok(csv.text.includes("Teacher Name"));
  });
});
