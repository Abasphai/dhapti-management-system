import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  bucketLetterGrade,
  isPassingLetter,
} from "../src/lib/analyticsOverview.js";

const app = createApp();

async function loginAdmin() {
  const res = await request(app).post("/api/auth/login").send({
    email: "admin@dhapti.edu.so",
    password: "DHAPTI@2026",
    expectedRole: "ADMIN",
  });
  assert.equal(res.status, 200, res.text);
  return res.body.token as string;
}

describe("Enterprise analytics overview", () => {
  it("buckets letter grades and pass detection", () => {
    assert.equal(bucketLetterGrade("A+"), "A+");
    assert.equal(bucketLetterGrade("A"), "A");
    assert.equal(bucketLetterGrade("A-"), "A");
    assert.equal(bucketLetterGrade("B+"), "B");
    assert.equal(bucketLetterGrade("C"), "C");
    assert.equal(bucketLetterGrade("F"), "F");
    assert.equal(bucketLetterGrade("D"), "F");
    assert.equal(isPassingLetter("B"), true);
    assert.equal(isPassingLetter("F"), false);
  });

  it("returns analytics overview for admin with KPIs and chart series", async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.kpis);
    assert.equal(typeof res.body.kpis.totalEnrollment, "number");
    assert.equal(typeof res.body.kpis.netRevenue, "number");
    assert.equal(typeof res.body.kpis.collectionRate, "number");
    assert.ok(Array.isArray(res.body.revenueTrend));
    assert.ok(Array.isArray(res.body.departmentBreakdown));
    assert.ok(Array.isArray(res.body.gradeDistribution));
    assert.equal(res.body.gradeDistribution.length, 5);
    assert.ok(Array.isArray(res.body.atRiskStudents));
    assert.ok(res.body.filterOptions?.faculties);
    assert.ok(Array.isArray(res.body.filterOptions.academicYears));
  });

  it("accepts faculty/department/academicYear filters", async () => {
    const token = await loginAdmin();
    const base = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(base.status, 200, base.text);

    const year = base.body.filters?.academicYear || "2025/2026";
    const facultyId = base.body.filterOptions?.faculties?.[0]?.id;

    const filtered = await request(app)
      .get("/api/admin/analytics/overview")
      .query({
        academicYear: year,
        ...(facultyId ? { facultyId } : {}),
      })
      .set("Authorization", `Bearer ${token}`);
    assert.equal(filtered.status, 200, filtered.text);
    assert.equal(filtered.body.filters.academicYear, year);
    if (facultyId) {
      assert.equal(filtered.body.filters.facultyId, facultyId);
    }
  });

  it("rejects unauthenticated and non-admin access", async () => {
    const anon = await request(app).get("/api/admin/analytics/overview");
    assert.equal(anon.status, 401);

    const studentLogin = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    if (studentLogin.status === 200) {
      const denied = await request(app)
        .get("/api/admin/analytics/overview")
        .set("Authorization", `Bearer ${studentLogin.body.token}`);
      assert.ok([401, 403].includes(denied.status), denied.text);
    }
  });
});
