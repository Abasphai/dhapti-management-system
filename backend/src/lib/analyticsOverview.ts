import { calcAttendancePercentage } from "./attendanceCalc.js";
import { isGradeScaleConfigured } from "./gradingScale.js";
import { effectivePaymentStatus } from "./payments.js";
import { prisma } from "./prisma.js";
import { getSystemSettings } from "./settings.js";

export type AnalyticsFilters = {
  facultyId?: string | null;
  departmentId?: string | null;
  academicYear?: string | null;
};

export type GradeBucket = "A+" | "A" | "B" | "C" | "F";

const GRADE_ORDER: GradeBucket[] = ["A+", "A", "B", "C", "F"];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Map letter grades into A+, A, B, C, F buckets. */
export function bucketLetterGrade(letter: string | null | undefined): GradeBucket | null {
  if (!letter) return null;
  const L = letter.trim().toUpperCase().replace(/\s+/g, "");
  if (!L) return null;
  if (L === "A+" || L === "APLUS") return "A+";
  if (L.startsWith("A")) return "A";
  if (L.startsWith("B")) return "B";
  if (L.startsWith("C")) return "C";
  return "F";
}

export function isPassingLetter(letter: string | null | undefined): boolean {
  const b = bucketLetterGrade(letter);
  return b !== null && b !== "F";
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Enterprise analytics overview — real DB aggregations with optional filters.
 */
export async function getAnalyticsOverview(filters: AnalyticsFilters = {}) {
  const settings = await getSystemSettings();
  const facultyId = filters.facultyId?.trim() || null;
  const departmentId = filters.departmentId?.trim() || null;
  /** Only applied when explicitly requested — omit for all-years view. */
  const academicYear = filters.academicYear?.trim() || null;

  const departments = await prisma.department.findMany({
    where: {
      ...(facultyId ? { facultyId } : {}),
      ...(departmentId ? { id: departmentId } : {}),
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      code: true,
      faculty: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });
  const departmentIds = departments.map((d) => d.id);

  const scopedStudentWhere = {
    user: { status: "ACTIVE" as const },
    ...(facultyId ? { facultyId } : {}),
    ...(departmentId ? { departmentId } : {}),
  };

  const sectionYearFilter = academicYear
    ? { academicYear }
    : {};

  const [
    totalStudents,
    priorYearStudents,
    payments,
    approvedResults,
    attendanceGroups,
    facultiesForFilter,
    yearsFromSections,
  ] = await Promise.all([
    prisma.student.count({ where: scopedStudentWhere }),
    prisma.student.count({
      where: {
        ...scopedStudentWhere,
        user: {
          status: "ACTIVE",
          createdAt: {
            lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        student: scopedStudentWhere,
      },
      select: {
        amount: true,
        status: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        semester: true,
        studentId: true,
      },
    }),
    prisma.resultEntry.findMany({
      where: {
        status: "APPROVED",
        student: scopedStudentWhere,
        ...(academicYear
          ? { classSection: { academicYear } }
          : {}),
      },
      select: {
        letterGrade: true,
        gradePoint: true,
        creditHours: true,
        marks: true,
        maxMarks: true,
        studentId: true,
        courseId: true,
        classSection: {
          select: {
            academicYear: true,
            semester: true,
            course: { select: { departmentId: true } },
          },
        },
      },
    }),
    prisma.studentAttendance.groupBy({
      by: ["status"],
      where: {
        student: scopedStudentWhere,
        ...(academicYear
          ? { session: { classSection: { academicYear } } }
          : {}),
      },
      _count: { _all: true },
    }),
    prisma.faculty.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.classSection.findMany({
      distinct: ["academicYear"],
      select: { academicYear: true },
      orderBy: { academicYear: "desc" },
    }),
  ]);

  // Revenue
  let totalRevenue = 0;
  let outstanding = 0;
  const monthMap = new Map<string, number>();
  const semesterMap = new Map<string, number>();
  for (const row of payments) {
    const status = effectivePaymentStatus(row);
    if (status === "PAID") {
      totalRevenue += row.amount;
      const paidAt = row.paidAt ?? row.createdAt;
      const mk = monthKey(paidAt);
      monthMap.set(mk, (monthMap.get(mk) ?? 0) + row.amount);
      const sem = (row.semester || "Unspecified").trim() || "Unspecified";
      semesterMap.set(sem, (semesterMap.get(sem) ?? 0) + row.amount);
    } else {
      outstanding += row.amount;
    }
  }
  const billed = totalRevenue + outstanding;
  const collectionRate =
    billed > 0 ? round2((totalRevenue / billed) * 100) : 0;

  const revenueTrend = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, amount]) => ({
      month: monthLabel(key),
      key,
      amount: round2(amount),
    }));

  const revenueBySemester = [...semesterMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([semester, amount]) => ({
      semester,
      amount: round2(amount),
    }));

  // Grade distribution
  const gradeCounts: Record<GradeBucket, number> = {
    "A+": 0,
    A: 0,
    B: 0,
    C: 0,
    F: 0,
  };
  let graded = 0;
  let passed = 0;
  for (const r of approvedResults) {
    const bucket = bucketLetterGrade(r.letterGrade);
    if (!bucket) {
      // fallback from marks
      if (r.marks != null && r.maxMarks > 0) {
        const pct = (r.marks / r.maxMarks) * 100;
        const b: GradeBucket =
          pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : "F";
        gradeCounts[b] += 1;
        graded += 1;
        if (b !== "F") passed += 1;
      }
      continue;
    }
    gradeCounts[bucket] += 1;
    graded += 1;
    if (bucket !== "F") passed += 1;
  }
  const gradeDistribution = GRADE_ORDER.map((grade) => {
    const count = gradeCounts[grade];
    return {
      grade,
      count,
      percentage: graded > 0 ? round2((count / graded) * 100) : 0,
    };
  });
  const overallPassRate = graded > 0 ? round2((passed / graded) * 100) : 0;

  // Campus attendance
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const g of attendanceGroups) {
    if (g.status === "PRESENT") present = g._count._all;
    if (g.status === "LATE") late = g._count._all;
    if (g.status === "ABSENT") absent = g._count._all;
  }
  const campusAttendance = calcAttendancePercentage({ present, late, absent });

  // University average GPA from approved results with grade points
  let totalCredits = 0;
  let totalQp = 0;
  const studentQp = new Map<string, { credits: number; qp: number }>();
  for (const r of approvedResults) {
    if (r.gradePoint == null || r.creditHours <= 0) continue;
    const qp = r.gradePoint * r.creditHours;
    totalCredits += r.creditHours;
    totalQp += qp;
    const cur = studentQp.get(r.studentId) ?? { credits: 0, qp: 0 };
    cur.credits += r.creditHours;
    cur.qp += qp;
    studentQp.set(r.studentId, cur);
  }
  const averageGpa =
    totalCredits > 0 ? round2(totalQp / totalCredits) : null;
  const gpaConfigured = await isGradeScaleConfigured();

  // Per-department metrics
  const studentsByDept = await prisma.student.groupBy({
    by: ["departmentId"],
    where: scopedStudentWhere,
    _count: { _all: true },
  });
  const teachersByDept = await prisma.teacher.groupBy({
    by: ["departmentId"],
    where: {
      user: { status: "ACTIVE" },
      ...(departmentIds.length
        ? { departmentId: { in: departmentIds } }
        : {}),
    },
    _count: { _all: true },
  });
  const coursesByDept = await prisma.course.groupBy({
    by: ["departmentId"],
    where: {
      status: "ACTIVE",
      ...(departmentIds.length
        ? { departmentId: { in: departmentIds } }
        : {}),
    },
    _count: { _all: true },
  });

  const enrollCountByDept = new Map(
    studentsByDept.map((r) => [r.departmentId ?? "", r._count._all])
  );
  const teacherCountByDept = new Map(
    teachersByDept.map((r) => [r.departmentId ?? "", r._count._all])
  );
  const courseCountByDept = new Map(
    coursesByDept.map((r) => [r.departmentId, r._count._all])
  );

  // Attendance per department (via student)
  const attendanceByStudent = await prisma.studentAttendance.groupBy({
    by: ["studentId", "status"],
    where: {
      student: scopedStudentWhere,
      ...(academicYear
        ? { session: { classSection: sectionYearFilter } }
        : {}),
    },
    _count: { _all: true },
  });

  const attAgg = new Map<
    string,
    { present: number; late: number; absent: number }
  >();
  for (const row of attendanceByStudent) {
    const cur = attAgg.get(row.studentId) ?? {
      present: 0,
      late: 0,
      absent: 0,
    };
    if (row.status === "PRESENT") cur.present = row._count._all;
    if (row.status === "LATE") cur.late = row._count._all;
    if (row.status === "ABSENT") cur.absent = row._count._all;
    attAgg.set(row.studentId, cur);
  }

  const studentsMeta = await prisma.student.findMany({
    where: scopedStudentWhere,
    select: {
      id: true,
      fullName: true,
      studentCode: true,
      departmentId: true,
      faculty: { select: { name: true } },
      department: { select: { name: true } },
    },
  });
  const studentMetaMap = new Map(studentsMeta.map((s) => [s.id, s]));

  // Department pass rates + collection from results/payments
  const deptPass = new Map<string, { passed: number; total: number }>();
  for (const r of approvedResults) {
    const deptId =
      r.classSection.course.departmentId ||
      studentMetaMap.get(r.studentId)?.departmentId ||
      "";
    if (!deptId) continue;
    const cur = deptPass.get(deptId) ?? { passed: 0, total: 0 };
    cur.total += 1;
    if (isPassingLetter(r.letterGrade)) cur.passed += 1;
    else if (
      !r.letterGrade &&
      r.marks != null &&
      r.maxMarks > 0 &&
      r.marks / r.maxMarks >= 0.6
    ) {
      cur.passed += 1;
    }
    deptPass.set(deptId, cur);
  }

  const paymentsByStudent = new Map<
    string,
    { paid: number; due: number }
  >();
  for (const p of payments) {
    const cur = paymentsByStudent.get(p.studentId) ?? { paid: 0, due: 0 };
    const status = effectivePaymentStatus(p);
    if (status === "PAID") cur.paid += p.amount;
    else cur.due += p.amount;
    paymentsByStudent.set(p.studentId, cur);
  }

  const deptFinance = new Map<string, { paid: number; due: number }>();
  const deptAttendance = new Map<
    string,
    { present: number; late: number; absent: number }
  >();
  const deptGpa = new Map<string, { credits: number; qp: number }>();

  for (const s of studentsMeta) {
    const deptId = s.departmentId ?? "";
    if (!deptId) continue;

    const pay = paymentsByStudent.get(s.id);
    if (pay) {
      const f = deptFinance.get(deptId) ?? { paid: 0, due: 0 };
      f.paid += pay.paid;
      f.due += pay.due;
      deptFinance.set(deptId, f);
    }

    const att = attAgg.get(s.id);
    if (att) {
      const a = deptAttendance.get(deptId) ?? {
        present: 0,
        late: 0,
        absent: 0,
      };
      a.present += att.present;
      a.late += att.late;
      a.absent += att.absent;
      deptAttendance.set(deptId, a);
    }

    const g = studentQp.get(s.id);
    if (g) {
      const d = deptGpa.get(deptId) ?? { credits: 0, qp: 0 };
      d.credits += g.credits;
      d.qp += g.qp;
      deptGpa.set(deptId, d);
    }
  }

  const departmentBreakdown = departments.map((d) => {
    const enrolled = enrollCountByDept.get(d.id) ?? 0;
    const facultyCount = teacherCountByDept.get(d.id) ?? 0;
    const activeCourses = courseCountByDept.get(d.id) ?? 0;
    const pass = deptPass.get(d.id);
    const passRate =
      pass && pass.total > 0 ? round2((pass.passed / pass.total) * 100) : null;
    const fin = deptFinance.get(d.id) ?? { paid: 0, due: 0 };
    const billedDept = fin.paid + fin.due;
    const collectionPct =
      billedDept > 0 ? round2((fin.paid / billedDept) * 100) : null;
    const att = deptAttendance.get(d.id);
    const avgAttendance = att
      ? calcAttendancePercentage(att)
      : null;
    const g = deptGpa.get(d.id);
    const avgGpa =
      g && g.credits > 0 ? round2(g.qp / g.credits) : null;

    return {
      departmentId: d.id,
      departmentName: d.name,
      departmentCode: d.code,
      facultyName: d.faculty.name,
      enrolledStudents: enrolled,
      facultyCount,
      activeCourses,
      avgAttendance,
      avgGpa,
      passRate,
      collectionRate: collectionPct,
    };
  });

  // At-risk cohort
  const atRisk: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    departmentName: string | null;
    facultyName: string | null;
    attendancePercent: number | null;
    gpa: number | null;
    reasons: string[];
  }> = [];

  for (const s of studentsMeta) {
    const att = attAgg.get(s.id);
    const attendancePercent = att
      ? calcAttendancePercentage(att)
      : null;
    const g = studentQp.get(s.id);
    const gpa =
      g && g.credits > 0 ? round2(g.qp / g.credits) : null;

    const reasons: string[] = [];
    if (attendancePercent != null && attendancePercent < 75) {
      reasons.push(`Attendance ${attendancePercent}% (< 75%)`);
    }
    if (gpa != null && gpa < 2.0) {
      reasons.push(`GPA ${gpa.toFixed(2)} (< 2.0)`);
    }
    if (reasons.length === 0) continue;

    atRisk.push({
      studentId: s.id,
      studentCode: s.studentCode,
      fullName: s.fullName,
      departmentName: s.department?.name ?? null,
      facultyName: s.faculty?.name ?? null,
      attendancePercent,
      gpa,
      reasons,
    });
  }

  atRisk.sort((a, b) => {
    const aScore =
      (a.attendancePercent ?? 100) + (a.gpa != null ? a.gpa * 20 : 40);
    const bScore =
      (b.attendancePercent ?? 100) + (b.gpa != null ? b.gpa * 20 : 40);
    return aScore - bScore;
  });

  const enrollmentGrowthPct =
    priorYearStudents > 0
      ? round2(
          ((totalStudents - priorYearStudents) / priorYearStudents) * 100
        )
      : totalStudents > 0
        ? 100
        : 0;

  const gpaLetterHint =
    averageGpa == null
      ? "—"
      : averageGpa >= 3.7
        ? "A- Average"
        : averageGpa >= 3.3
          ? "B+ Average"
          : averageGpa >= 3.0
            ? "B Average"
            : averageGpa >= 2.0
              ? "C Average"
              : "Below 2.0";

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      facultyId,
      departmentId,
      academicYear,
    },
    filterOptions: {
      faculties: facultiesForFilter,
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        facultyId: d.faculty.id,
      })),
      academicYears: [
        ...new Set(
          [
            settings.currentAcademicYear,
            ...yearsFromSections.map((y) => y.academicYear),
          ].filter(Boolean)
        ),
      ],
    },
    kpis: {
      totalEnrollment: totalStudents,
      enrollmentGrowthPct,
      netRevenue: round2(totalRevenue),
      netRevenueLabel: formatMoney(totalRevenue),
      outstandingDues: round2(outstanding),
      collectionRate,
      averageGpa,
      averageGpaLabel:
        averageGpa == null
          ? gpaConfigured
            ? "—"
            : "N/A"
          : averageGpa.toFixed(2),
      gpaLetterHint,
      gpaConfigured,
      campusAttendance,
      campusAttendanceLabel:
        campusAttendance == null ? "—" : `${campusAttendance}%`,
      attendanceThreshold: 75,
      overallPassRate,
    },
    revenueTrend,
    revenueBySemester,
    departmentBreakdown,
    departmentPerformance: departmentBreakdown.map((d) => ({
      name: d.departmentName,
      enrollment: d.enrolledStudents,
      passRate: d.passRate ?? 0,
      activeCourses: d.activeCourses,
    })),
    gradeDistribution,
    atRiskStudents: atRisk.slice(0, 40),
    atRiskCount: atRisk.length,
  };
}
