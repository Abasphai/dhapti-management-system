/**
 * Production-clean database reset:
 * - Wipes mock academic/user data
 * - Seeds 6 official faculties + departments
 * - Seeds ONE master ADMIN (admin@dhapti.edu.so / DHAPTI@2026)
 * - Seeds grade scale, CMS defaults, attendance locations, system settings
 *
 * No mock students, teachers, enrollments, attendance, or ratings.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { DHAPTI_FACULTY_DEPARTMENT_CATALOG } from "../src/lib/biuFacultyCatalog.js";
import { seedCmsContent } from "./seedCms.js";

const prisma = new PrismaClient();

const MASTER_ADMIN_EMAIL = "admin@dhapti.edu.so";
const MASTER_ADMIN_PASSWORD = "DHAPTI@2026";

/** Delete transactional / mock data in FK-safe order. */
export async function wipeTransactionalData(db: PrismaClient) {
  await db.electionVote.deleteMany();
  await db.electionAuditLog.deleteMany();
  await db.electionVoterEligibility.deleteMany();
  await db.electionCandidate.deleteMany();
  await db.electionPosition.deleteMany();
  await db.election.deleteMany();

  await db.examAdmitCard.deleteMany();
  await db.examSchedule.deleteMany();
  await db.examSession.deleteMany();
  await db.certificate.deleteMany();

  await db.userDepartmentScope.deleteMany();
  await db.notificationRecipient.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.payment.deleteMany();
  await db.admissionApplication.deleteMany();

  await db.courseQuestionReply.deleteMany();
  await db.courseQuestion.deleteMany();
  await db.teacherRating.deleteMany();
  await db.resultEntry.deleteMany();
  await db.assessmentWeight.deleteMany();
  await db.gradeScaleBand.deleteMany();
  await db.gradeScale.deleteMany();

  await db.studentAttendance.deleteMany();
  await db.teacherAttendance.deleteMany();
  await db.attendanceQRToken.deleteMany();
  await db.classSession.deleteMany();
  await db.attendanceLocation.deleteMany();

  await db.quizAnswer.deleteMany();
  await db.quizAttempt.deleteMany();
  await db.quizChoice.deleteMany();
  await db.quizQuestion.deleteMany();
  await db.quiz.deleteMany();

  await db.submission.deleteMany();
  await db.assignmentMaterial.deleteMany();
  await db.assignment.deleteMany();
  await db.courseMaterial.deleteMany();
  await db.enrollment.deleteMany();
  await db.courseTeacher.deleteMany();
  await db.classSection.deleteMany();
  await db.course.deleteMany();

  await db.student.deleteMany();
  await db.teacher.deleteMany();
  await db.admin.deleteMany();
  await db.department.deleteMany();
  await db.faculty.deleteMany();
  await db.user.deleteMany();

  await db.cmsNewsPost.deleteMany();
  await db.cmsEvent.deleteMany();
  await db.cmsNavItem.deleteMany();
  await db.cmsProgramMarketing.deleteMany();
  await db.cmsFacultyMarketing.deleteMany();
  await db.cmsPageBlock.deleteMany();
  await db.cmsPage.deleteMany();
  await db.cmsMediaAsset.deleteMany();
}

export async function runCleanProductionSeed(db: PrismaClient = prisma) {
  console.log("Running clean production seed...");

  await wipeTransactionalData(db);

  const passwordHash = await bcrypt.hash(MASTER_ADMIN_PASSWORD, 12);

  await db.gradeScale.create({
    data: {
      name: "Dhapti Official Scale",
      isActive: true,
      bands: {
        create: [
          { minScore: 90, maxScore: 100, letterGrade: "A+", gradePoint: 4.0, sortOrder: 0 },
          { minScore: 85, maxScore: 89, letterGrade: "A", gradePoint: 3.75, sortOrder: 1 },
          { minScore: 80, maxScore: 84, letterGrade: "A-", gradePoint: 3.5, sortOrder: 2 },
          { minScore: 75, maxScore: 79, letterGrade: "B+", gradePoint: 3.25, sortOrder: 3 },
          { minScore: 70, maxScore: 74, letterGrade: "B", gradePoint: 3.0, sortOrder: 4 },
          { minScore: 65, maxScore: 69, letterGrade: "B-", gradePoint: 2.75, sortOrder: 5 },
          { minScore: 60, maxScore: 64, letterGrade: "C+", gradePoint: 2.5, sortOrder: 6 },
          { minScore: 55, maxScore: 59, letterGrade: "C", gradePoint: 2.25, sortOrder: 7 },
          { minScore: 50, maxScore: 54, letterGrade: "C-", gradePoint: 2.0, sortOrder: 8 },
          { minScore: 0, maxScore: 49, letterGrade: "F", gradePoint: 0.0, sortOrder: 9 },
        ],
      },
    },
  });

  for (const faculty of DHAPTI_FACULTY_DEPARTMENT_CATALOG) {
    await db.faculty.create({
      data: {
        name: faculty.name,
        code: faculty.code,
        description: faculty.description,
        status: "ACTIVE",
        departments: {
          create: faculty.departments.map((d) => ({
            name: d.name,
            code: d.code,
            status: "ACTIVE",
          })),
        },
      },
    });
    console.log(
      `  ✓ ${faculty.name} (${faculty.code}) — ${faculty.departments.length} departments`
    );
  }
  console.log(
    `Seeded ${DHAPTI_FACULTY_DEPARTMENT_CATALOG.length} Dhapti faculties.`
  );

  await db.user.create({
    data: {
      email: MASTER_ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
      admin: {
        create: {
          fullName: "Master Administrator",
          email: MASTER_ADMIN_EMAIL,
        },
      },
    },
  });
  console.log(`  ✓ Master admin: ${MASTER_ADMIN_EMAIL}`);

  await seedCmsContent(db);

  const activeDepts = await db.department.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
  });
  for (const dept of activeDepts) {
    await db.attendanceLocation.upsert({
      where: {
        departmentId_code: { departmentId: dept.id, code: "MAIN" },
      },
      create: {
        departmentId: dept.id,
        name: `${dept.name} Faculty Attendance`,
        code: "MAIN",
        status: "ACTIVE",
      },
      update: {},
    });
  }
  console.log(
    `Seeded attendance locations (MAIN) for ${activeDepts.length} departments.`
  );

  const facultySettings: Array<[string, string]> = [
    ["facultyAttendanceGraceMinutes", "10"],
    ["facultyQrTokenTtlSeconds", "300"],
    ["facultyRequiredClassMinutesFallback", "120"],
    ["allowManualFacultyAttendance", "true"],
    ["institutionTimezone", "Africa/Mogadishu"],
    ["facultyQrEarlyStartMinutes", "30"],
    ["facultyQrLateEndMinutes", "60"],
  ];
  for (const [key, value] of facultySettings) {
    await db.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }

  console.log("Clean production seed complete.");
  console.log("Master login:");
  console.log(`  Email:    ${MASTER_ADMIN_EMAIL}`);
  console.log(`  Password: ${MASTER_ADMIN_PASSWORD}`);
  console.log("  Role:     ADMIN");
  console.log(
    "No mock students, teachers, enrollments, attendance, or ratings were created."
  );
}

async function main() {
  await runCleanProductionSeed(prisma);
}

const isDirectRun =
  process.argv[1]?.includes("cleanSeed") ||
  process.argv[1]?.endsWith("cleanSeed.ts") ||
  process.argv[1]?.endsWith("cleanSeed.js");

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
