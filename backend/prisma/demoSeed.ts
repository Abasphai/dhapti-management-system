/**
 * Full demo seed for local development & automated tests.
 * Production / hosted: use `npm run db:seed` (cleanSeed) instead.
 *
 * Demo logins (password: DHAPTI@2026):
 *   admin@dhapti.edu.so, mohamed.ali@dhapti.edu.so, mohamudcade143@gmail.com
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { DHAPTI_COURSE_CATALOG } from "../src/lib/biuCourseCatalog.js";
import { DHAPTI_FACULTY_DEPARTMENT_CATALOG } from "../src/lib/biuFacultyCatalog.js";
import { seedCmsContent } from "./seedCms.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Dhapti database (DEMO / test data)...");

  await prisma.electionVote.deleteMany();
  await prisma.electionAuditLog.deleteMany();
  await prisma.electionVoterEligibility.deleteMany();
  await prisma.electionCandidate.deleteMany();
  await prisma.electionPosition.deleteMany();
  await prisma.election.deleteMany();
  await prisma.examAdmitCard.deleteMany();
  await prisma.examSchedule.deleteMany();
  await prisma.examSession.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.userDepartmentScope.deleteMany();
  await prisma.notificationRecipient.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.admissionApplication.deleteMany();
  await prisma.courseQuestionReply.deleteMany();
  await prisma.courseQuestion.deleteMany();
  await prisma.teacherRating.deleteMany();
  await prisma.resultEntry.deleteMany();
  await prisma.assessmentWeight.deleteMany();
  await prisma.gradeScaleBand.deleteMany();
  await prisma.gradeScale.deleteMany();
  await prisma.studentAttendance.deleteMany();
  await prisma.teacherAttendance.deleteMany();
  await prisma.attendanceQRToken.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.attendanceLocation.deleteMany();
  await prisma.quizAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quizChoice.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignmentMaterial.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.courseMaterial.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.courseTeacher.deleteMany();
  await prisma.classSection.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.department.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.user.deleteMany();

  // CMS content (re-seeded via upserts in seedCmsContent; clear pages/media orphans)
  await prisma.cmsNewsPost.deleteMany();
  await prisma.cmsEvent.deleteMany();
  await prisma.cmsNavItem.deleteMany();
  await prisma.cmsProgramMarketing.deleteMany();
  await prisma.cmsFacultyMarketing.deleteMany();
  await prisma.cmsPageBlock.deleteMany();
  await prisma.cmsPage.deleteMany();
  await prisma.cmsMediaAsset.deleteMany();

  const passwordHash = await bcrypt.hash("DHAPTI@2026", 12);

  await prisma.gradeScale.create({
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

  const seededFaculties: Array<{
    id: string;
    code: string;
    departments: Array<{ id: string; code: string }>;
  }> = [];

  for (const faculty of DHAPTI_FACULTY_DEPARTMENT_CATALOG) {
    const created = await prisma.faculty.create({
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
      include: { departments: true },
    });
    seededFaculties.push({
      id: created.id,
      code: created.code,
      departments: created.departments.map((d) => ({ id: d.id, code: d.code })),
    });
    console.log(
      `  ✓ ${faculty.name} (${faculty.code}) — ${faculty.departments.length} departments`
    );
  }

  if (seededFaculties.length !== DHAPTI_FACULTY_DEPARTMENT_CATALOG.length) {
    throw new Error(
      `Expected ${DHAPTI_FACULTY_DEPARTMENT_CATALOG.length} faculties, seeded ${seededFaculties.length}`
    );
  }
  console.log(`Seeded ${seededFaculties.length} Dhapti faculties.`);

  const cit = seededFaculties.find((f) => f.code === "CIT")!;
  const medicine = seededFaculties.find((f) => f.code === "MED")!;
  const business = seededFaculties.find((f) => f.code === "BUS")!;
  const engineering = seededFaculties.find((f) => f.code === "ENG")!;
  const csDept = cit.departments.find((d) => d.code === "CS")!;
  const medDept = medicine.departments.find((d) => d.code === "MS")!;
  const busDept = business.departments.find((d) => d.code === "BA")!;
  const engDept = engineering.departments.find((d) => d.code === "CE")!;

  const facultyByCode = new Map(seededFaculties.map((f) => [f.code, f]));
  const seededCourses: Array<{ id: string; code: string }> = [];

  for (const course of DHAPTI_COURSE_CATALOG) {
    const faculty = facultyByCode.get(course.facultyCode);
    const department = faculty?.departments.find(
      (d) => d.code === course.departmentCode
    );
    if (!faculty || !department) {
      throw new Error(
        `Missing faculty/department for course ${course.code} (${course.facultyCode}/${course.departmentCode})`
      );
    }
    const created = await prisma.course.create({
      data: {
        code: course.code,
        title: course.title,
        credits: 3,
        facultyId: faculty.id,
        departmentId: department.id,
        semester: course.semester,
        status: "ACTIVE",
      },
    });
    seededCourses.push({ id: created.id, code: created.code });
  }
  console.log(`Seeded ${seededCourses.length} Dhapti courses.`);

  const cs101 = seededCourses.find((c) => c.code === "CS101")!;
  const cs301 = seededCourses.find((c) => c.code === "CS301")!;
  const cs305 = seededCourses.find((c) => c.code === "CS305")!;

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@dhapti.edu.so",
      passwordHash,
      role: "ADMIN",
      admin: {
        create: {
          fullName: "Admin User",
          email: "admin@dhapti.edu.so",
        },
      },
    },
    include: { admin: true },
  });

  const deptAdminUser = await prisma.user.create({
    data: {
      email: "dept.cs@dhapti.edu.so",
      passwordHash,
      role: "DEPARTMENT_ADMIN",
      admin: {
        create: {
          fullName: "CS Department Admin",
          email: "dept.cs@dhapti.edu.so",
        },
      },
      departmentScope: {
        create: { departmentId: csDept.id },
      },
    },
    include: { admin: true, departmentScope: true },
  });
  void deptAdminUser;

  const examAdminUser = await prisma.user.create({
    data: {
      email: "exam.control@dhapti.edu.so",
      passwordHash,
      role: "EXAM_ADMIN",
      admin: {
        create: {
          fullName: "Exam Control Officer",
          email: "exam.control@dhapti.edu.so",
        },
      },
    },
    include: { admin: true },
  });
  void examAdminUser;

  const certAdminUser = await prisma.user.create({
    data: {
      email: "cert.admin@dhapti.edu.so",
      passwordHash,
      role: "CERTIFICATE_ADMIN",
      admin: {
        create: {
          fullName: "Certificate Administrator",
          email: "cert.admin@dhapti.edu.so",
        },
      },
    },
    include: { admin: true },
  });
  void certAdminUser;

  const teacherUser = await prisma.user.create({
    data: {
      email: "mohamed.ali@dhapti.edu.so",
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          facultyCode: "DHAPTI-FAC-014",
          fullName: "Prof. Mohamed Hassan Ali",
          email: "mohamed.ali@dhapti.edu.so",
          designation: "Professor",
          departmentId: csDept.id,
          bio: "Software engineering and database systems specialist — Faculty of Computing & IT.",
          courseTeachers: {
            create: [
              { courseId: cs101.id },
              { courseId: cs301.id },
              { courseId: cs305.id },
            ],
          },
        },
      },
    },
    include: { teacher: true },
  });

  await prisma.user.create({
    data: {
      email: "amina.warsame@dhapti.edu.so",
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          facultyCode: "DHAPTI-FAC-021",
          fullName: "Dr. Amina Warsame Hassan",
          email: "amina.warsame@dhapti.edu.so",
          designation: "Associate Professor",
          departmentId: medDept.id,
          bio: "Clinical medicine and public health — Faculty of Medicine & Health Sciences.",
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: "abdirahman.omar@dhapti.edu.so",
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          facultyCode: "DHAPTI-FAC-033",
          fullName: "Eng. Abdirahman Omar Osman",
          email: "abdirahman.omar@dhapti.edu.so",
          designation: "Senior Lecturer",
          departmentId: engDept.id,
          bio: "Civil and structural engineering — Faculty of Engineering & Technology.",
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: "fatima.ahmed@dhapti.edu.so",
      passwordHash,
      role: "TEACHER",
      teacher: {
        create: {
          facultyCode: "DHAPTI-FAC-042",
          fullName: "Dr. Fatima Ahmed Abdi",
          email: "fatima.ahmed@dhapti.edu.so",
          designation: "Lecturer",
          departmentId: busDept.id,
          bio: "Business administration and economics — Faculty of Business & Economics.",
        },
      },
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: "mohamudcade143@gmail.com",
      passwordHash,
      role: "STUDENT",
      student: {
        create: {
          studentCode: "DHAPTI-2024-001",
          fullName: "Mohamud Mohamed Abas",
          motherName: "Fadumo Ali",
          email: "mohamudcade143@gmail.com",
          phone: "+252 61 234 5001",
          address: "Dhapti Campus",
          bloodGroup: "O+",
          facultyId: cit.id,
          departmentId: csDept.id,
          semester: "Semester 4",
          program: "BSc Computer Science",
          batch: "2024",
          nationality: "Somali",
        },
      },
    },
    include: { student: true },
  });

  // Class sections for all courses assigned to Prof. Mohamed (My Classes / My Attendance)
  const cs101Class = await prisma.classSection.create({
    data: {
      courseId: cs101.id,
      teacherId: teacherUser.teacher!.id,
      section: "A",
      academicYear: "2025/2026",
      semester: "Semester 1",
      room: "Lab 1",
      dayOfWeek: "Mon / Wed",
      startTime: "08:00",
      endTime: "10:00",
      status: "ACTIVE",
    },
  });
  // Match seeded student semester (Semester 4) so rating/evaluation tests have a current enrollment.
  const cs301Class = await prisma.classSection.create({
    data: {
      courseId: cs301.id,
      teacherId: teacherUser.teacher!.id,
      section: "A",
      academicYear: "2025/2026",
      semester: "Semester 4",
      room: "Lab 2",
      dayOfWeek: "Tue / Thu",
      startTime: "11:00",
      endTime: "13:00",
      status: "ACTIVE",
    },
  });
  const cs305Class = await prisma.classSection.create({
    data: {
      courseId: cs305.id,
      teacherId: teacherUser.teacher!.id,
      section: "A",
      academicYear: "2025/2026",
      semester: "Semester 4",
      room: "Room 4",
      dayOfWeek: "Wed / Fri",
      startTime: "14:00",
      endTime: "16:00",
      status: "ACTIVE",
    },
  });

  await prisma.enrollment.createMany({
    data: [
      { studentId: studentUser.student!.id, classSectionId: cs101Class.id },
      { studentId: studentUser.student!.id, classSectionId: cs301Class.id },
      { studentId: studentUser.student!.id, classSectionId: cs305Class.id },
    ],
  });

  const studentId = studentUser.student!.id;
  const adminId = adminUser.admin!.id;
  await prisma.payment.createMany({
    data: [
      {
        studentId,
        amount: 1200,
        description: "Tuition Fee — Installment #1",
        semester: "Semester 3",
        receiptNumber: "RCPT-SEED-8821",
        paymentMethod: "EVC Plus",
        status: "PAID",
        paidAt: new Date("2026-07-10T10:00:00.000Z"),
        recordedById: adminId,
      },
      {
        studentId,
        amount: 1500,
        description: "Tuition Fee — Installment #2",
        semester: "Semester 2",
        receiptNumber: "RCPT-SEED-8744",
        paymentMethod: "Salaam Bank",
        status: "PAID",
        paidAt: new Date("2026-02-12T10:00:00.000Z"),
        recordedById: adminId,
      },
      {
        studentId,
        amount: 450,
        description: "Tuition Fee — Current Semester",
        semester: "Semester 3",
        status: "PENDING",
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
      },
      {
        studentId,
        amount: 150,
        description: "Library & Lab Fee",
        semester: "Semester 3",
        status: "PENDING",
        dueDate: new Date("2026-08-20T00:00:00.000Z"),
      },
    ],
  });

  await prisma.admissionApplication.createMany({
    data: [
      {
        trackingCode: "APP-2026-0001",
        fullName: "Amina Hassan Yusuf",
        email: "amina.hassan.applicant@example.com",
        phone: "+252 61 700 1001",
        facultyId: medicine.id,
        highSchoolGPA: 88.5,
        status: "PENDING",
      },
      {
        trackingCode: "APP-2026-0002",
        fullName: "Omar Abdi Farah",
        email: "omar.abdi.applicant@example.com",
        phone: "+252 61 700 1002",
        facultyId: cit.id,
        highSchoolGPA: 82.0,
        status: "UNDER_REVIEW",
      },
    ],
  });

  const welcome = await prisma.notification.create({
    data: {
      type: "SYSTEM",
      title: "Welcome to Dhapti Portal",
      message: "Your student account is active. Explore courses and assignments.",
      link: "/student/dashboard",
      createdById: adminUser.id,
      recipients: { create: [{ userId: studentUser.id }] },
    },
  });
  void welcome;

  await prisma.notification.create({
    data: {
      type: "SYSTEM",
      title: "Faculty portal ready",
      message: "You can manage classes, attendance, and grading.",
      link: "/teacher/dashboard",
      createdById: adminUser.id,
      recipients: { create: [{ userId: teacherUser.id }] },
    },
  });

  await prisma.notification.create({
    data: {
      type: "SYSTEM",
      title: "Admin control center",
      message: "Manage students, teachers, admissions, and academic structure.",
      link: "/admin/dashboard",
      createdById: adminUser.id,
      recipients: { create: [{ userId: adminUser.id }] },
    },
  });

  await prisma.certificate.create({
    data: {
      verificationCode: "DHAPTIVERIFY001A",
      studentId: studentUser.student!.id,
      studentName: studentUser.student!.fullName,
      degreeTitle: "Bachelor of Science in Computer Science",
      facultyName: "Faculty of Computing & IT",
      programName: studentUser.student!.program ?? "BSc Computer Science",
      graduationDate: new Date("2026-06-15T00:00:00.000Z"),
      issuedAt: new Date("2026-06-20T00:00:00.000Z"),
      status: "VALID",
      issuedById: adminUser.id,
    },
  });

  await seedCmsContent(prisma);

  // Phase A: default MAIN attendance location per ACTIVE department
  const activeDepts = await prisma.department.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
  });
  for (const dept of activeDepts) {
    await prisma.attendanceLocation.upsert({
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

  // Faculty QR attendance policy defaults (SystemSettings)
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
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }

  console.log("Seed complete.");
  console.log("Demo logins (password for all: DHAPTI@2026)");
  console.log("  Student: mohamudcade143@gmail.com");
  console.log("  Teacher: mohamed.ali@dhapti.edu.so");
  console.log("  Admin:   admin@dhapti.edu.so");
  console.log("  Certificate Admin: cert.admin@dhapti.edu.so");
  console.log("  Exam Control: exam.control@dhapti.edu.so");
  console.log("  Dept Admin (CS): dept.cs@dhapti.edu.so");
  console.log("  Sample certificate code: DHAPTIVERIFY001A");
  console.log("  CMS: news, events, nav, faculties & programs seeded (PUBLISHED)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
