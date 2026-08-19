import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { normalizeSemesterLabel } from "../src/lib/semesters.js";

const app = createApp();

describe("Teacher evaluation current-semester policy", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let studentToken = "";
  let studentId = "";
  let currentSemester = "";
  let pastEnrollment: {
    teacherId: string;
    courseId: string;
    semester: string;
    academicYear: string;
  } | null = null;
  let currentEnrollment: {
    teacherId: string;
    courseId: string;
    semester: string;
    academicYear: string;
  } | null = null;
  let ratingId = "";

  after(async () => {
    if (ratingId) {
      await prisma.teacherRating.delete({ where: { id: ratingId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("rejects past/future semester evaluations with 403; allows current semester", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    assert.equal(login.status, 200, login.text);
    studentToken = login.body.token;

    const student = await prisma.student.findFirst({
      where: { user: { email: "mohamudcade143@gmail.com" } },
      select: { id: true, semester: true },
    });
    assert.ok(student);
    studentId = student!.id;
    currentSemester = normalizeSemesterLabel(student!.semester) || "Semester 4";

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: { in: ["ACTIVE", "COMPLETED"] } },
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
    assert.ok(enrollments.length > 0);

    for (const e of enrollments) {
      const row = {
        teacherId: e.classSection.teacherId,
        courseId: e.classSection.courseId,
        semester: e.classSection.semester,
        academicYear: e.classSection.academicYear,
      };
      if (normalizeSemesterLabel(row.semester) === currentSemester) {
        currentEnrollment = row;
      } else {
        pastEnrollment = row;
      }
    }

    assert.ok(currentEnrollment, "seed needs a current-semester enrollment");

    const eligible = await request(app)
      .get("/api/ratings/eligible")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(eligible.status, 200, eligible.text);
    assert.equal(eligible.body.currentSemester, currentSemester);
    for (const row of eligible.body.data as Array<{
      semester: string;
      canEvaluate: boolean;
      alreadyRated: boolean;
      isCurrentSemester: boolean;
    }>) {
      if (normalizeSemesterLabel(row.semester) !== currentSemester) {
        assert.equal(row.canEvaluate, false);
        assert.equal(row.isCurrentSemester, false);
      }
    }

    if (pastEnrollment) {
      const blockedPast = await request(app)
        .post("/api/ratings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          teacherId: pastEnrollment.teacherId,
          courseId: pastEnrollment.courseId,
          semester: pastEnrollment.semester,
          academicYear: pastEnrollment.academicYear,
          overallRating: 4,
          teachingQuality: 4,
          punctuality: 4,
          engagement: 4,
          comments: `past block ${suffix}`,
        });
      assert.equal(blockedPast.status, 403, blockedPast.text);
      assert.equal(blockedPast.body.code, "FORBIDDEN");
      assert.match(
        String(blockedPast.body.error),
        /current active semester/i
      );
    }

    const blockedFuture = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        teacherId: currentEnrollment!.teacherId,
        courseId: currentEnrollment!.courseId,
        semester: "Semester 8",
        academicYear: currentEnrollment!.academicYear,
        overallRating: 4,
        teachingQuality: 4,
        punctuality: 4,
        engagement: 4,
        comments: `future block ${suffix}`,
      });
    assert.equal(blockedFuture.status, 403, blockedFuture.text);
    assert.equal(blockedFuture.body.code, "FORBIDDEN");
    assert.match(String(blockedFuture.body.error), /current active semester/i);

    await prisma.teacherRating
      .deleteMany({
        where: {
          studentId,
          teacherId: currentEnrollment!.teacherId,
          courseId: currentEnrollment!.courseId,
          semester: currentEnrollment!.semester,
          academicYear: currentEnrollment!.academicYear,
        },
      })
      .catch(() => {});

    const allowed = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        teacherId: currentEnrollment!.teacherId,
        courseId: currentEnrollment!.courseId,
        semester: currentEnrollment!.semester,
        academicYear: currentEnrollment!.academicYear,
        overallRating: 5,
        teachingQuality: 5,
        punctuality: 5,
        engagement: 5,
        comments: `current ok ${suffix}`,
      });
    assert.equal(allowed.status, 201, allowed.text);
    ratingId = allowed.body.id;

    const duplicate = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        teacherId: currentEnrollment!.teacherId,
        courseId: currentEnrollment!.courseId,
        semester: currentEnrollment!.semester,
        academicYear: currentEnrollment!.academicYear,
        overallRating: 3,
        teachingQuality: 3,
        punctuality: 3,
        engagement: 3,
      });
    assert.equal(duplicate.status, 409);
  });
});
