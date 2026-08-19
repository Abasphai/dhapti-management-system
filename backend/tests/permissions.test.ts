import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Permission,
  hasPermission,
  permissionsForRole,
} from "../src/lib/permissions.js";

describe("RBAC permissions catalog", () => {
  it("grants ADMIN portal and students.read", () => {
    assert.equal(hasPermission("ADMIN", Permission.PORTAL_ADMIN), true);
    assert.equal(hasPermission("ADMIN", Permission.STUDENTS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.TEACHERS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.FACULTIES_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.DEPARTMENTS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.COURSES_CREATE), true);
    assert.equal(hasPermission("ADMIN", Permission.TEACHER_COURSES_ASSIGN), true);
    assert.equal(hasPermission("ADMIN", Permission.CLASSES_CREATE), true);
    assert.equal(hasPermission("ADMIN", Permission.ENROLLMENTS_CREATE), true);
    assert.equal(hasPermission("ADMIN", Permission.ENROLLMENTS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.ASSIGNMENTS_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.GRADES_READ), true);
    assert.equal(hasPermission("ADMIN", Permission.GRADES_APPROVE), true);
    assert.equal(hasPermission("ADMIN", Permission.GRADES_RETURN), true);
    assert.equal(hasPermission("ADMIN", Permission.CMS_PAGES_MANAGE), true);
    assert.equal(hasPermission("ADMIN", Permission.CMS_PUBLISH), true);
  });

  it("denies STUDENT admin portal and students.read", () => {
    assert.equal(hasPermission("STUDENT", Permission.PORTAL_ADMIN), false);
    assert.equal(hasPermission("STUDENT", Permission.STUDENTS_READ), false);
    assert.equal(hasPermission("STUDENT", Permission.FACULTIES_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.DEPARTMENTS_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.COURSES_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.TEACHER_COURSES_ASSIGN), false);
    assert.equal(hasPermission("STUDENT", Permission.CLASSES_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.ENROLLMENTS_READ), false);
    assert.equal(hasPermission("STUDENT", Permission.ENROLLMENTS_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.ASSIGNMENTS_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.PORTAL_STUDENT), true);
    assert.equal(hasPermission("STUDENT", Permission.ELECTIONS_VOTE), true);
  });

  it("denies TEACHER global students.read (Phase 1A)", () => {
    assert.equal(hasPermission("TEACHER", Permission.STUDENTS_READ), false);
    assert.equal(hasPermission("TEACHER", Permission.FACULTIES_CREATE), false);
    assert.equal(hasPermission("TEACHER", Permission.DEPARTMENTS_CREATE), false);
    assert.equal(hasPermission("TEACHER", Permission.COURSES_CREATE), false);
    assert.equal(hasPermission("TEACHER", Permission.TEACHER_COURSES_ASSIGN), false);
    assert.equal(hasPermission("TEACHER", Permission.TEACHER_COURSES_REMOVE), false);
    assert.equal(hasPermission("TEACHER", Permission.CLASSES_CREATE), false);
    assert.equal(hasPermission("TEACHER", Permission.CLASSES_READ), false);
    assert.equal(hasPermission("TEACHER", Permission.ENROLLMENTS_READ), false);
    assert.equal(hasPermission("TEACHER", Permission.ENROLLMENTS_CREATE), false);
    assert.equal(hasPermission("TEACHER", Permission.ASSIGNMENTS_CREATE), true);
    assert.equal(hasPermission("TEACHER", Permission.ASSIGNMENTS_READ), false);
    assert.equal(hasPermission("TEACHER", Permission.GRADES_UPDATE), true);
    assert.equal(hasPermission("TEACHER", Permission.GRADES_SUBMIT), true);
    assert.equal(hasPermission("TEACHER", Permission.GRADES_APPROVE), false);
    assert.equal(hasPermission("TEACHER", Permission.QUIZZES_CREATE), true);
    assert.equal(hasPermission("TEACHER", Permission.QUIZZES_UPDATE), true);
    assert.equal(hasPermission("ADMIN", Permission.QUIZZES_READ), true);
    assert.equal(hasPermission("TEACHER", Permission.PORTAL_TEACHER), true);
    assert.equal(hasPermission("TEACHER", Permission.ATTENDANCE_MANAGE), true);
    assert.equal(hasPermission("ADMIN", Permission.NOTIFICATIONS_CREATE), true);
    assert.equal(hasPermission("TEACHER", Permission.NOTIFICATIONS_READ), true);
    assert.equal(hasPermission("TEACHER", Permission.NOTIFICATIONS_CREATE), false);
    assert.equal(hasPermission("STUDENT", Permission.NOTIFICATIONS_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.NOTIFICATIONS_CREATE), false);
    assert.equal(hasPermission("ADMIN", Permission.ELECTIONS_MANAGE), true);
    assert.equal(hasPermission("ADMIN", Permission.ELECTIONS_AUDIT_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.ELECTIONS_VOTE), true);
    assert.equal(hasPermission("TEACHER", Permission.ELECTIONS_MANAGE), false);
    assert.equal(hasPermission("TEACHER", Permission.ELECTIONS_VOTE), false);
  });

  it("returns stable permission lists per role", () => {
    assert.ok(permissionsForRole("ADMIN").length > permissionsForRole("STUDENT").length);
    assert.ok(
      permissionsForRole("ADMIN").length >
        permissionsForRole("DEPARTMENT_ADMIN").length
    );
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.FINANCE_READ), false);
    assert.equal(hasPermission("DEPARTMENT_ADMIN", Permission.PORTAL_ADMIN), true);
  });
});
