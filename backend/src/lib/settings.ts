import { prisma } from "./prisma.js";

export type PaymentCurrency = "USD" | "SOS";

export type SystemSettings = {
  isAdmissionsOpen: boolean;
  currentAcademicYear: string;
  currentSemester: string;
  maintenanceMode: boolean;
  universityName: string;
  campusAddress: string;
  contactEmail: string;
  contactPhone: string;
  registrationOpen: boolean;
  studentPortalEnabled: boolean;
  teacherPortalEnabled: boolean;
  /** Academic & grading */
  requireAdminGradeApproval: boolean;
  minAttendanceThreshold: number;
  passingGradeCutoff: number;
  maxUploadFileMb: number;
  /** Financial */
  defaultTuitionFee: number;
  admissionApplicationFee: number;
  paymentCurrency: PaymentCurrency;
  paymentGracePeriodDays: number;
  /** Notifications */
  sendStudentWelcomeEmail: boolean;
  sendLowAttendanceWarning: boolean;
  sendGradeApprovalAlert: boolean;
  /** Faculty QR attendance (Phase A+) */
  facultyAttendanceGraceMinutes: number;
  facultyQrTokenTtlSeconds: number;
  facultyRequiredClassMinutesFallback: number;
  allowManualFacultyAttendance: boolean;
  /**
   * IANA timezone for academic "today", schedule windows, late detection.
   * Default Africa/Mogadishu — never use API host OS timezone.
   */
  institutionTimezone: string;
  /** Minutes before scheduled start when QR check-in/out is allowed. */
  facultyQrEarlyStartMinutes: number;
  /** Minutes after scheduled end when QR check-in/out is still allowed. */
  facultyQrLateEndMinutes: number;
};

export type PublicSettings = Pick<
  SystemSettings,
  | "isAdmissionsOpen"
  | "currentAcademicYear"
  | "currentSemester"
  | "maintenanceMode"
>;

const DEFAULTS: SystemSettings = {
  isAdmissionsOpen: true,
  currentAcademicYear: "2025/2026",
  currentSemester: "Semester 1",
  maintenanceMode: false,
  universityName: "Dhapti University",
  campusAddress:
    "Dhapti Campus, Dhapti Region, Somalia",
  contactEmail: "admin@dhapti.edu.so",
  contactPhone: "+252 61 555 0100",
  registrationOpen: true,
  studentPortalEnabled: true,
  teacherPortalEnabled: true,
  requireAdminGradeApproval: true,
  minAttendanceThreshold: 75,
  passingGradeCutoff: 50,
  maxUploadFileMb: 500,
  defaultTuitionFee: 1200,
  admissionApplicationFee: 50,
  paymentCurrency: "USD",
  paymentGracePeriodDays: 30,
  sendStudentWelcomeEmail: true,
  sendLowAttendanceWarning: true,
  sendGradeApprovalAlert: true,
  facultyAttendanceGraceMinutes: 10,
  facultyQrTokenTtlSeconds: 300,
  facultyRequiredClassMinutesFallback: 120,
  allowManualFacultyAttendance: true,
  institutionTimezone: "Africa/Mogadishu",
  facultyQrEarlyStartMinutes: 30,
  facultyQrLateEndMinutes: 60,
};

function parseBool(raw: string | undefined, fallback: boolean) {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

function parseNumber(
  raw: string | undefined,
  fallback: number,
  opts?: { min?: number; max?: number }
) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  let value = n;
  if (opts?.min != null) value = Math.max(opts.min, value);
  if (opts?.max != null) value = Math.min(opts.max, value);
  return value;
}

function parseCurrency(
  raw: string | undefined,
  fallback: PaymentCurrency
): PaymentCurrency {
  const v = raw?.trim().toUpperCase();
  if (v === "USD" || v === "SOS") return v;
  return fallback;
}

function serializeValue(value: string | boolean | number) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const rows = await prisma.systemSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    isAdmissionsOpen: parseBool(
      map.get("isAdmissionsOpen"),
      DEFAULTS.isAdmissionsOpen
    ),
    currentAcademicYear:
      map.get("currentAcademicYear")?.trim() || DEFAULTS.currentAcademicYear,
    currentSemester:
      map.get("currentSemester")?.trim() || DEFAULTS.currentSemester,
    maintenanceMode: parseBool(
      map.get("maintenanceMode"),
      DEFAULTS.maintenanceMode
    ),
    universityName:
      map.get("universityName")?.trim() || DEFAULTS.universityName,
    campusAddress: map.get("campusAddress")?.trim() || DEFAULTS.campusAddress,
    contactEmail: map.get("contactEmail")?.trim() || DEFAULTS.contactEmail,
    contactPhone: map.get("contactPhone")?.trim() || DEFAULTS.contactPhone,
    registrationOpen: parseBool(
      map.get("registrationOpen"),
      DEFAULTS.registrationOpen
    ),
    studentPortalEnabled: parseBool(
      map.get("studentPortalEnabled"),
      DEFAULTS.studentPortalEnabled
    ),
    teacherPortalEnabled: parseBool(
      map.get("teacherPortalEnabled"),
      DEFAULTS.teacherPortalEnabled
    ),
    requireAdminGradeApproval: parseBool(
      map.get("requireAdminGradeApproval"),
      DEFAULTS.requireAdminGradeApproval
    ),
    minAttendanceThreshold: parseNumber(
      map.get("minAttendanceThreshold"),
      DEFAULTS.minAttendanceThreshold,
      { min: 0, max: 100 }
    ),
    passingGradeCutoff: parseNumber(
      map.get("passingGradeCutoff"),
      DEFAULTS.passingGradeCutoff,
      { min: 0, max: 100 }
    ),
    maxUploadFileMb: parseNumber(
      map.get("maxUploadFileMb"),
      DEFAULTS.maxUploadFileMb,
      { min: 1, max: 2000 }
    ),
    defaultTuitionFee: parseNumber(
      map.get("defaultTuitionFee"),
      DEFAULTS.defaultTuitionFee,
      { min: 0, max: 1_000_000 }
    ),
    admissionApplicationFee: parseNumber(
      map.get("admissionApplicationFee"),
      DEFAULTS.admissionApplicationFee,
      { min: 0, max: 1_000_000 }
    ),
    paymentCurrency: parseCurrency(
      map.get("paymentCurrency"),
      DEFAULTS.paymentCurrency
    ),
    paymentGracePeriodDays: parseNumber(
      map.get("paymentGracePeriodDays"),
      DEFAULTS.paymentGracePeriodDays,
      { min: 0, max: 365 }
    ),
    sendStudentWelcomeEmail: parseBool(
      map.get("sendStudentWelcomeEmail"),
      DEFAULTS.sendStudentWelcomeEmail
    ),
    sendLowAttendanceWarning: parseBool(
      map.get("sendLowAttendanceWarning"),
      DEFAULTS.sendLowAttendanceWarning
    ),
    sendGradeApprovalAlert: parseBool(
      map.get("sendGradeApprovalAlert"),
      DEFAULTS.sendGradeApprovalAlert
    ),
    facultyAttendanceGraceMinutes: parseNumber(
      map.get("facultyAttendanceGraceMinutes"),
      DEFAULTS.facultyAttendanceGraceMinutes,
      { min: 0, max: 120 }
    ),
    facultyQrTokenTtlSeconds: parseNumber(
      map.get("facultyQrTokenTtlSeconds"),
      DEFAULTS.facultyQrTokenTtlSeconds,
      { min: 60, max: 3600 }
    ),
    facultyRequiredClassMinutesFallback: parseNumber(
      map.get("facultyRequiredClassMinutesFallback"),
      DEFAULTS.facultyRequiredClassMinutesFallback,
      { min: 30, max: 480 }
    ),
    allowManualFacultyAttendance: parseBool(
      map.get("allowManualFacultyAttendance"),
      DEFAULTS.allowManualFacultyAttendance
    ),
    institutionTimezone: parseTimezone(
      map.get("institutionTimezone"),
      DEFAULTS.institutionTimezone
    ),
    facultyQrEarlyStartMinutes: parseNumber(
      map.get("facultyQrEarlyStartMinutes"),
      DEFAULTS.facultyQrEarlyStartMinutes,
      { min: 0, max: 180 }
    ),
    facultyQrLateEndMinutes: parseNumber(
      map.get("facultyQrLateEndMinutes"),
      DEFAULTS.facultyQrLateEndMinutes,
      { min: 0, max: 360 }
    ),
  };
}

function parseTimezone(raw: string | undefined, fallback: string): string {
  const v = raw?.trim();
  if (!v) return fallback;
  try {
    // Throws RangeError for invalid IANA zones in modern Node.
    Intl.DateTimeFormat(undefined, { timeZone: v });
    return v;
  } catch {
    return fallback;
  }
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getSystemSettings();
  return {
    isAdmissionsOpen: s.isAdmissionsOpen,
    currentAcademicYear: s.currentAcademicYear,
    currentSemester: s.currentSemester,
    maintenanceMode: s.maintenanceMode,
  };
}

export async function patchSystemSettings(
  patch: Partial<SystemSettings>
): Promise<SystemSettings> {
  const entries = Object.entries(patch).filter(
    ([, v]) => v !== undefined
  ) as Array<[keyof SystemSettings, string | boolean | number]>;

  if (entries.length > 0) {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: serializeValue(value) },
          update: { value: serializeValue(value) },
        })
      )
    );
  }

  return getSystemSettings();
}

export async function isAdmissionsOpen(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "isAdmissionsOpen" },
  });
  return parseBool(row?.value, DEFAULTS.isAdmissionsOpen);
}

export async function getConfiguredMaxUploadFileMb(): Promise<number> {
  const s = await getSystemSettings();
  return Math.max(1, Math.min(2000, s.maxUploadFileMb));
}

/** Faculty QR / timer policy from SystemSettings (Phase A+). */
export async function getFacultyAttendancePolicy() {
  const s = await getSystemSettings();
  return {
    graceMinutes: s.facultyAttendanceGraceMinutes,
    qrTokenTtlSeconds: s.facultyQrTokenTtlSeconds,
    requiredMinutesFallback: s.facultyRequiredClassMinutesFallback,
    allowManual: s.allowManualFacultyAttendance,
    institutionTimezone: s.institutionTimezone,
    earlyStartMinutes: s.facultyQrEarlyStartMinutes,
    lateEndMinutes: s.facultyQrLateEndMinutes,
  };
}

export async function getInstitutionTimezone(): Promise<string> {
  const s = await getSystemSettings();
  return s.institutionTimezone;
}
