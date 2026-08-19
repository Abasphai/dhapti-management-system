import { calcAttendancePercentage, todayDateOnly } from "./attendanceCalc.js";
import { getStudentGpaSummary } from "./gpa.js";
import { buildAdminFinanceSummary, summarizeLedger } from "./payments.js";
import { prisma } from "./prisma.js";
import { getSystemSettings } from "./settings.js";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function weekdayName(d = new Date()) {
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function mapAdmissionStatus(status: string): "Approved" | "Pending" | "Rejected" {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

export async function getAdminDashboardStats() {
  const [
    totalStudents,
    activeFaculty,
    activePrograms,
    activeFaculties,
    finance,
    recentApps,
    settings,
    paidRecent,
  ] = await Promise.all([
    prisma.student.count({ where: { user: { status: "ACTIVE" } } }),
    prisma.teacher.count({ where: { user: { status: "ACTIVE" } } }),
    prisma.course.count({ where: { status: "ACTIVE" } }),
    prisma.faculty.count({ where: { status: "ACTIVE" } }),
    buildAdminFinanceSummary(),
    prisma.admissionApplication.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        faculty: { select: { name: true } },
        student: { select: { studentCode: true } },
      },
    }),
    getSystemSettings(),
    prisma.payment.findMany({
      where: {
        status: "PAID",
        paidAt: { not: null },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "desc" },
      take: 500,
    }),
  ]);

  const dayBuckets = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, 0);
  }
  for (const p of paidRecent) {
    if (!p.paidAt) continue;
    const key = p.paidAt.toISOString().slice(0, 10);
    if (dayBuckets.has(key)) {
      dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + p.amount);
    }
  }
  const financeDays = [...dayBuckets.entries()].map(([day, amount]) => {
    const d = new Date(`${day}T00:00:00.000Z`);
    return {
      day: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      amount: Math.round(amount * 100) / 100,
      date: day,
    };
  });
  const maxDay = Math.max(1, ...financeDays.map((d) => d.amount));
  const financeSummary = financeDays.map((d) => ({
    ...d,
    pct: Math.round((d.amount / maxDay) * 100),
  }));

  return {
    totalStudents,
    activeFaculty,
    currentRevenue: finance.totalRevenue,
    currentRevenueLabel: formatMoney(finance.totalRevenue),
    activePrograms,
    activeFaculties,
    outstandingDues: finance.outstandingDues,
    academicYear: settings.currentAcademicYear,
    semester: settings.currentSemester,
    maintenanceMode: settings.maintenanceMode,
    recentRegistrations: recentApps.map((a) => ({
      name: a.fullName,
      id: a.student?.studentCode ?? a.trackingCode,
      faculty: a.faculty?.name ?? "—",
      status: mapAdmissionStatus(a.status),
      applicationStatus: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
    financeSummary,
  };
}

export async function getTeacherDashboardStats(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      department: { select: { name: true, faculty: { select: { name: true } } } },
    },
  });
  if (!teacher) return null;

  const settings = await getSystemSettings();
  const sections = await prisma.classSection.findMany({
    where: { teacherId: teacher.id, status: "ACTIVE" },
    include: {
      course: { select: { id: true, code: true, title: true } },
      _count: {
        select: { enrollments: { where: { status: "ACTIVE" } } },
      },
    },
  });

  const sectionIds = sections.map((s) => s.id);
  const courseIds = new Set(sections.map((s) => s.courseId));

  const studentIds = sectionIds.length
    ? await prisma.enrollment.findMany({
        where: { classSectionId: { in: sectionIds }, status: "ACTIVE" },
        select: { studentId: true },
        distinct: ["studentId"],
      })
    : [];

  const pendingGrading = sectionIds.length
    ? await prisma.submission.count({
        where: {
          status: { in: ["SUBMITTED", "LATE"] },
          assignment: {
            teacherId: teacher.id,
            classSectionId: { in: sectionIds },
            status: "PUBLISHED",
          },
        },
      })
    : 0;

  const today = todayDateOnly();
  const todaySessions = sectionIds.length
    ? await prisma.classSession.findMany({
        where: {
          classSectionId: { in: sectionIds },
          date: new Date(`${today}T00:00:00.000Z`),
          status: { not: "CANCELLED" },
        },
        include: {
          classSection: {
            include: {
              course: { select: { code: true, title: true } },
            },
          },
        },
        orderBy: { scheduledStartTime: "asc" },
      })
    : [];

  let todayClasses =
    todaySessions.map((s) => ({
      subject: s.classSection.course.title,
      code: s.classSection.course.code,
      time:
        s.scheduledStartTime && s.scheduledEndTime
          ? `${s.scheduledStartTime} – ${s.scheduledEndTime}`
          : s.scheduledStartTime || "TBD",
      room: s.classSection.room || "TBD",
      section: s.classSection.section,
    })) ?? [];

  if (todayClasses.length === 0) {
    const day = weekdayName();
    todayClasses = sections
      .filter(
        (s) =>
          s.dayOfWeek &&
          s.dayOfWeek.toLowerCase().startsWith(day.slice(0, 3).toLowerCase())
      )
      .map((s) => ({
        subject: s.course.title,
        code: s.course.code,
        time:
          s.startTime && s.endTime
            ? `${s.startTime} – ${s.endTime}`
            : s.startTime || "TBD",
        room: s.room || "TBD",
        section: s.section,
      }));
  }

  let avgAttendance: number | null = null;
  if (sectionIds.length) {
    const marks = await prisma.studentAttendance.groupBy({
      by: ["status"],
      where: {
        session: { classSectionId: { in: sectionIds } },
      },
      _count: { _all: true },
    });
    let present = 0;
    let late = 0;
    let absent = 0;
    for (const m of marks) {
      if (m.status === "PRESENT") present = m._count._all;
      if (m.status === "LATE") late = m._count._all;
      if (m.status === "ABSENT") absent = m._count._all;
    }
    avgAttendance = calcAttendancePercentage({ present, late, absent });
  }

  const deptLabel =
    teacher.department?.faculty?.name ||
    teacher.department?.name ||
    "Faculty";

  return {
    teacherName: teacher.fullName,
    department: deptLabel,
    academicYear: settings.currentAcademicYear,
    semester: settings.currentSemester,
    activeCourses: courseIds.size,
    totalStudents: studentIds.length,
    pendingGrading,
    avgAttendance,
    avgAttendanceLabel:
      avgAttendance === null ? "—" : `${Math.round(avgAttendance)}%`,
    todayClasses,
    todayLabel: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export async function getStudentDashboardStats(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      faculty: { select: { name: true } },
    },
  });
  if (!student) return null;

  const settings = await getSystemSettings();

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      classSection: {
        include: {
          course: { select: { code: true, title: true } },
        },
      },
    },
  });

  const sectionIds = enrollments.map((e) => e.classSectionId);

  const marks = sectionIds.length
    ? await prisma.studentAttendance.groupBy({
        by: ["status"],
        where: {
          studentId: student.id,
          session: { classSectionId: { in: sectionIds } },
        },
        _count: { _all: true },
      })
    : [];

  let present = 0;
  let late = 0;
  let absent = 0;
  for (const m of marks) {
    if (m.status === "PRESENT") present = m._count._all;
    if (m.status === "LATE") late = m._count._all;
    if (m.status === "ABSENT") absent = m._count._all;
  }
  const attendancePercent = calcAttendancePercentage({
    present,
    late,
    absent,
  });

  const gpa = await getStudentGpaSummary(student.id);

  const payments = await prisma.payment.findMany({
    where: { studentId: student.id },
  });
  const ledger = summarizeLedger(payments);

  const pendingAssignments = sectionIds.length
    ? await prisma.assignment.count({
        where: {
          classSectionId: { in: sectionIds },
          status: "PUBLISHED",
          dueAt: { gte: new Date() },
          submissions: {
            none: { studentId: student.id },
          },
        },
      })
    : 0;

  const today = todayDateOnly();
  const todaySessions = sectionIds.length
    ? await prisma.classSession.findMany({
        where: {
          classSectionId: { in: sectionIds },
          date: new Date(`${today}T00:00:00.000Z`),
          status: { not: "CANCELLED" },
        },
        include: {
          classSection: {
            include: { course: { select: { code: true, title: true } } },
          },
        },
        orderBy: { scheduledStartTime: "asc" },
      })
    : [];

  let todaySchedule = todaySessions.map((s) => ({
    subject: s.classSection.course.title,
    code: s.classSection.course.code,
    time:
      s.scheduledStartTime && s.scheduledEndTime
        ? `${s.scheduledStartTime} – ${s.scheduledEndTime}`
        : s.scheduledStartTime || "TBD",
    room: s.classSection.room || "TBD",
    status: "Upcoming" as const,
  }));

  if (todaySchedule.length === 0) {
    const day = weekdayName();
    todaySchedule = enrollments
      .filter((e) => {
        const dow = e.classSection.dayOfWeek;
        return (
          dow &&
          dow.toLowerCase().startsWith(day.slice(0, 3).toLowerCase())
        );
      })
      .map((e) => ({
        subject: e.classSection.course.title,
        code: e.classSection.course.code,
        time:
          e.classSection.startTime && e.classSection.endTime
            ? `${e.classSection.startTime} – ${e.classSection.endTime}`
            : e.classSection.startTime || "TBD",
        room: e.classSection.room || "TBD",
        status: "Upcoming" as const,
      }));
  }

  const semesterChart = gpa.semesters
    .filter((s) => s.gpa !== null)
    .map((s) => ({
      semester: s.semester,
      gpa: s.gpa as number,
    }));

  return {
    studentName: student.fullName,
    studentCode: student.studentCode,
    faculty: student.faculty?.name ?? student.program ?? null,
    academicYear: settings.currentAcademicYear,
    semester: student.semester || settings.currentSemester,
    enrolledCourses: enrollments.length,
    attendancePercent,
    attendanceLabel:
      attendancePercent === null ? "—" : `${Math.round(attendancePercent)}%`,
    pendingFeeDues: ledger.currentDue,
    pendingAssignments,
    gpaStatus: gpa.status,
    cumulativeGpa: gpa.cumulativeGpa,
    gpaLabel:
      gpa.cumulativeGpa === null
        ? gpa.status === "NOT_CONFIGURED"
          ? "N/A"
          : "—"
        : gpa.cumulativeGpa.toFixed(2),
    finance: {
      totalPaid: ledger.totalPaid,
      currentDue: ledger.currentDue,
      totalDue: ledger.totalDue,
      currency: ledger.currency,
    },
    semesterGrades: semesterChart,
    todaySchedule,
  };
}

/** Phase 6 — department-scoped dashboard for DEPARTMENT_ADMIN */
export async function getDepartmentDashboardStats(departmentId: string) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      id: true,
      name: true,
      code: true,
      faculty: { select: { id: true, name: true, code: true } },
    },
  });
  if (!department) return null;

  const [totalStudents, totalTeachers, totalCourses, activeCourses] =
    await Promise.all([
      prisma.student.count({
        where: { departmentId, user: { status: "ACTIVE" } },
      }),
      prisma.teacher.count({
        where: { departmentId, user: { status: "ACTIVE" } },
      }),
      prisma.course.count({ where: { departmentId } }),
      prisma.course.count({ where: { departmentId, status: "ACTIVE" } }),
    ]);

  return {
    department: {
      id: department.id,
      name: department.name,
      code: department.code,
      facultyName: department.faculty.name,
      facultyCode: department.faculty.code,
    },
    totalStudents,
    totalTeachers,
    totalFaculty: totalTeachers,
    totalCourses,
    activeCourses,
  };
}
