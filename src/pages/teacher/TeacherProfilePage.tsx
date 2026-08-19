import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  EditableProfileField,
  ReadOnlyProfileField,
} from "@/components/portals/ProfileFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useOptionalAvatar } from "@/context/AvatarContext";

function str(value: unknown, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

export function TeacherProfilePage() {
  const { user } = useAuth();
  const avatar = useOptionalAvatar();
  const profile = (user?.profile ?? {}) as Record<string, unknown>;

  const fullName = str(profile.fullName, user?.email || "Dhapti Faculty");
  const facultyCode = str(profile.facultyCode, "—");
  const department =
    typeof profile.department === "object" && profile.department
      ? str((profile.department as { name?: string }).name, "—")
      : str(profile.departmentName || profile.facultyName, "Academic Affairs");
  const designation = str(profile.designation, "Lecturer");
  const phoneInitial = str(profile.phone, "");
  const officeInitial = str(profile.officeLocation || profile.address, "");

  const [phone, setPhone] = useState(phoneInitial === "—" ? "" : phoneInitial);
  const [office, setOffice] = useState(
    officeInitial === "—" ? "" : officeInitial
  );
  const [saved, setSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const photoUrl = useMemo(
    () =>
      avatar?.avatarUrl ||
      (typeof profile.profilePhoto === "string" && profile.profilePhoto) ||
      "/images/profile-user.jpg",
    [avatar?.avatarUrl, profile.profilePhoto]
  );

  function saveContact(e: FormEvent) {
    e.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function handlePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordSaved(true);
    toast.message(
      "Password change API is not enabled yet — request recorded locally."
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#002147] md:text-2xl dark:text-slate-100">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Faculty campus record. Academic identity fields are read-only.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-[#16a34a]/25 bg-[#16a34a]/10 px-4 py-2.5 text-sm font-medium text-[#16a34a]">
          <CheckCircle2 className="h-4 w-4" />
          Contact details saved locally.
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="general">General Info</TabsTrigger>
          <TabsTrigger value="password">Change Password</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="border-b border-[#E5EBF3] pb-3 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#E5EBF3] shadow-md ring-2 ring-[#F68F3A]/35">
                  <img
                    src={photoUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#002147] dark:text-slate-100">
                    {fullName}
                  </h2>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {designation}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="info">{facultyCode}</Badge>
                    <Badge variant="secondary">{department}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <form onSubmit={saveContact} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadOnlyProfileField label="Full Name" value={fullName} />
                  <ReadOnlyProfileField
                    label="Email"
                    value={user?.email ?? "—"}
                  />
                  <ReadOnlyProfileField
                    label="Faculty Code"
                    value={facultyCode}
                  />
                  <ReadOnlyProfileField label="Department" value={department} />
                  <ReadOnlyProfileField
                    label="Designation"
                    value={designation}
                  />
                  <ReadOnlyProfileField
                    label="Status"
                    value={str(user?.status, "ACTIVE")}
                  />
                  <EditableProfileField
                    label="Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                  <EditableProfileField
                    label="Office / Address"
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    placeholder="Enter office location"
                    className="sm:col-span-2"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                >
                  Save contact details
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-4">
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="border-b border-[#E5EBF3] py-3">
              <h3 className="text-sm font-bold text-[#002147] dark:text-slate-100">
                Change Password
              </h3>
              <p className="text-xs text-muted-foreground">
                Password change API is not enabled yet. This form remains a
                local demo.
              </p>
            </CardHeader>
            <CardContent className="p-4">
              <form
                onSubmit={handlePassword}
                className="mx-auto max-w-md space-y-3"
              >
                <EditableProfileField
                  label="Current Password"
                  type="password"
                  required
                />
                <EditableProfileField
                  label="New Password"
                  type="password"
                  required
                  minLength={8}
                />
                <EditableProfileField
                  label="Confirm New Password"
                  type="password"
                  required
                  minLength={8}
                />
                {passwordSaved && (
                  <div className="flex items-center gap-2 text-sm font-medium text-[#16a34a]">
                    <CheckCircle2 className="h-4 w-4" />
                    Password updated successfully (demo).
                  </div>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                >
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
