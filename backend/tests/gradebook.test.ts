import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

async function teacherToken() {
  const res = await request(app).post("/api/auth/login").send({
    email: "mohamed.ali@dhapti.edu.so",
    password: "DHAPTI@2026",
    expectedRole: "TEACHER",
  });
  assert.equal(res.status, 200);
  return res.body.token as string;
}

describe("Automated Teacher Gradebook", () => {
  it("saves Dhapti gradebook sheet and submits for admin approval", async () => {
    const token = await teacherToken();
    const teacher = await prisma.teacher.findFirst({
      where: { email: "mohamed.ali@dhapti.edu.so" },
      select: { id: true },
    });
    assert.ok(teacher);

    const section = await prisma.classSection.findFirst({
      where: { teacherId: teacher.id, status: "ACTIVE" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            resultEntry: { select: { id: true, status: true } },
          },
        },
      },
    });
    assert.ok(section, "seeded teacher should own an active class");
    assert.ok(section.enrollments[0], "class should have an active enrollment");

    // Prefer an enrollment the teacher can still edit (not APPROVED/immutable).
    const editable =
      section.enrollments.find(
        (e) =>
          !e.resultEntry ||
          ["DRAFT", "CALCULATED", "RETURNED", "REJECTED"].includes(
            e.resultEntry.status
          )
      ) ?? section.enrollments[0];
    const enrollmentId = editable.id;
    if (editable.resultEntry) {
      await prisma.resultEntry.update({
        where: { id: editable.resultEntry.id },
        data: { status: "CALCULATED" },
      });
    }

    const gradebook = await request(app)
      .post("/api/results/gradebook")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classSectionId: section.id,
        entries: [
          {
            enrollmentId,
            midterm: 28,
            finalExam: 36,
            quiz: 8,
            presentation: 4,
            assignment: 5,
            attendance: 9,
          },
        ],
      });
    assert.equal(gradebook.status, 200, gradebook.text);
    assert.equal(gradebook.body.saved, 1);
    assert.equal(gradebook.body.data[0].marks, 90);
    assert.equal(gradebook.body.data[0].letterGrade, "A+");
    assert.ok(!JSON.stringify(gradebook.body).includes("passwordHash"));

    const submit = await request(app)
      .post("/api/results/bulk-submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ classSectionId: section.id });
    assert.equal(submit.status, 200, submit.text);
    assert.ok(submit.body.submitted >= 1);
    assert.ok(
      submit.body.status === "PENDING_APPROVAL" ||
        submit.body.status === "APPROVED"
    );

    const row = await prisma.resultEntry.findUnique({
      where: { enrollmentId },
    });
    assert.ok(row);
    assert.ok(
      row.status === "PENDING_APPROVAL" || row.status === "APPROVED"
    );
  });
});
