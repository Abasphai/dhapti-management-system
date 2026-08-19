import { DigitalIdCard } from "@/components/common/DigitalIdCard";
import { useAuth } from "@/context/AuthContext";
import { useOptionalAvatar } from "@/context/AvatarContext";

export function TeacherIdCardPage() {
  const { user } = useAuth();
  const avatar = useOptionalAvatar();
  const profile = user?.profile ?? {};

  const fullName = String(profile.fullName || user?.email || "Dhapti Faculty");
  const registrationId = String(
    profile.facultyCode || user?.id?.slice(0, 10) || "FAC-0000"
  );
  const department = String(
    profile.departmentName || profile.facultyName || "Academic Affairs"
  );
  const academicYear = String(profile.academicYear || "2025/2026");
  const photoUrl =
    avatar?.avatarUrl ||
    (typeof profile.profilePhoto === "string" && profile.profilePhoto) ||
    "/images/profile-user.jpg";

  return (
    <DigitalIdCard
      role="TEACHER"
      fullName={fullName}
      registrationId={registrationId}
      facultyOrDepartment={department}
      academicYear={academicYear}
      photoUrl={photoUrl}
      email={user?.email}
    />
  );
}
