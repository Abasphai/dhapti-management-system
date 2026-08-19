import "dotenv/config";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { getJwtSecret, signToken } from "../src/lib/auth.js";

const app = createApp();

describe("Auth API foundation (Phase 1A)", () => {
  before(() => {
    // Ensures JWT_SECRET is configured for the test process
    assert.ok(getJwtSecret().length > 0);
  });

  it("rejects login with missing credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "BAD_REQUEST");
    assert.ok(typeof res.body.error === "string");
  });

  it("rejects login with invalid password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@dhapti.edu.so",
      password: "wrong-password",
      expectedRole: "ADMIN",
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "UNAUTHORIZED");
  });

  it("logs in admin and returns safe user (no passwordHash)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, "ADMIN");
    assert.equal(res.body.user.status, "ACTIVE");
    assert.ok(Array.isArray(res.body.user.permissions));
    assert.equal(res.body.user.passwordHash, undefined);
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"));
  });

  it("returns 403 when student uses admin portal expectedRole", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FORBIDDEN");
  });

  it("GET /auth/me requires token", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "UNAUTHORIZED");
  });

  it("GET /auth/me rejects invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    assert.equal(res.status, 401);
  });

  it("GET /auth/me returns authenticated admin without passwordHash", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "admin@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.role, "ADMIN");
    assert.ok(!("passwordHash" in res.body));
  });

  it("blocks student from admin-only teachers list", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    const res = await request(app)
      .get("/api/teachers")
      .set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FORBIDDEN");
  });

  it("blocks teacher from global students list (Phase 1A)", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "mohamed.ali@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "TEACHER",
    });
    const res = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(res.status, 403);
  });

  it("allows admin students list", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "admin@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    const res = await request(app)
      .get("/api/students")
      .set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
    assert.ok(typeof res.body.pagination.total === "number");
  });

  it("rejects unauthenticated students list", async () => {
    const res = await request(app).get("/api/students");
    assert.equal(res.status, 401);
  });

  it("rejects forged admin role in JWT when DB role differs", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "mohamudcade143@gmail.com",
      password: "DHAPTI@2026",
      expectedRole: "STUDENT",
    });
    // Forge token with ADMIN role but student subject — middleware checks DB role
    const forged = signToken({
      sub: login.body.user.id,
      role: "ADMIN",
      email: login.body.user.email,
    });
    const res = await request(app)
      .get("/api/teachers")
      .set("Authorization", `Bearer ${forged}`);
    assert.equal(res.status, 401);
  });

  it("register-admin is disabled by default", async () => {
    const res = await request(app).post("/api/auth/register-admin").send({
      email: "hacker@dhapti.edu.so",
      password: "Password1!",
      fullName: "Hacker",
    });
    assert.equal(res.status, 404);
  });
});
