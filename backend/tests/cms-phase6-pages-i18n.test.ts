import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { pickLocalized, resolveBlockPayloadForLocale } from "../src/lib/cms/i18n.js";
import { isReservedCmsSlug } from "../src/lib/cms/reservedSlugs.js";
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

describe("CMS Phase 6 — custom pages & i18n", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let pageId = "";
  let newsId = "";

  after(async () => {
    if (pageId) {
      await prisma.cmsPage.deleteMany({ where: { id: pageId } }).catch(() => {});
    }
    if (newsId) {
      await prisma.cmsNewsPost.deleteMany({ where: { id: newsId } }).catch(() => {});
    }
  });

  it("resolves language preference with English fallback", () => {
    assert.equal(pickLocalized("en", "Hello", "Salaan", "مرحبا"), "Hello");
    assert.equal(pickLocalized("so", "Hello", "Salaan", "مرحبا"), "Salaan");
    assert.equal(pickLocalized("ar", "Hello", "Salaan", "مرحبا"), "مرحبا");
    assert.equal(pickLocalized("so", "Hello", "", "مرحبا"), "Hello");
    assert.equal(pickLocalized("ar", "Hello", null, "  "), "Hello");

    const payload = {
      heading: "EN",
      body: "<p>English</p>",
      i18n: {
        so: { heading: "SO", body: "<p>Somali</p>" },
        ar: { heading: "AR" },
      },
    };
    const so = resolveBlockPayloadForLocale(payload, "so") as {
      heading: string;
      body: string;
    };
    assert.equal(so.heading, "SO");
    assert.equal(so.body, "<p>Somali</p>");
    const ar = resolveBlockPayloadForLocale(payload, "ar") as {
      heading: string;
      body: string;
    };
    assert.equal(ar.heading, "AR");
    assert.equal(ar.body, "<p>English</p>");
  });

  it("rejects reserved custom page slugs", async () => {
    assert.equal(isReservedCmsSlug("about"), true);
    assert.equal(isReservedCmsSlug("student-resources"), false);

    const token = await loginAdmin();
    const blocked = await request(app)
      .post("/api/admin/cms/pages")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Should Fail",
        slug: "about",
        customPage: true,
      });
    assert.equal(blocked.status, 400, blocked.text);
  });

  it("creates custom page, saves blocks, publishes, and serves by slug + lang", async () => {
    const token = await loginAdmin();
    const slug = `student-resources-${suffix}`;

    const created = await request(app)
      .post("/api/admin/cms/pages")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Student Resources",
        slug,
        metaDescription: "Helpful downloads and FAQs",
        titleSo: "Agabka Ardayda",
        titleAr: "موارد الطلاب",
        customPage: true,
      });
    assert.equal(created.status, 201, created.text);
    pageId = created.body.id;
    assert.equal(created.body.status, "DRAFT");
    assert.equal(created.body.titleSo, "Agabka Ardayda");

    const blocks = await request(app)
      .put(`/api/admin/cms/pages/${pageId}/blocks`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        blocks: [
          {
            blockType: "RICH_TEXT_BLOCK",
            schemaVersion: 1,
            sortOrder: 0,
            payload: {
              heading: "Welcome",
              body: "<p>English body</p>",
              i18n: {
                so: { heading: "Soo dhawoow", body: "<p>Qoraal Soomaali</p>" },
                ar: { heading: "مرحبا" },
              },
            },
          },
          {
            blockType: "FAQ_ACCORDION_BLOCK",
            schemaVersion: 1,
            sortOrder: 1,
            payload: {
              sectionTitle: "FAQ",
              items: [
                {
                  question: "How do I apply?",
                  answer: "<p>Use the admissions form.</p>",
                },
              ],
            },
          },
          {
            blockType: "CALLOUT_BANNER_BLOCK",
            schemaVersion: 1,
            sortOrder: 2,
            payload: {
              title: "Apply today",
              body: "Start your journey",
              ctaLabel: "Apply",
              ctaHref: "/admissions",
              backgroundImageUrl: "/images/slide1.jpg",
            },
          },
        ],
      });
    assert.equal(blocks.status, 200, blocks.text);
    assert.equal(blocks.body.blocks.length, 3);
    assert.ok(
      blocks.body.blocks[0].payload.i18n?.so?.heading === "Soo dhawoow"
    );

    const published = await request(app)
      .post(`/api/admin/cms/pages/${pageId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.status, "PUBLISHED");

    const publicEn = await request(app).get(
      `/api/public/cms/pages/${slug}?lang=en`
    );
    assert.equal(publicEn.status, 200, publicEn.text);
    assert.equal(publicEn.body.title, "Student Resources");
    assert.equal(publicEn.body.blocks[0].payload.heading, "Welcome");

    const publicSo = await request(app).get(
      `/api/public/cms/pages/${slug}?lang=so`
    );
    assert.equal(publicSo.status, 200, publicSo.text);
    assert.equal(publicSo.body.title, "Agabka Ardayda");
    assert.equal(publicSo.body.blocks[0].payload.heading, "Soo dhawoow");
    assert.equal(
      publicSo.body.blocks[0].payload.body,
      "<p>Qoraal Soomaali</p>"
    );

    const publicAr = await request(app).get(
      `/api/public/cms/pages/${slug}?lang=ar`
    );
    assert.equal(publicAr.status, 200, publicAr.text);
    assert.equal(publicAr.body.title, "موارد الطلاب");
    assert.equal(publicAr.body.blocks[0].payload.heading, "مرحبا");
    assert.equal(publicAr.body.blocks[0].payload.body, "<p>English body</p>");

    const draftHidden = await request(app)
      .post(`/api/admin/cms/pages/${pageId}/unpublish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(draftHidden.status, 200, draftHidden.text);

    const gone = await request(app).get(`/api/public/cms/pages/${slug}`);
    assert.equal(gone.status, 404);

    // re-publish for cleanup consistency
    await request(app)
      .post(`/api/admin/cms/pages/${pageId}/publish`)
      .set("Authorization", `Bearer ${token}`);
  });

  it("lists custom pages excluding home/about and supports news i18n resolution", async () => {
    const token = await loginAdmin();
    const list = await request(app)
      .get("/api/admin/cms/pages?scope=custom")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200, list.text);
    const slugs = (list.body.data as Array<{ slug: string }>).map((p) => p.slug);
    assert.equal(slugs.includes("home"), false);
    assert.equal(slugs.includes("about"), false);

    const newsSlug = `phase6-news-${suffix}`;
    const news = await request(app)
      .post("/api/admin/cms/news")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Campus Update",
        slug: newsSlug,
        excerpt: "English excerpt",
        body: "<p>EN</p>",
        titleSo: "Wararka Xaramka",
        excerptSo: "Qoraal Soomaali",
        bodySo: "<p>SO</p>",
      });
    assert.equal(news.status, 201, news.text);
    newsId = news.body.id;

    await request(app)
      .post(`/api/admin/cms/news/${newsId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    const soNews = await request(app).get(
      `/api/public/cms/news/${newsSlug}?lang=so`
    );
    assert.equal(soNews.status, 200, soNews.text);
    assert.equal(soNews.body.title, "Wararka Xaramka");
    assert.equal(soNews.body.excerpt, "Qoraal Soomaali");
    assert.ok(String(soNews.body.body).includes("SO"));

    const missingLangFallsBack = await request(app).get(
      `/api/public/cms/news/${newsSlug}?lang=ar`
    );
    assert.equal(missingLangFallsBack.status, 200);
    assert.equal(missingLangFallsBack.body.title, "Campus Update");
  });
});
