import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { sanitizeCmsHtml } from "../src/lib/cms/sanitizeHtml.js";
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

describe("CMS Phase 5 — rich text & faculty/program marketing", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let facultyId = "";
  let programId = "";
  let newsId = "";

  after(async () => {
    if (facultyId) {
      await prisma.cmsFacultyMarketing
        .deleteMany({ where: { id: facultyId } })
        .catch(() => {});
    }
    if (programId) {
      await prisma.cmsProgramMarketing
        .deleteMany({ where: { id: programId } })
        .catch(() => {});
    }
    if (newsId) {
      await prisma.cmsNewsPost.deleteMany({ where: { id: newsId } }).catch(() => {});
    }
  });

  it("sanitizes XSS from rich text HTML payloads", () => {
    const dirty =
      '<p>Hello</p><script>alert(1)</script><img src=x onerror="alert(1)" /><a href="javascript:alert(1)">x</a>';
    const clean = sanitizeCmsHtml(dirty);
    assert.ok(clean.includes("<p>Hello</p>") || clean.includes("Hello"));
    assert.equal(clean.includes("<script"), false);
    assert.equal(clean.includes("onerror"), false);
    assert.equal(clean.includes("javascript:"), false);
  });

  it("sanitizes news body on create", async () => {
    const token = await loginAdmin();
    const slug = `phase5-news-${suffix}`;
    const created = await request(app)
      .post("/api/admin/cms/news")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Phase 5 Rich Text",
        slug,
        category: "Campus News",
        excerpt: "Excerpt",
        body: '<p>Safe</p><script>evil()</script>',
      });
    assert.equal(created.status, 201, created.text);
    newsId = created.body.id;
    assert.equal(String(created.body.body).includes("<script"), false);
    assert.ok(String(created.body.body).includes("Safe"));
  });

  it("supports faculty marketing CRUD + publish filter", async () => {
    const token = await loginAdmin();
    const facultyKey = `medicine-p5-${suffix}`.slice(0, 64);

    const created = await request(app)
      .post("/api/admin/cms/faculties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        facultyKey,
        name: "Faculty of Medicine (Phase 5 Test)",
        shortName: "Medicine-P5",
        heroImageUrl: "/images/medicine.jpg",
        overviewHtml: "<p>Overview <strong>safe</strong></p><script>x</script>",
        careerProspectsHtml: "<p>Careers</p>",
        admissionRequirementsHtml: "<ul><li>Science subjects</li></ul>",
        deanWelcomeHtml: "<p>Welcome from the Dean</p>",
        departments: ["General Medicine", "Nursing"],
        degrees: ["MBBS"],
        duration: "6 Years",
        credits: "180 Credit Hours",
      });
    assert.equal(created.status, 201, created.text);
    facultyId = created.body.id;
    assert.equal(created.body.status, "DRAFT");
    assert.equal(String(created.body.overviewHtml).includes("<script"), false);
    assert.deepEqual(created.body.departments, ["General Medicine", "Nursing"]);

    const draftPublic = await request(app).get(
      `/api/public/cms/faculties/${facultyKey}`
    );
    assert.equal(draftPublic.status, 404);

    const published = await request(app)
      .post(`/api/admin/cms/faculties/${facultyId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.status, "PUBLISHED");

    const list = await request(app).get("/api/public/cms/faculties");
    assert.equal(list.status, 200, list.text);
    assert.ok(
      (list.body.data as Array<{ facultyKey: string }>).some(
        (r) => r.facultyKey === facultyKey
      )
    );

    const one = await request(app).get(
      `/api/public/cms/faculties/${facultyKey}`
    );
    assert.equal(one.status, 200, one.text);
    assert.equal(one.body.shortName, "Medicine-P5");
  });

  it("supports program marketing CRUD + facultyKey filter", async () => {
    const token = await loginAdmin();
    const programKey = `civil-eng-p5-${suffix}`;
    const facultyKey = "engineering";

    const created = await request(app)
      .post("/api/admin/cms/programs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        programKey,
        facultyKey,
        title: "Civil Engineering",
        degreeTitle: "B.Sc. Civil Engineering",
        overviewHtml: "<p>Program overview</p><script>bad()</script>",
        duration: "4 Years",
        creditHours: "140",
        tuitionPerSemester: "$450",
        careerOpportunitiesHtml: "<p>Infrastructure roles</p>",
      });
    assert.equal(created.status, 201, created.text);
    programId = created.body.id;
    assert.equal(String(created.body.overviewHtml).includes("<script"), false);

    const draftPublic = await request(app).get("/api/public/cms/programs");
    assert.equal(draftPublic.status, 200);
    assert.equal(
      (draftPublic.body.data as Array<{ programKey: string }>).some(
        (r) => r.programKey === programKey
      ),
      false
    );

    const published = await request(app)
      .post(`/api/admin/cms/programs/${programId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(published.status, 200, published.text);

    const filtered = await request(app).get(
      `/api/public/cms/programs?facultyKey=${facultyKey}`
    );
    assert.equal(filtered.status, 200, filtered.text);
    assert.ok(
      (filtered.body.data as Array<{ programKey: string }>).some(
        (r) => r.programKey === programKey
      )
    );
  });
});
