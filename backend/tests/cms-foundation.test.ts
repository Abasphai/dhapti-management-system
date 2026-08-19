import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { validateBlockPayload } from "../src/lib/cms/blockSchemas.js";
import {
  hasPermission,
  Permission,
} from "../src/lib/permissions.js";
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

describe("CMS permissions catalog", () => {
  it("grants CMS permissions to ADMIN only", () => {
    assert.equal(hasPermission("ADMIN", Permission.CMS_PAGES_MANAGE), true);
    assert.equal(hasPermission("ADMIN", Permission.CMS_PUBLISH), true);
    assert.equal(hasPermission("ADMIN", Permission.CMS_SETTINGS_MANAGE), true);
    assert.equal(hasPermission("TEACHER", Permission.CMS_PAGES_READ), false);
    assert.equal(hasPermission("STUDENT", Permission.CMS_PUBLISH), false);
    assert.equal(hasPermission("TEACHER", Permission.SETTINGS_MANAGE), false);
  });

  it("rejects invalid block payloads", () => {
    const bad = validateBlockPayload("HERO", 1, { title: "" });
    assert.equal(bad.ok, false);
    const unknown = validateBlockPayload("NOT_A_BLOCK", 1, {});
    assert.equal(unknown.ok, false);
    const good = validateBlockPayload("HERO", 1, {
      title: "Welcome",
      subtitle: "DHAPTI",
    });
    assert.equal(good.ok, true);
  });
});

describe("CMS foundation APIs", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let pageId = "";
  let newsId = "";

  after(async () => {
    if (pageId) {
      await prisma.cmsPageBlock.deleteMany({ where: { pageId } }).catch(() => {});
      await prisma.cmsPage.deleteMany({ where: { id: pageId } }).catch(() => {});
    }
    if (newsId) {
      await prisma.cmsNewsPost.deleteMany({ where: { id: newsId } }).catch(() => {});
    }
    await prisma.cmsPage
      .deleteMany({ where: { slug: { startsWith: `cms-phase1-${suffix}` } } })
      .catch(() => {});
    await prisma.cmsNewsPost
      .deleteMany({ where: { slug: { startsWith: `cms-news-${suffix}` } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  it("enforces auth, permissions, publish gate, settings isolation, audit", async () => {
    adminToken = await login("admin@dhapti.edu.so");
    teacherToken = await login("mohamed.ali@dhapti.edu.so", "TEACHER");
    studentToken = await login("mohamudcade143@gmail.com", "STUDENT");

    // Unauthorized
    assert.equal((await request(app).get("/api/admin/cms/pages")).status, 401);

    // Teacher / student denied
    assert.equal(
      (
        await request(app)
          .get("/api/admin/cms/pages")
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status,
      403
    );
    assert.equal(
      (
        await request(app)
          .get("/api/admin/cms/settings")
          .set("Authorization", `Bearer ${studentToken}`)
      ).status,
      403
    );

    // Admin can access
    const list = await request(app)
      .get("/api/admin/cms/pages")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(list.status, 200, list.text);
    assert.ok(Array.isArray(list.body.data));

    // Settings isolation: operational key rejected by CMS settings schema
    const opsLeak = await request(app)
      .patch("/api/admin/cms/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isAdmissionsOpen: false });
    assert.equal(opsLeak.status, 400);

    const cmsSettings = await request(app)
      .patch("/api/admin/cms/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ universityShortName: "DHAPTI", themePrimary: "#002147" });
    assert.equal(cmsSettings.status, 200, cmsSettings.text);
    assert.equal(cmsSettings.body.universityShortName, "DHAPTI");

    const settingsAudit = await prisma.auditLog.findFirst({
      where: { action: "CMS_SETTINGS_UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(settingsAudit);

    // Create draft page
    const created = await request(app)
      .post("/api/admin/cms/pages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `cms-phase1-${suffix}`,
        title: `CMS Phase1 ${suffix}`,
      });
    assert.equal(created.status, 201, created.text);
    pageId = created.body.id;
    assert.equal(created.body.status, "DRAFT");

    // Invalid block rejected
    const badBlock = await request(app)
      .post(`/api/admin/cms/pages/${pageId}/blocks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        blockType: "HERO",
        schemaVersion: 1,
        payload: { title: "" },
      });
    assert.equal(badBlock.status, 400);

    const block = await request(app)
      .post(`/api/admin/cms/pages/${pageId}/blocks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        blockType: "HERO",
        schemaVersion: 1,
        sortOrder: 0,
        payload: { title: "Hello Dhapti", subtitle: "Phase 1" },
      });
    assert.equal(block.status, 201, block.text);

    // Public must not see draft (including fake preview query)
    const publicDraft = await request(app).get(
      `/api/public/cms/pages/cms-phase1-${suffix}?preview=1`
    );
    assert.equal(publicDraft.status, 404);

    // Auth preview works for admin
    const preview = await request(app)
      .get(`/api/admin/cms/pages/${pageId}/preview`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.body.status, "DRAFT");
    assert.equal(preview.body.preview, true);

    // Publish requires cms.publish (admin has it)
    const published = await request(app)
      .post(`/api/admin/cms/pages/${pageId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.status, "PUBLISHED");

    const publishAudit = await prisma.auditLog.findFirst({
      where: { action: "CMS_PAGE_PUBLISH", entityId: pageId },
    });
    assert.ok(publishAudit);

    // Public can read published
    const publicOk = await request(app).get(
      `/api/public/cms/pages/cms-phase1-${suffix}`
    );
    assert.equal(publicOk.status, 200, publicOk.text);
    assert.equal(publicOk.body.status, "PUBLISHED");
    assert.ok(publicOk.body.blocks?.length >= 1);

    // Public settings available
    const pubSettings = await request(app).get("/api/public/cms/settings");
    assert.equal(pubSettings.status, 200);
    assert.ok(pubSettings.body.universityName);

    // News draft not public; publish works
    const news = await request(app)
      .post("/api/admin/cms/news")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        slug: `cms-news-${suffix}`,
        title: `News ${suffix}`,
        body: "Body",
      });
    assert.equal(news.status, 201, news.text);
    newsId = news.body.id;
    assert.equal(
      (await request(app).get(`/api/public/cms/news/cms-news-${suffix}`)).status,
      404
    );
    assert.equal(
      (
        await request(app)
          .post(`/api/admin/cms/news/${newsId}/publish`)
          .set("Authorization", `Bearer ${adminToken}`)
      ).status,
      200
    );
    assert.equal(
      (await request(app).get(`/api/public/cms/news/cms-news-${suffix}`)).status,
      200
    );

    // Unpublish hides from public again
    assert.equal(
      (
        await request(app)
          .post(`/api/admin/cms/pages/${pageId}/unpublish`)
          .set("Authorization", `Bearer ${adminToken}`)
      ).status,
      200
    );
    assert.equal(
      (await request(app).get(`/api/public/cms/pages/cms-phase1-${suffix}`))
        .status,
      404
    );
  });
});
