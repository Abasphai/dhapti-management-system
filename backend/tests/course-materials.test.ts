import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

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

async function ensureFixture() {
  await fs.mkdir(fixturesDir, { recursive: true });
  const file = path.join(fixturesDir, "lecture.pdf");
  await fs.writeFile(file, "%PDF-1.4 course material content");
  return file;
}

describe("Course Materials & Multi-Media Learning Hub", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let facultyId = "";
  let departmentId = "";
  let courseId = "";
  let teacherId = "";
  let classId = "";
  let studentUserId = "";
  let materialId = "";
  let linkMaterialId = "";
  let fixturePath = "";

  after(async () => {
    if (materialId || linkMaterialId) {
      await prisma.courseMaterial
        .deleteMany({
          where: { id: { in: [materialId, linkMaterialId].filter(Boolean) } },
        })
        .catch(() => {});
    }
    if (classId) {
      await prisma.enrollment.deleteMany({ where: { classSectionId: classId } }).catch(() => {});
      await prisma.classSection.deleteMany({ where: { id: classId } }).catch(() => {});
    }
    if (courseId) {
      await prisma.courseMaterial.deleteMany({ where: { courseId } }).catch(() => {});
      await prisma.courseTeacher.deleteMany({ where: { courseId } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => {});
    }
    if (teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (t) await prisma.user.delete({ where: { id: t.userId } }).catch(() => {});
    }
    if (studentUserId) {
      await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
    }
    if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    if (facultyId) await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("rejects unauthenticated materials access", async () => {
    const res = await request(app).get("/api/student/materials");
    assert.equal(res.status, 401);
  });

  it("teacher uploads file/link; student lists/downloads; delete works", async () => {
    fixturePath = await ensureFixture();
    adminToken = await login("admin@dhapti.edu.so");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Mat Fac ${suffix}`,
        code: `MF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Mat Dept ${suffix}`,
        code: `MD${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const course = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `MC${suffix}`.slice(0, 12).toUpperCase(),
        title: `Materials Course ${suffix}`,
        credits: 3,
        departmentId,
      });
    assert.equal(course.status, 201, course.text);
    courseId = course.body.id;

    const teacher = await request(app)
      .post("/api/teachers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Mat Teacher ${suffix}`,
        email: `mat.t.${suffix}@dhapti.edu.so`,
        facultyCode: `FAC-M-${suffix}`.slice(0, 20).toUpperCase(),
        departmentId,
      });
    assert.equal(teacher.status, 201, teacher.text);
    teacherId = teacher.body.id;

    const assign = await request(app)
      .post(`/api/teachers/${teacherId}/courses`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ courseId });
    assert.ok([200, 201].includes(assign.status), assign.text);

    const klass = await request(app)
      .post("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        courseId,
        teacherId,
        section: "A",
        academicYear: "2026/2027",
        semester: "Semester 1",
      });
    assert.equal(klass.status, 201, klass.text);
    classId = klass.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Mat Student ${suffix}`,
        email: `mat.s.${suffix}@dhapti.edu.so`,
        studentCode: `DHAPTI-M-${suffix}`.slice(0, 20).toUpperCase(),
        facultyId,
        departmentId,
      });
    assert.equal(student.status, 201, student.text);
    const studentId = student.body.id as string;
    studentUserId = (await prisma.student.findUnique({ where: { id: studentId } }))!
      .userId;

    const enroll = await request(app)
      .post("/api/enrollments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, classSectionId: classId });
    assert.ok([200, 201].includes(enroll.status), enroll.text);

    teacherToken = await login(`mat.t.${suffix}@dhapti.edu.so`, "TEACHER");
    studentToken = await login(`mat.s.${suffix}@dhapti.edu.so`, "STUDENT");

    const upload = await request(app)
      .post("/api/materials/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("title", "Week 1 PDF Notes")
      .field("description", "Intro lecture")
      .field("courseId", courseId)
      .field("classSectionId", classId)
      .field("materialType", "PDF")
      .attach("file", fixturePath);
    assert.equal(upload.status, 201, upload.text);
    assert.equal(upload.body.materialType, "PDF");
    assert.ok(upload.body.fileUrl);
    materialId = upload.body.id;

    const linkUpload = await request(app)
      .post("/api/materials/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("title", "External Resource")
      .field("courseId", courseId)
      .field("materialType", "LINK")
      .field("linkUrl", "https://example.com/lecture");
    assert.equal(linkUpload.status, 201, linkUpload.text);
    assert.equal(linkUpload.body.materialType, "LINK");
    assert.equal(linkUpload.body.linkUrl, "https://example.com/lecture");
    linkMaterialId = linkUpload.body.id;

    const teacherList = await request(app)
      .get("/api/materials/me")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherList.status, 200, teacherList.text);
    assert.ok(teacherList.body.data.length >= 2);

    const courseList = await request(app)
      .get(`/api/materials/course/${courseId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(courseList.status, 200, courseList.text);
    assert.ok(courseList.body.data.some((m: { id: string }) => m.id === materialId));

    const studentList = await request(app)
      .get("/api/student/materials")
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentList.status, 200, studentList.text);
    assert.ok(studentList.body.data.some((m: { id: string }) => m.id === materialId));

    const download = await request(app)
      .get(`/api/materials/${materialId}/file`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(download.status, 200, download.text);
    assert.ok(download.headers["content-disposition"]?.includes("attachment"));

    const del = await request(app)
      .delete(`/api/materials/${linkMaterialId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(del.status, 200, del.text);
    linkMaterialId = "";
  });
});
