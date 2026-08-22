import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { prisma } from "./prisma.js";

const DEMO_PASSWORD = "DHAPTI@2026";

type DemoAccount = {
  email: string;
  role: Role;
  fullName: string;
  /** When set, attach / repair Admin profile */
  adminProfile?: boolean;
  /** DEPARTMENT_ADMIN: scope to CS (or first) department */
  departmentScope?: boolean;
  /** TEACHER / STUDENT profile fields */
  teacher?: boolean;
  student?: boolean;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@dhapti.edu.so",
    role: "ADMIN",
    fullName: "System Administrator",
    adminProfile: true,
  },
  {
    email: "cert.admin@dhapti.edu.so",
    role: "CERTIFICATE_ADMIN",
    fullName: "Certificate Administrator",
    adminProfile: true,
  },
  {
    email: "exam.control@dhapti.edu.so",
    role: "EXAM_ADMIN",
    fullName: "Exam Control Officer",
    adminProfile: true,
  },
  {
    email: "dept.cs@dhapti.edu.so",
    role: "DEPARTMENT_ADMIN",
    fullName: "CS Department Admin",
    adminProfile: true,
    departmentScope: true,
  },
  {
    email: "faculty@dhapti.edu.so",
    role: "TEACHER",
    fullName: "Faculty Demo",
    teacher: true,
  },
  {
    email: "mohamed.ali@dhapti.edu.so",
    role: "TEACHER",
    fullName: "Mohamed Ali",
    teacher: true,
  },
  {
    email: "student@dhapti.edu.so",
    role: "STUDENT",
    fullName: "Student Demo",
    student: true,
  },
  {
    email: "mohamudcade143@gmail.com",
    role: "STUDENT",
    fullName: "Mohamud Mohamed Abas",
    student: true,
  },
];

/**
 * Development safety: ensure ALL demo accounts exist with password DHAPTI@2026.
 * No-op in production. Idempotent — safe on every boot.
 */
export async function ensureDemoAccounts() {
  if (process.env.NODE_ENV === "production") return;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const csDept =
    (await prisma.department.findFirst({ where: { code: "CS" } })) ??
    (await prisma.department.findFirst());

  for (const demo of DEMO_ACCOUNTS) {
    const email = demo.email.toLowerCase();
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        admin: true,
        teacher: true,
        student: true,
        departmentScope: true,
      },
    });

    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            role: demo.role,
            status: "ACTIVE",
            ...(demo.adminProfile
              ? {
                  admin: {
                    create: { fullName: demo.fullName, email },
                  },
                }
              : {}),
            ...(demo.teacher
              ? {
                  teacher: {
                    create: {
                      facultyCode: `DHAPTI-FAC-${Date.now().toString(36).slice(-6).toUpperCase()}`,
                      fullName: demo.fullName,
                      email,
                      designation: "Lecturer",
                      departmentId: csDept?.id ?? null,
                    },
                  },
                }
              : {}),
            ...(demo.student
              ? {
                  student: {
                    create: {
                      studentCode: `DHAPTI-STU-${Date.now().toString(36).slice(-6).toUpperCase()}`,
                      fullName: demo.fullName,
                      email,
                      departmentId: csDept?.id ?? null,
                      facultyId: csDept?.facultyId ?? null,
                      semester: "4",
                      program: "BSc Computer Science",
                    },
                  },
                }
              : {}),
            ...(demo.departmentScope && csDept
              ? {
                  departmentScope: {
                    create: { departmentId: csDept.id },
                  },
                }
              : {}),
          },
          include: {
            admin: true,
            teacher: true,
            student: true,
            departmentScope: true,
          },
        });
        console.log(`Dev ensure: created ${email} (${demo.role})`);
        continue;
      } catch (createErr) {
        // Parallel login/tests may race on the same demo email
        const code =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr
            ? String((createErr as { code?: string }).code)
            : "";
        if (code !== "P2002") throw createErr;
        user = await prisma.user.findUnique({
          where: { email },
          include: {
            admin: true,
            teacher: true,
            student: true,
            departmentScope: true,
          },
        });
        if (!user) throw createErr;
      }
    }

    const ok = await bcrypt.compare(DEMO_PASSWORD, user.passwordHash);
    const needsRepair =
      user.role !== demo.role ||
      user.status !== "ACTIVE" ||
      !ok ||
      !user.passwordHash?.trim();

    if (needsRepair) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: demo.role,
          status: "ACTIVE",
          passwordHash,
        },
      });
      console.log(`Dev ensure: repaired ${email} (${demo.role})`);
    }

    if (demo.adminProfile && !user.admin) {
      await prisma.admin.create({
        data: { userId: user.id, fullName: demo.fullName, email },
      });
      console.log(`Dev ensure: attached Admin profile → ${email}`);
    }

    if (demo.departmentScope && csDept && !user.departmentScope) {
      await prisma.userDepartmentScope.create({
        data: { userId: user.id, departmentId: csDept.id },
      });
      console.log(`Dev ensure: attached department scope → ${email}`);
    } else if (
      demo.departmentScope &&
      csDept &&
      user.departmentScope &&
      user.departmentScope.departmentId !== csDept.id
    ) {
      await prisma.userDepartmentScope.update({
        where: { userId: user.id },
        data: { departmentId: csDept.id },
      });
    }

    if (demo.teacher && !user.teacher) {
      const code = `DHAPTI-FAC-${user.id.slice(-4).toUpperCase()}`;
      await prisma.teacher.create({
        data: {
          userId: user.id,
          facultyCode: code,
          fullName: demo.fullName,
          email,
          designation: "Lecturer",
          departmentId: csDept?.id ?? null,
        },
      });
    }

    if (demo.student && !user.student) {
      await prisma.student.create({
        data: {
          userId: user.id,
          studentCode: `DHAPTI-STU-${user.id.slice(-6).toUpperCase()}`,
          fullName: demo.fullName,
          email,
          departmentId: csDept?.id ?? null,
          facultyId: csDept?.facultyId ?? null,
          semester: "4",
          program: "BSc Computer Science",
        },
      });
    }
  }
}
