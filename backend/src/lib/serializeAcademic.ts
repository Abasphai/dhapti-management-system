import type { AcademicStatus } from "@prisma/client";

function uiStatus(status: AcademicStatus): "Active" | "Inactive" | "Suspended" {
  if (status === "ACTIVE") return "Active";
  if (status === "SUSPENDED") return "Suspended";
  return "Inactive";
}

export function serializeFaculty(faculty: {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: AcademicStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: { departments: number; students: number; courses: number };
}) {
  return {
    id: faculty.id,
    name: faculty.name,
    code: faculty.code,
    description: faculty.description,
    status: uiStatus(faculty.status),
    accountStatus: faculty.status,
    createdAt: faculty.createdAt.toISOString(),
    updatedAt: faculty.updatedAt.toISOString(),
    departmentCount: faculty._count?.departments ?? 0,
    studentCount: faculty._count?.students ?? 0,
    courseCount: faculty._count?.courses ?? 0,
  };
}

export function serializeDepartment(department: {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  status: AcademicStatus;
  createdAt: Date;
  updatedAt: Date;
  faculty?: { id: string; name: string; code: string } | null;
  _count?: { courses: number; students: number; teachers: number };
}) {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    facultyId: department.facultyId,
    faculty: department.faculty?.name ?? null,
    facultyCode: department.faculty?.code ?? null,
    status: uiStatus(department.status),
    accountStatus: department.status,
    createdAt: department.createdAt.toISOString(),
    updatedAt: department.updatedAt.toISOString(),
    courseCount: department._count?.courses ?? 0,
    studentCount: department._count?.students ?? 0,
    teacherCount: department._count?.teachers ?? 0,
  };
}

export function serializeCourse(course: {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string | null;
  facultyId: string | null;
  departmentId: string;
  status: AcademicStatus;
  createdAt: Date;
  updatedAt: Date;
  faculty?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string; code: string; facultyId: string } | null;
}) {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    name: course.title,
    credits: course.credits,
    semester: course.semester,
    facultyId: course.facultyId ?? course.department?.facultyId ?? null,
    departmentId: course.departmentId,
    faculty: course.faculty?.name ?? null,
    facultyCode: course.faculty?.code ?? null,
    department: course.department?.name ?? null,
    departmentCode: course.department?.code ?? null,
    status: uiStatus(course.status),
    accountStatus: course.status,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}
