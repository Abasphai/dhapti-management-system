import type { ResultWithRelations } from "./courseResults.js";
import { BIU_COMPONENT_CAPS } from "./gradingPolicy.js";

export type BiuComponentsPayload = {
  midterm: number;
  finalExam: number;
  quiz: number;
  attendance: number;
  presentation: number;
  assignment: number;
};

function parseCalculation(row: ResultWithRelations) {
  let breakdown: unknown = null;
  let gradeScaleConfigured = row.letterGrade != null && row.gradePoint != null;
  let policy: string | null = null;
  let biuComponents: BiuComponentsPayload | null = null;

  if (row.calculationJson) {
    try {
      const parsed = JSON.parse(row.calculationJson) as {
        breakdown?: unknown;
        gradeScaleConfigured?: boolean;
        policy?: string;
        components?: BiuComponentsPayload;
      };
      breakdown = parsed.breakdown ?? null;
      if (parsed.gradeScaleConfigured != null) {
        gradeScaleConfigured = !!parsed.gradeScaleConfigured;
      }
      policy = parsed.policy ?? null;
      if (parsed.components) {
        biuComponents = parsed.components;
      }
    } catch {
      breakdown = null;
    }
  }

  return { breakdown, gradeScaleConfigured, policy, biuComponents };
}

/** Human-readable Dhapti component lines e.g. Midterm/30 */
export function formatBiuComponentBreakdown(
  components: BiuComponentsPayload | null
) {
  if (!components) return null;
  return {
    midterm: `${components.midterm}/${BIU_COMPONENT_CAPS.MIDTERM}`,
    finalExam: `${components.finalExam}/${BIU_COMPONENT_CAPS.FINAL_EXAM}`,
    assignment: `${components.assignment}/${BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED}`,
    quiz: `${components.quiz}/${BIU_COMPONENT_CAPS.QUIZ}`,
    presentation: `${components.presentation}/${BIU_COMPONENT_CAPS.PRESENTATION}`,
    attendance: `${components.attendance}/${BIU_COMPONENT_CAPS.ATTENDANCE}`,
  };
}

export function serializeCourseResult(
  row: ResultWithRelations,
  opts?: { includeInternal?: boolean }
) {
  const { breakdown, gradeScaleConfigured, policy, biuComponents } =
    parseCalculation(row);
  const componentDisplay = formatBiuComponentBreakdown(biuComponents);

  const base = {
    id: row.id,
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    studentCode: row.student.studentCode,
    studentName: row.student.fullName,
    classSectionId: row.classSectionId,
    courseId: row.courseId,
    courseCode: row.course.code,
    courseTitle: row.course.title,
    section: row.classSection.section,
    academicYear: row.classSection.academicYear,
    semester: row.classSection.semester,
    teacherId: row.teacherId,
    teacherName: row.teacher.fullName,
    marks: row.marks,
    maxMarks: row.maxMarks,
    creditHours: row.creditHours,
    letterGrade: row.letterGrade,
    gradePoint: row.gradePoint,
    letterGradeDisplay: row.letterGrade ?? "—",
    gradePointDisplay:
      row.gradePoint != null ? String(row.gradePoint) : "—",
    gradeScaleConfigured,
    gradingPolicy: policy,
    biuComponents,
    componentDisplay,
    status: row.status,
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    faculty: row.classSection.course.faculty,
    department: row.classSection.course.department,
  };

  if (opts?.includeInternal) {
    return {
      ...base,
      teacherNote: row.teacherNote,
      adminNote: row.adminNote,
      returnReason: row.returnReason,
      breakdown,
    };
  }

  return {
    ...base,
    breakdown: policy === "DHAPTI" ? breakdown : undefined,
  };
}
