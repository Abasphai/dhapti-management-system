import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { validateBlockPayload } from "../src/lib/cms/blockSchemas.js";
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

describe("CMS Phase 3 — homepage & about block editors", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const homeSlug = `home-p3-${suffix}`;
  const aboutSlug = `about-p3-${suffix}`;
  let homeId = "";
  let aboutId = "";

  after(async () => {
    for (const id of [homeId, aboutId]) {
      if (!id) continue;
      await prisma.cmsPageBlock.deleteMany({ where: { pageId: id } }).catch(() => {});
      await prisma.cmsPage.deleteMany({ where: { id } }).catch(() => {});
    }
  });

  it("validates Phase 3 block types", () => {
    const hero = validateBlockPayload("HERO_SLIDER", 1, {
      slides: [
        {
          title: "Welcome",
          description: "DHAPTI",
          imageUrl: "/images/slide1.jpg",
          buttonText: "Apply",
          buttonLink: "/admissions",
        },
      ],
    });
    assert.equal(hero.ok, true);

    const why = validateBlockPayload("WHY_CHOOSE", 1, {
      stats: [{ value: 15, suffix: "+", label: "Faculties" }],
      features: [
        {
          title: "Accredited Programs",
          description: "Quality degrees",
          icon: "GraduationCap",
        },
      ],
    });
    assert.equal(why.ok, true);

    const bad = validateBlockPayload("HERO_SLIDER", 1, { slides: [] });
    assert.equal(bad.ok, false);
  });

  it("saves homepage blocks as draft and publishes for public read", async () => {
    const token = await loginAdmin();

    const created = await request(app)
      .post("/api/admin/cms/pages")
      .set("Authorization", `Bearer ${token}`)
      .send({ slug: homeSlug, title: "Homepage Phase3" });
    assert.equal(created.status, 201, created.text);
    homeId = created.body.id;

    const replace = await request(app)
      .put(`/api/admin/cms/pages/${homeId}/blocks`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        blocks: [
          {
            blockType: "HERO_SLIDER",
            schemaVersion: 1,
            sortOrder: 0,
            payload: {
              slides: [
                {
                  title: "Phase3 Hero",
                  subtitle: "",
                  description: "Published slide",
                  imageUrl: "/images/slide1.jpg",
                  buttonText: "Apply Now",
                  buttonLink: "/admissions",
                },
              ],
            },
          },
          {
            blockType: "WHY_CHOOSE",
            schemaVersion: 1,
            sortOrder: 1,
            payload: {
              sectionTitle: "Why Choose Dhapti?",
              sectionLabel: "Why Dhapti",
              sectionDescription: "Excellence",
              stats: [
                { value: 2500, suffix: "+", label: "Enrolled Students" },
                { value: 95, suffix: "%", label: "Graduate Employment" },
              ],
              features: [
                {
                  title: "Accredited Programs",
                  description: "Quality",
                  icon: "GraduationCap",
                },
                {
                  title: "Expert Faculty",
                  description: "Experts",
                  icon: "Users",
                },
              ],
            },
          },
          {
            blockType: "RECTOR_MESSAGE",
            schemaVersion: 1,
            sortOrder: 2,
            payload: {
              name: "Prof. Test Rector",
              title: "University Rector",
              photoUrl: "/dhapti-logo.png",
              message: "Education transforms communities.",
            },
          },
        ],
      });
    assert.equal(replace.status, 200, replace.text);
    assert.equal(replace.body.blocks.length, 3);
    assert.equal(replace.body.status, "DRAFT");

    const draftPublic = await request(app).get(
      `/api/public/cms/pages/${homeSlug}`
    );
    assert.equal(draftPublic.status, 404);

    const publish = await request(app)
      .post(`/api/admin/cms/pages/${homeId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(publish.status, 200, publish.text);
    assert.equal(publish.body.status, "PUBLISHED");

    const pub = await request(app).get(`/api/public/cms/pages/${homeSlug}`);
    assert.equal(pub.status, 200, pub.text);
    const hero = pub.body.blocks.find(
      (b: { blockType: string }) => b.blockType === "HERO_SLIDER"
    );
    assert.ok(hero);
    assert.equal(hero.payload.slides[0].title, "Phase3 Hero");
  });

  it("rejects invalid block replace payloads", async () => {
    const token = await loginAdmin();
    const created = await request(app)
      .post("/api/admin/cms/pages")
      .set("Authorization", `Bearer ${token}`)
      .send({ slug: aboutSlug, title: "About Phase3" });
    assert.equal(created.status, 201, created.text);
    aboutId = created.body.id;

    const bad = await request(app)
      .put(`/api/admin/cms/pages/${aboutId}/blocks`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        blocks: [
          {
            blockType: "ABOUT_MISSION_VISION",
            schemaVersion: 1,
            sortOrder: 0,
            payload: { missionHeading: "", visionHeading: "x", missionBody: "a", visionBody: "b" },
          },
        ],
      });
    assert.equal(bad.status, 400);

    const ok = await request(app)
      .put(`/api/admin/cms/pages/${aboutId}/blocks`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        blocks: [
          {
            blockType: "ABOUT_MISSION_VISION",
            schemaVersion: 1,
            sortOrder: 0,
            payload: {
              missionHeading: "Educate",
              missionBody: "Mission body",
              visionHeading: "Vision",
              visionBody: "Vision body",
            },
          },
          {
            blockType: "ABOUT_HISTORY",
            schemaVersion: 1,
            sortOrder: 1,
            payload: {
              items: [{ year: "2016", title: "Foundation", text: "Started" }],
            },
          },
          {
            blockType: "ABOUT_LEADERSHIP",
            schemaVersion: 1,
            sortOrder: 2,
            payload: {
              people: [
                {
                  name: "Leader",
                  role: "Rector",
                  bio: "Bio",
                  imageUrl: "/dhapti-logo.png",
                },
              ],
            },
          },
        ],
      });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.blocks.length, 3);

    const bySlug = await request(app)
      .get(`/api/admin/cms/pages/slug/${aboutSlug}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(bySlug.status, 200);
    assert.equal(bySlug.body.id, aboutId);
  });
});
