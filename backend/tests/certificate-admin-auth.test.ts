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
  return res.body as { token: string; user: { role: string } };
}

describe("CERTIFICATE_ADMIN auth & scope", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const certAdminEmail = `cert.step.${suffix}@dhapti.edu.so`;
  let certAdminUserId = "";

  before(async () => {
    const passwordHash = await hashPassword("DHAPTI@2026");
    const user = await prisma.user.create({
      data: {
        email: certAdminEmail,
        passwordHash,
        role: "CERTIFICATE_ADMIN",
        admin: {
          create: {
            fullName: "Cert Admin Fixture",
            email: certAdminEmail,
          },
        },
      },
    });
    certAdminUserId = user.id;
  });

  after(async () => {
    await prisma.admin.deleteMany({ where: { userId: certAdminUserId } });
    await prisma.user.deleteMany({ where: { id: certAdminUserId } });
  });

  it("CERTIFICATE_ADMIN permissions include certificates, exclude finance/CMS/settings", () => {
    assert.equal(
      hasPermission("CERTIFICATE_ADMIN", Permission.CERTIFICATES_READ),
      true
    );
    assert.equal(
      hasPermission("CERTIFICATE_ADMIN", Permission.CERTIFICATES_MANAGE),
      true
    );
    assert.equal(
      hasPermission("CERTIFICATE_ADMIN", Permission.FINANCE_READ),
      false
    );
    assert.equal(
      hasPermission("CERTIFICATE_ADMIN", Permission.SETTINGS_MANAGE),
      false
    );
    assert.equal(
      hasPermission("CERTIFICATE_ADMIN", Permission.CMS_PAGES_MANAGE),
      false
    );
  });

  it("CERTIFICATE_ADMIN logs in via admin portal; finance and settings return 403", async () => {
    const { token, user } = await login(certAdminEmail, "ADMIN");
    assert.equal(user.role, "CERTIFICATE_ADMIN");

    const finance = await request(app)
      .get("/api/admin/finance/summary")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(finance.status, 403);

    const settings = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(settings.status, 403);

    const certs = await request(app)
      .get("/api/admin/certificates")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(certs.status, 200, certs.text);
  });

  it("ensureDemoAccounts repairs cert.admin@dhapti.edu.so for DHAPTI@2026", async () => {
    const { ensureDemoAccounts } = await import(
      "../src/lib/ensureDemoAccounts.js"
    );
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      await ensureDemoAccounts();
      const res = await request(app).post("/api/auth/login").send({
        email: "cert.admin@dhapti.edu.so",
        password: "DHAPTI@2026",
        expectedRole: "ADMIN",
      });
      assert.equal(res.status, 200, res.text);
      assert.equal(res.body.user.role, "CERTIFICATE_ADMIN");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
