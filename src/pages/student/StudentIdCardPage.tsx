import { DigitalIdCard } from "@/components/common/DigitalIdCard";
import { useAuth } from "@/context/AuthContext";
import { useOptionalAvatar } from "@/context/AvatarContext";

export function StudentIdCardPage() {
  const { user } = useAuth();
  const avatar = useOptionalAvatar();
  const profile = user?.profile ?? {};

  const fullName = String(profile.fullName || user?.email || "Dhapti Student");
  const registrationId = String(
    profile.studentCode || user?.id?.slice(0, 10) || "STU-0000"
  );
  const faculty = String(
    profile.facultyName ||
      profile.departmentName ||
      profile.programTitle ||
      "Faculty of Computing"
  );
  const academicYear = String(profile.academicYear || "2025/2026");
  const photoUrl =
    avatar?.avatarUrl ||
    (typeof profile.profilePhoto === "string" && profile.profilePhoto) ||
    "/images/profile-user.jpg";

  return (
    <DigitalIdCard
      role="STUDENT"
      fullName={fullName}
      registrationId={registrationId}
      facultyOrDepartment={faculty}
      academicYear={academicYear}
      photoUrl={photoUrl}
      email={user?.email}
    />
  );
}
