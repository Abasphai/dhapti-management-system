/** Map API student row to admin UI–friendly shape (no passwordHash). */
export function serializeStudent(student: {
  id: string;
  studentCode: string;
  fullName: string;
  motherName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  bloodGroup: string | null;
  profilePhoto: string | null;
  semester: string | null;
  program: string | null;
  batch: string | null;
  faculty: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  user: { status: string; email: string };
}) {
  const status =
    student.user.status === "ACTIVE"
      ? "Active"
      : student.user.status === "SUSPENDED"
        ? "Suspended"
        : student.user.status === "GRADUATED"
          ? "Graduated"
          : "Inactive";

  return {
    id: student.id,
    studentCode: student.studentCode,
    name: student.fullName,
    fullName: student.fullName,
    motherName: student.motherName,
    email: student.email,
    phone: student.phone ?? "",
    address: student.address,
    bloodGroup: student.bloodGroup,
    profilePhoto: student.profilePhoto,
    semester: student.semester ?? "",
    program: student.program ?? "",
    batch: student.batch,
    faculty: student.faculty?.name ?? student.program ?? "—",
    facultyId: student.faculty?.id ?? null,
    department: student.department?.name ?? null,
    departmentId: student.department?.id ?? null,
    status,
    accountStatus: student.user.status,
  };
}

export function serializeTeacher(teacher: {
  id: string;
  facultyCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  bio: string | null;
  designation: string | null;
  profilePhoto: string | null;
  department: { id: string; name: string; code: string } | null;
  courseTeachers: {
    course: { id: string; title: string; code: string };
  }[];
  user: { status: string; email: string };
  ratings?: { overallRating?: number; stars?: number }[];
}) {
  const status =
    teacher.user.status === "ACTIVE"
      ? "Active"
      : teacher.user.status === "SUSPENDED"
        ? "Suspended"
        : teacher.user.status === "GRADUATED"
          ? "Graduated"
          : "Inactive";

  const ratings = teacher.ratings ?? [];
  const averageRating =
    ratings.length === 0
      ? null
      : ratings.reduce(
          (s, r) => s + (r.overallRating ?? r.stars ?? 0),
          0
        ) / ratings.length;

  return {
    id: teacher.id,
    facultyCode: teacher.facultyCode,
    name: teacher.fullName,
    fullName: teacher.fullName,
    email: teacher.email,
    phone: teacher.phone ?? "",
    bio: teacher.bio,
    designation: teacher.designation ?? "",
    profilePhoto: teacher.profilePhoto,
    department: teacher.department?.name ?? "Unassigned",
    departmentId: teacher.department?.id ?? null,
    assignedCourses: teacher.courseTeachers.map((ct) => ct.course.title),
    assignedCourseIds: teacher.courseTeachers.map((ct) => ct.course.id),
    assignedCourseDetails: teacher.courseTeachers.map((ct) => ({
      id: ct.course.id,
      code: ct.course.code,
      title: ct.course.title,
      name: ct.course.title,
    })),
    averageRating,
    status,
    accountStatus: teacher.user.status,
  };
}
