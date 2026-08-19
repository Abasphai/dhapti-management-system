import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";

import { hashPassword } from "../src/lib/auth.js";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { hasPermission, Permission } from "../src/lib/permissions.js";

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

describe("Phase 6 — department admin scope & certificates", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const deptAdminEmail = `dept.phase6.${suffix}@dhapti.edu.so`;
  let certificateId = "";
  let deptAdminUserId = "";
  let scopeDepartmentId = "";
  let verifyCode = "";

  before(async () => {
    const csDept =
      (await prisma.department.findFirst({ where: { code: "CS" } })) ??
      (await prisma.department.findFirst());
    assert.ok(csDept, "At least one department required");
    scopeDepartmentId = csDept!.id;

    const passwordHash = await hashPassword("DHAPTI@2026");
    const user = await prisma.user.create({
      data: {
        email: deptAdminEmail,
        passwordHash,
        role: "DEPARTMENT_ADMIN",
        admin: {
          create: {
            fullName: "Phase 6 Dept Admin",
            email: deptAdminEmail,
          },
        },
        departmentScope: {
          create: { departmentId: scopeDepartmentId },
        },
      },
    });
    deptAdminUserId = user.id;

    const student = await prisma.student.findFirst({
      where: { departmentId: scopeDepartmentId },
      include: { faculty: true },
    });
    assert.ok(student, "Need a student in scoped department");

    verifyCode = `P6${suffix}XXXX`.slice(0, 12).toUpperCase();
    const cert = await prisma.certificate.create({
      data: {
        verificationCode: verifyCode,
        studentId: student!.id,
        studentName: student!.fullName,
        degreeTitle: "Phase 6 Seed Degree",
        facultyName: student!.faculty?.name ?? "Dhapti Faculty",
        programName: student!.program ?? "Program",
        graduationDate: new Date("2026-06-15T00:00:00.000Z"),
        status: "VALID",
        issuedById: user.id,
      },
    });
    certificateId = cert.id;
  });

  after(async () => {
    if (certificateId) {
      await prisma.certificate
        .deleteMany({ where: { id: certificateId } })
        .catch(() => {});
    }
    // clean extra certs created in issue test
    await prisma.certificate
      .deleteMany({ where: { degreeTitle: { contains: `Phase 6 Test Degree ${suffix}` } } })
      .catch(() => {});
    if (deptAdminUserId) {
      await prisma.userDepartmentScope
        .deleteMany({ where: { userId: deptAdminUserId } })
        .catch(() => {});
      await prisma.admin
        .deleteMany({ where: { userId: deptAdminUserId } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { id: deptAdminUserId } }).catch(() => {});
    }
  });

  it("admin portal login accepts DEPARTMENT_ADMIN with expectedRole ADMIN", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "dept.cs@dhapti.edu.so",
      password: "DHAPTI@2026",
      expectedRole: "ADMIN",
    });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.user.role, "DEPARTMENT_ADMIN");
    assert.equal(res.body.user.portal, "admin");
    assert.ok(res.body.token);
    assert.ok(res.body.user.departmentId);
  });

  it("DEPARTMENT_ADMIN lacks finance and settings permissions", () => {
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.FINANCE_READ), false);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.FINANCE_MANAGE), false);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.SETTINGS_READ), false);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.SETTINGS_MANAGE), false);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.USERS_MANAGE), false);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.STUDENTS_READ), true);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.CERTIFICATES_MANAGE), true);
  });

  it("DEPARTMENT_ADMIN cannot access finance endpoints", async () => {
    const token = await login(deptAdminEmail, "ADMIN");
    const finance = await request(app)
      .get("/api/admin/finance/summary")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(finance.status, 403);

    const settings = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(settings.status, 403);
  });

  it("DEPARTMENT_ADMIN students list is scoped to own department", async () => {
    const token = await login(deptAdminEmail, "ADMIN");

    const otherDept = await prisma.department.findFirst({
      where: { id: { not: scopeDepartmentId } },
    });
    assert.ok(otherDept);

    const blocked = await request(app)
      .get(`/api/students?departmentId=${otherDept!.id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(blocked.status, 403);

    const list = await request(app)
      .get("/api/students?pageSize=50")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200, list.text);
    for (const row of list.body.data as Array<{ departmentId: string | null }>) {
      assert.equal(row.departmentId, scopeDepartmentId);
    }
  });

  it("DEPARTMENT_ADMIN can load department dashboard stats", async () => {
    const token = await login(deptAdminEmail, "ADMIN");
    const res = await request(app)
      .get("/api/admin/department-dashboard/stats")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.department?.code);
    assert.equal(typeof res.body.totalStudents, "number");
    assert.equal(typeof res.body.totalCourses, "number");
  });

  it("public certificate verify returns safe payload for valid code", async () => {
    const ok = await request(app).get(
      `/api/public/certificates/verify/${verifyCode}`
    );
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.status, "VALID");
    assert.ok(ok.body.studentName);
    assert.ok(ok.body.degreeTitle);
    assert.ok(ok.body.facultyName);
    assert.ok(ok.body.graduationDate);
    assert.equal(ok.body.email, undefined);
    assert.equal(ok.body.phone, undefined);
    assert.equal(ok.body.grades, undefined);
  });

  it("public certificate verify returns 404 for invalid code", async () => {
    const res = await request(app).get(
      `/api/public/certificates/verify/NOTREAL${suffix}XX`
    );
    assert.equal(res.status, 404);
  });

  it("admin can issue a certificate with unique verification code", async () => {
    const token = await login("admin@dhapti.edu.so", "ADMIN");
    const student = await prisma.student.findFirst({
      where: { departmentId: scopeDepartmentId },
    });
    assert.ok(student);

    const created = await request(app)
      .post("/api/admin/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        studentId: student!.id,
        degreeTitle: `Phase 6 Test Degree ${suffix}`,
        facultyName: "Faculty of Computing & IT",
        programName: "BSc Computer Science",
        graduationDate: "2026-06-01",
      });
    assert.equal(created.status, 201, created.text);
    assert.equal(String(created.body.verificationCode).length, 12);
    assert.match(created.body.verifyUrl, /^\/verify\/certificate\//);

    const verify = await request(app).get(
      `/api/public/certificates/verify/${created.body.verificationCode}`
    );
    assert.equal(verify.status, 200);
    assert.equal(verify.body.degreeTitle, `Phase 6 Test Degree ${suffix}`);
  });
});
