import { prisma } from "./prisma.js";
import { isGradeScaleConfigured } from "./gradingScale.js";

export type GpaStatus = "OK" | "NOT_CONFIGURED" | "NO_APPROVED_RESULTS";

export type SemesterGpaRow = {
  academicYear: string;
  semester: string;
  credits: number;
  qualityPoints: number | null;
  gpa: number | null;
  courseCount: number;
};

export type GpaSummary = {
  status: GpaStatus;
  message: string;
  cumulativeGpa: number | null;
  totalCredits: number;
  totalQualityPoints: number | null;
  semesters: SemesterGpaRow[];
};

/**
 * GPA is computed from APPROVED results with gradePoint values.
 * Official Dhapti scale is always configured (DB bands optional overlay).
 */
export async function getStudentGpaSummary(studentId: string): Promise<GpaSummary> {
  const scaleConfigured = await isGradeScaleConfigured();
  if (!scaleConfigured) {
    return {
      status: "NOT_CONFIGURED",
      message:
        "Grade-point scale is not configured. Numeric course results may exist, but GPA cannot be calculated until Dhapti configures an active grade scale.",
      cumulativeGpa: null,
      totalCredits: 0,
      totalQualityPoints: null,
      semesters: [],
    };
  }

  const results = await prisma.resultEntry.findMany({
    where: {
      studentId,
      status: "APPROVED",
      gradePoint: { not: null },
      creditHours: { gt: 0 },
    },
    include: {
      classSection: {
        select: { academicYear: true, semester: true },
      },
    },
  });

  if (!results.length) {
    return {
      status: "NO_APPROVED_RESULTS",
      message: "No approved course results with grade points are available.",
      cumulativeGpa: null,
      totalCredits: 0,
      totalQualityPoints: null,
      semesters: [],
    };
  }

  const byTerm = new Map<string, SemesterGpaRow>();
  let totalCredits = 0;
  let totalQp = 0;

  for (const r of results) {
    const gp = r.gradePoint!;
    const credits = r.creditHours;
    const qp = gp * credits;
    totalCredits += credits;
    totalQp += qp;

    const key = `${r.classSection.academicYear}::${r.classSection.semester}`;
    const existing = byTerm.get(key) ?? {
      academicYear: r.classSection.academicYear,
      semester: r.classSection.semester,
      credits: 0,
      qualityPoints: 0,
      gpa: null,
      courseCount: 0,
    };
    existing.credits += credits;
    existing.qualityPoints = (existing.qualityPoints ?? 0) + qp;
    existing.courseCount += 1;
    byTerm.set(key, existing);
  }

  const semesters = [...byTerm.values()]
    .map((s) => ({
      ...s,
      gpa:
        s.credits > 0
          ? roundGpa((s.qualityPoints ?? 0) / s.credits)
          : null,
      qualityPoints: s.qualityPoints != null ? roundGpa(s.qualityPoints) : null,
    }))
    .sort((a, b) =>
      a.academicYear === b.academicYear
        ? a.semester.localeCompare(b.semester)
        : a.academicYear.localeCompare(b.academicYear)
    );

  return {
    status: "OK",
    message: "GPA calculated from approved course results.",
    cumulativeGpa: totalCredits > 0 ? roundGpa(totalQp / totalCredits) : null,
    totalCredits,
    totalQualityPoints: roundGpa(totalQp),
    semesters,
  };
}

function roundGpa(n: number) {
  return Math.round(n * 100) / 100;
}
