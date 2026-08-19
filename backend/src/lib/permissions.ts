import type { Role } from "@prisma/client";

/**
 * Extensible permission catalog.
 * Future roles (REGISTRAR, DEAN, …) map into these strings
 * without changing middleware shape.
 */
export const Permission = {
  PORTAL_ADMIN: "portal.admin",
  PORTAL_TEACHER: "portal.teacher",
  PORTAL_STUDENT: "portal.student",

  STUDENTS_READ: "students.read",
  STUDENTS_CREATE: "students.create",
  STUDENTS_UPDATE: "students.update",
  STUDENTS_DELETE: "students.delete",

  TEACHERS_READ: "teachers.read",
  TEACHERS_CREATE: "teachers.create",
  TEACHERS_UPDATE: "teachers.update",
  TEACHERS_DELETE: "teachers.delete",

  FACULTIES_READ: "faculties.read",
  FACULTIES_CREATE: "faculties.create",
  FACULTIES_UPDATE: "faculties.update",
  FACULTIES_DELETE: "faculties.delete",

  DEPARTMENTS_READ: "departments.read",
  DEPARTMENTS_CREATE: "departments.create",
  DEPARTMENTS_UPDATE: "departments.update",
  DEPARTMENTS_DELETE: "departments.delete",

  COURSES_READ: "courses.read",
  COURSES_CREATE: "courses.create",
  COURSES_UPDATE: "courses.update",
  COURSES_DELETE: "courses.delete",

  TEACHER_COURSES_READ: "teacher_courses.read",
  TEACHER_COURSES_ASSIGN: "teacher_courses.assign",
  TEACHER_COURSES_REMOVE: "teacher_courses.remove",

  CLASSES_READ: "classes.read",
  CLASSES_CREATE: "classes.create",
  CLASSES_UPDATE: "classes.update",
  CLASSES_DELETE: "classes.delete",

  ENROLLMENTS_READ: "enrollments.read",
  ENROLLMENTS_CREATE: "enrollments.create",
  ENROLLMENTS_UPDATE: "enrollments.update",
  ENROLLMENTS_DELETE: "enrollments.delete",

  ASSIGNMENTS_READ: "assignments.read",
  ASSIGNMENTS_CREATE: "assignments.create",
  ASSIGNMENTS_UPDATE: "assignments.update",
  ASSIGNMENTS_DELETE: "assignments.delete",

  SUBMISSIONS_READ: "submissions.read",
  SUBMISSIONS_CREATE: "submissions.create",
  SUBMISSIONS_UPDATE: "submissions.update",

  GRADES_READ: "grades.read",
  GRADES_UPDATE: "grades.update",
  GRADES_SUBMIT: "grades.submit",
  GRADES_APPROVE: "grades.approve",
  GRADES_RETURN: "grades.return",

  QUIZZES_READ: "quizzes.read",
  QUIZZES_CREATE: "quizzes.create",
  QUIZZES_UPDATE: "quizzes.update",
  QUIZZES_DELETE: "quizzes.delete",

  /** Course-final ResultEntry (Phase 1K) — distinct from assessment grades.* */
  RESULTS_READ: "results.read",
  RESULTS_CREATE: "results.create",
  RESULTS_UPDATE: "results.update",
  RESULTS_SUBMIT: "results.submit",
  RESULTS_APPROVE: "results.approve",
  RESULTS_RETURN: "results.return",

  ATTENDANCE_READ: "attendance.read",
  ATTENDANCE_MANAGE: "attendance.manage",
  /** Admin CRUD for department QR display locations (Phase A) */
  ATTENDANCE_LOCATIONS_MANAGE: "attendance.locations.manage",

  NOTIFICATIONS_READ: "notifications.read",
  NOTIFICATIONS_CREATE: "notifications.create",
  NOTIFICATIONS_MANAGE: "notifications.manage",

  ELECTIONS_READ: "elections.read",
  ELECTIONS_MANAGE: "elections.manage",
  ELECTIONS_VOTE: "elections.vote",
  ELECTIONS_RESULTS_READ: "elections.results.read",
  ELECTIONS_AUDIT_READ: "elections.audit.read",

  /** Finance & fees ledger (Phase 1L) */
  PAYMENTS_READ: "payments.read",
  PAYMENTS_PAY: "payments.pay",
  FINANCE_READ: "finance.read",
  FINANCE_MANAGE: "finance.manage",

  /** Online admissions (Phase 1M) */
  ADMISSIONS_READ: "admissions.read",
  ADMISSIONS_MANAGE: "admissions.manage",

  /** System settings + live dashboards (Phase 1N) */
  SETTINGS_READ: "settings.read",
  SETTINGS_MANAGE: "settings.manage",
  DASHBOARD_READ: "dashboard.read",

  /** Teacher evaluation / performance ratings */
  RATINGS_READ: "ratings.read",
  RATINGS_CREATE: "ratings.create",
  RATINGS_REPORT: "ratings.report",

  /** System-wide user account management */
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",

  /**
   * Public website CMS.
   * Authorize CMS + academic modules as ROLE + PERMISSION + DATA SCOPE.
   * DEPARTMENT_ADMIN uses UserDepartmentScope.departmentId (Phase 6).
   */
  CMS_SETTINGS_READ: "cms.settings.read",
  CMS_SETTINGS_MANAGE: "cms.settings.manage",
  CMS_PAGES_READ: "cms.pages.read",
  CMS_PAGES_MANAGE: "cms.pages.manage",
  CMS_NEWS_READ: "cms.news.read",
  CMS_NEWS_MANAGE: "cms.news.manage",
  CMS_EVENTS_READ: "cms.events.read",
  CMS_EVENTS_MANAGE: "cms.events.manage",
  CMS_MEDIA_READ: "cms.media.read",
  CMS_MEDIA_MANAGE: "cms.media.manage",
  CMS_NAV_READ: "cms.nav.read",
  CMS_NAV_MANAGE: "cms.nav.manage",
  CMS_FACULTIES_READ: "cms.faculties.read",
  CMS_FACULTIES_MANAGE: "cms.faculties.manage",
  CMS_PROGRAMS_READ: "cms.programs.read",
  CMS_PROGRAMS_MANAGE: "cms.programs.manage",
  CMS_PUBLISH: "cms.publish",

  /** Graduation certificates (Phase 6) */
  CERTIFICATES_READ: "certificates.read",
  CERTIFICATES_MANAGE: "certificates.manage",

  /** Exam Control / Admit Card (Step 1) */
  EXAMS_READ: "exams.read",
  EXAMS_MANAGE: "exams.manage",
  ADMITCARDS_GENERATE: "admitcards.generate",
  RESULTS_VERIFY: "results.verify",
  RESULTS_PUBLISH: "results.publish",
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

const ADMIN_PERMISSIONS: PermissionName[] = [
  Permission.PORTAL_ADMIN,
  Permission.STUDENTS_READ,
  Permission.STUDENTS_CREATE,
  Permission.STUDENTS_UPDATE,
  Permission.STUDENTS_DELETE,
  Permission.TEACHERS_READ,
  Permission.TEACHERS_CREATE,
  Permission.TEACHERS_UPDATE,
  Permission.TEACHERS_DELETE,
  Permission.FACULTIES_READ,
  Permission.FACULTIES_CREATE,
  Permission.FACULTIES_UPDATE,
  Permission.FACULTIES_DELETE,
  Permission.DEPARTMENTS_READ,
  Permission.DEPARTMENTS_CREATE,
  Permission.DEPARTMENTS_UPDATE,
  Permission.DEPARTMENTS_DELETE,
  Permission.COURSES_READ,
  Permission.COURSES_CREATE,
  Permission.COURSES_UPDATE,
  Permission.COURSES_DELETE,
  Permission.TEACHER_COURSES_READ,
  Permission.TEACHER_COURSES_ASSIGN,
  Permission.TEACHER_COURSES_REMOVE,
  Permission.CLASSES_READ,
  Permission.CLASSES_CREATE,
  Permission.CLASSES_UPDATE,
  Permission.CLASSES_DELETE,
  Permission.ENROLLMENTS_READ,
  Permission.ENROLLMENTS_CREATE,
  Permission.ENROLLMENTS_UPDATE,
  Permission.ENROLLMENTS_DELETE,
  Permission.ASSIGNMENTS_READ,
  Permission.SUBMISSIONS_READ,
  Permission.GRADES_READ,
  Permission.GRADES_APPROVE,
  Permission.GRADES_RETURN,
  Permission.QUIZZES_READ,
  Permission.RESULTS_READ,
  Permission.RESULTS_CREATE,
  Permission.RESULTS_UPDATE,
  Permission.RESULTS_SUBMIT,
  Permission.RESULTS_APPROVE,
  Permission.RESULTS_RETURN,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_MANAGE,
  Permission.ATTENDANCE_LOCATIONS_MANAGE,
  Permission.NOTIFICATIONS_READ,
  Permission.NOTIFICATIONS_CREATE,
  Permission.NOTIFICATIONS_MANAGE,
  Permission.ELECTIONS_READ,
  Permission.ELECTIONS_MANAGE,
  Permission.ELECTIONS_RESULTS_READ,
  Permission.ELECTIONS_AUDIT_READ,
  Permission.PAYMENTS_READ,
  Permission.FINANCE_READ,
  Permission.FINANCE_MANAGE,
  Permission.ADMISSIONS_READ,
  Permission.ADMISSIONS_MANAGE,
  Permission.SETTINGS_READ,
  Permission.SETTINGS_MANAGE,
  Permission.DASHBOARD_READ,
  Permission.RATINGS_READ,
  Permission.RATINGS_REPORT,
  Permission.USERS_READ,
  Permission.USERS_MANAGE,
  Permission.CMS_SETTINGS_READ,
  Permission.CMS_SETTINGS_MANAGE,
  Permission.CMS_PAGES_READ,
  Permission.CMS_PAGES_MANAGE,
  Permission.CMS_NEWS_READ,
  Permission.CMS_NEWS_MANAGE,
  Permission.CMS_EVENTS_READ,
  Permission.CMS_EVENTS_MANAGE,
  Permission.CMS_MEDIA_READ,
  Permission.CMS_MEDIA_MANAGE,
  Permission.CMS_NAV_READ,
  Permission.CMS_NAV_MANAGE,
  Permission.CMS_FACULTIES_READ,
  Permission.CMS_FACULTIES_MANAGE,
  Permission.CMS_PROGRAMS_READ,
  Permission.CMS_PROGRAMS_MANAGE,
  Permission.CMS_PUBLISH,
  Permission.CERTIFICATES_READ,
  Permission.CERTIFICATES_MANAGE,
  Permission.EXAMS_READ,
  Permission.EXAMS_MANAGE,
  Permission.ADMITCARDS_GENERATE,
  Permission.RESULTS_VERIFY,
  Permission.RESULTS_PUBLISH,
];

/** Department Admin — academic scope only; finance/settings/users/CMS blocked */
const DEPARTMENT_ADMIN_PERMISSIONS: PermissionName[] = [
  Permission.PORTAL_ADMIN,
  Permission.DASHBOARD_READ,
  Permission.STUDENTS_READ,
  Permission.STUDENTS_UPDATE,
  Permission.TEACHERS_READ,
  Permission.DEPARTMENTS_READ,
  Permission.COURSES_READ,
  Permission.CLASSES_READ,
  Permission.ENROLLMENTS_READ,
  Permission.NOTIFICATIONS_READ,
  Permission.NOTIFICATIONS_CREATE,
  Permission.ATTENDANCE_READ,
  Permission.GRADES_READ,
  Permission.RESULTS_READ,
  Permission.CERTIFICATES_READ,
  Permission.CERTIFICATES_MANAGE,
];

const TEACHER_PERMISSIONS: PermissionName[] = [
  Permission.PORTAL_TEACHER,
  Permission.DASHBOARD_READ,
  Permission.COURSES_READ,
  Permission.ASSIGNMENTS_CREATE,
  Permission.ASSIGNMENTS_UPDATE,
  Permission.ASSIGNMENTS_DELETE,
  Permission.SUBMISSIONS_READ,
  Permission.GRADES_READ,
  Permission.GRADES_UPDATE,
  Permission.GRADES_SUBMIT,
  Permission.QUIZZES_READ,
  Permission.QUIZZES_CREATE,
  Permission.QUIZZES_UPDATE,
  Permission.QUIZZES_DELETE,
  Permission.RESULTS_READ,
  Permission.RESULTS_CREATE,
  Permission.RESULTS_UPDATE,
  Permission.RESULTS_SUBMIT,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_MANAGE,
  Permission.NOTIFICATIONS_READ,
  Permission.RATINGS_READ,
  // Class-scoped students.read arrives in a later phase — not global list
  // Assignment list/create via /assignments/me + TEACHER role (ownership enforced)
];

const STUDENT_PERMISSIONS: PermissionName[] = [
  Permission.PORTAL_STUDENT,
  Permission.DASHBOARD_READ,
  Permission.COURSES_READ,
  Permission.SUBMISSIONS_CREATE,
  Permission.SUBMISSIONS_UPDATE,
  Permission.RESULTS_READ,
  Permission.ATTENDANCE_READ,
  Permission.NOTIFICATIONS_READ,
  Permission.ELECTIONS_READ,
  Permission.ELECTIONS_VOTE,
  Permission.ELECTIONS_RESULTS_READ,
  Permission.PAYMENTS_READ,
  Permission.PAYMENTS_PAY,
  Permission.RATINGS_READ,
  Permission.RATINGS_CREATE,
];

/**
 * Exam Control Admin — exams, clearance, results verify/publish only.
 * Explicitly excludes finance, global settings, and CMS.
 */
const EXAM_ADMIN_PERMISSIONS: PermissionName[] = [
  Permission.PORTAL_ADMIN,
  Permission.DASHBOARD_READ,
  Permission.STUDENTS_READ,
  Permission.COURSES_READ,
  Permission.CLASSES_READ,
  Permission.ENROLLMENTS_READ,
  Permission.ATTENDANCE_READ,
  Permission.GRADES_READ,
  Permission.RESULTS_READ,
  Permission.RESULTS_APPROVE,
  Permission.RESULTS_VERIFY,
  Permission.RESULTS_PUBLISH,
  Permission.EXAMS_READ,
  Permission.EXAMS_MANAGE,
  Permission.ADMITCARDS_GENERATE,
  Permission.NOTIFICATIONS_READ,
];

/**
 * Certificate Admin — certificates issue/revoke/verify only.
 * Explicitly excludes finance, global settings, and CMS.
 */
const CERTIFICATE_ADMIN_PERMISSIONS: PermissionName[] = [
  Permission.PORTAL_ADMIN,
  Permission.DASHBOARD_READ,
  Permission.STUDENTS_READ,
  Permission.CERTIFICATES_READ,
  Permission.CERTIFICATES_MANAGE,
  Permission.NOTIFICATIONS_READ,
];

export const ROLE_PERMISSIONS: Record<Role, readonly PermissionName[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  DEPARTMENT_ADMIN: DEPARTMENT_ADMIN_PERMISSIONS,
  EXAM_ADMIN: EXAM_ADMIN_PERMISSIONS,
  CERTIFICATE_ADMIN: CERTIFICATE_ADMIN_PERMISSIONS,
  TEACHER: TEACHER_PERMISSIONS,
  STUDENT: STUDENT_PERMISSIONS,
};

/** Future roles can be registered here without rewriting middleware */
export function permissionsForRole(role: Role): readonly PermissionName[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: PermissionName): boolean {
  return permissionsForRole(role).includes(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: PermissionName[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
