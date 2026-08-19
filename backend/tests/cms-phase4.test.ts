import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

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

describe("CMS Phase 4 — news, events & media", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let newsId = "";
  let eventId = "";
  let mediaId = "";
  let tmpFile = "";

  after(async () => {
    if (newsId) {
      await prisma.cmsNewsPost.deleteMany({ where: { id: newsId } }).catch(() => {});
    }
    if (eventId) {
      await prisma.cmsEvent.deleteMany({ where: { id: eventId } }).catch(() => {});
    }
    if (mediaId) {
      await prisma.cmsMediaAsset.deleteMany({ where: { id: mediaId } }).catch(() => {});
    }
    if (tmpFile) {
      await fs.promises.unlink(tmpFile).catch(() => {});
    }
  });

  it("supports news CRUD, category, and publish filtering", async () => {
    const token = await loginAdmin();
    const slug = `phase4-news-${suffix}`;

    const created = await request(app)
      .post("/api/admin/cms/news")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Phase 4 Campus Update",
        slug,
        category: "Campus News",
        excerpt: "A short excerpt",
        body: "Full article body for Phase 4.",
      });
    assert.equal(created.status, 201, created.text);
    newsId = created.body.id;
    assert.equal(created.body.category, "Campus News");
    assert.equal(created.body.status, "DRAFT");

    const draftPublic = await request(app).get(`/api/public/cms/news/${slug}`);
    assert.equal(draftPublic.status, 404);

    const patched = await request(app)
      .patch(`/api/admin/cms/news/${newsId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Research", title: "Phase 4 Research Update" });
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.body.category, "Research");

    const published = await request(app)
      .post(`/api/admin/cms/news/${newsId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.status, "PUBLISHED");

    const list = await request(app).get("/api/public/cms/news");
    assert.equal(list.status, 200);
    assert.ok(
      (list.body.data as Array<{ slug: string }>).some((r) => r.slug === slug)
    );

    const one = await request(app).get(`/api/public/cms/news/${slug}`);
    assert.equal(one.status, 200);
    assert.equal(one.body.category, "Research");
  });

  it("supports event create/publish and hides drafts from public", async () => {
    const token = await loginAdmin();
    const startsAt = new Date(Date.now() + 86400000).toISOString();

    const created = await request(app)
      .post("/api/admin/cms/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Phase4 Event ${suffix}`,
        description: "Open day details",
        location: "Main Campus Auditorium",
        startsAt,
        registrationUrl: "/admissions",
      });
    assert.equal(created.status, 201, created.text);
    eventId = created.body.id;
    assert.equal(created.body.registrationUrl, "/admissions");
    assert.equal(created.body.status, "DRAFT");

    const before = await request(app).get("/api/public/cms/events");
    assert.equal(before.status, 200);
    assert.ok(
      !(before.body.data as Array<{ id: string }>).some((r) => r.id === eventId)
    );

    const published = await request(app)
      .post(`/api/admin/cms/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.status, "PUBLISHED");

    const after = await request(app).get("/api/public/cms/events");
    assert.equal(after.status, 200);
    assert.ok(
      (after.body.data as Array<{ id: string }>).some((r) => r.id === eventId)
    );
  });

  it("uploads and deletes media assets", async () => {
    const token = await loginAdmin();
    tmpFile = path.join(os.tmpdir(), `cms-phase4-${suffix}.png`);
    // Minimal valid 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    await fs.promises.writeFile(tmpFile, png);

    const uploaded = await request(app)
      .post("/api/admin/cms/media")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", tmpFile);
    assert.equal(uploaded.status, 201, uploaded.text);
    mediaId = uploaded.body.id;
    assert.ok(uploaded.body.url);

    const list = await request(app)
      .get("/api/admin/cms/media")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.ok(
      (list.body.data as Array<{ id: string }>).some((r) => r.id === mediaId)
    );

    const fileRes = await request(app).get(
      `/api/public/cms/media/${mediaId}/file`
    );
    assert.equal(fileRes.status, 200);

    const del = await request(app)
      .delete(`/api/admin/cms/media/${mediaId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(del.status, 200);
    mediaId = "";
  });
});
