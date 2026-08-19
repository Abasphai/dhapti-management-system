import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
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

describe("CMS Phase 2 — settings & public nav", () => {
  const createdNavIds: string[] = [];
  const settingKeys = [
    "universityName",
    "contactPhone",
    "officeHours",
    "socialInstagram",
    "privacyPolicyUrl",
    "admissionsEmail",
  ];

  after(async () => {
    if (createdNavIds.length) {
      await prisma.cmsNavItem.deleteMany({
        where: { id: { in: createdNavIds } },
      });
    }
    await prisma.systemSetting.deleteMany({
      where: { key: { in: settingKeys } },
    });
  });

  it("admin can patch website settings including Phase 2 fields", async () => {
    const token = await loginAdmin();
    const patch = await request(app)
      .patch("/api/admin/cms/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        universityName: "Dhapti University",
        contactPhone: "+252 61 700 1000",
        officeHours: "Sun – Thu: 8:00 AM – 4:00 PM",
        socialInstagram: "https://instagram.com/biu",
        privacyPolicyUrl: "/contact",
        admissionsEmail: "admissions@dhapti.edu.so",
      });
    assert.equal(patch.status, 200, patch.text);
    assert.equal(patch.body.officeHours, "Sun – Thu: 8:00 AM – 4:00 PM");
    assert.equal(patch.body.socialInstagram, "https://instagram.com/biu");
    assert.equal(patch.body.admissionsEmail, "admissions@dhapti.edu.so");

    const pub = await request(app).get("/api/public/cms/settings");
    assert.equal(pub.status, 200);
    assert.equal(pub.body.contactPhone, "+252 61 700 1000");
    assert.equal(pub.body.socialInstagram, "https://instagram.com/biu");
  });

  it("rejects invalid email on website settings patch", async () => {
    const token = await loginAdmin();
    const bad = await request(app)
      .patch("/api/admin/cms/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ admissionsEmail: "not-an-email" });
    assert.equal(bad.status, 400);
  });

  it("public nav returns only visible items; empty CMS nav is empty array", async () => {
    const empty = await request(app).get("/api/public/cms/nav?location=HEADER");
    assert.equal(empty.status, 200);
    assert.ok(Array.isArray(empty.body.data));

    const token = await loginAdmin();
    const parent = await request(app)
      .post("/api/admin/cms/nav")
      .set("Authorization", `Bearer ${token}`)
      .send({
        label: "Phase2 About",
        href: "/about",
        location: "HEADER",
        sortOrder: 1,
        visible: true,
      });
    assert.equal(parent.status, 201, parent.text);
    createdNavIds.push(parent.body.id);

    const child = await request(app)
      .post("/api/admin/cms/nav")
      .set("Authorization", `Bearer ${token}`)
      .send({
        label: "Mission",
        href: "/about#mission",
        location: "HEADER",
        sortOrder: 2,
        visible: true,
        parentId: parent.body.id,
      });
    assert.equal(child.status, 201, child.text);
    createdNavIds.push(child.body.id);

    const hidden = await request(app)
      .post("/api/admin/cms/nav")
      .set("Authorization", `Bearer ${token}`)
      .send({
        label: "Hidden Link",
        href: "/secret",
        location: "HEADER",
        sortOrder: 99,
        visible: false,
      });
    assert.equal(hidden.status, 201, hidden.text);
    createdNavIds.push(hidden.body.id);

    const pub = await request(app).get("/api/public/cms/nav?location=HEADER");
    assert.equal(pub.status, 200);
    const labels = (pub.body.data as Array<{ label: string }>).map(
      (r) => r.label
    );
    assert.ok(labels.includes("Phase2 About"));
    assert.ok(labels.includes("Mission"));
    assert.ok(!labels.includes("Hidden Link"));
  });

  it("admin can update and delete nav items", async () => {
    const token = await loginAdmin();
    const created = await request(app)
      .post("/api/admin/cms/nav")
      .set("Authorization", `Bearer ${token}`)
      .send({
        label: "Phase2 Footer",
        href: "/news",
        location: "FOOTER",
        sortOrder: 5,
        visible: true,
      });
    assert.equal(created.status, 201, created.text);
    const id = created.body.id as string;
    createdNavIds.push(id);

    const patched = await request(app)
      .patch(`/api/admin/cms/nav/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Phase2 News", sortOrder: 3 });
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.body.label, "Phase2 News");

    const footer = await request(app).get(
      "/api/public/cms/nav?location=FOOTER"
    );
    assert.equal(footer.status, 200);
    assert.ok(
      (footer.body.data as Array<{ label: string }>).some(
        (r) => r.label === "Phase2 News"
      )
    );

    const del = await request(app)
      .delete(`/api/admin/cms/nav/${id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(del.status, 200);
    // remove from cleanup list since already deleted
    const idx = createdNavIds.indexOf(id);
    if (idx >= 0) createdNavIds.splice(idx, 1);
  });
});
