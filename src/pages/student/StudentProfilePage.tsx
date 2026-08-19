import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  EditableProfileField,
  ProfileInfoText,
  ReadOnlyProfileField,
} from "@/components/portals/ProfileFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useAvatar } from "@/context/AvatarContext";
import { api, ApiError } from "@/lib/api";

interface StudentProfile {
  id: string;
  studentCode: string;
  name: string;
  fullName: string;
  motherName: string | null;
  email: string;
  phone: string;
  address: string | null;
  bloodGroup: string | null;
  profilePhoto: string | null;
  semester: string;
  program: string;
  batch: string | null;
  faculty: string;
  department: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  status: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export function StudentProfilePage() {
  const [searchParams] = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "password" ? "password" : "general";
  const { refreshMe } = useAuth();
  const { avatarUrl, setAvatarUrl } = useAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = window.setTimeout(() => setShowSuccess(false), 2800);
    return () => window.clearTimeout(timer);
  }, [showSuccess]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<StudentProfile>("/students/me")
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
        if (data.profilePhoto) setAvatarUrl(data.profilePhoto);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load profile"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setAvatarUrl]);

  const handlePassword = (e: FormEvent) => {
    e.preventDefault();
    setPasswordSaved(true);
    toast.message(
      "Password change API is not enabled yet — request recorded locally."
    );
  };

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api<StudentProfile>("/students/me", {
        method: "PATCH",
        body: JSON.stringify({
          phone: phone.trim(),
          address: address.trim(),
        }),
      });
      setProfile(updated);
      setPhone(updated.phone ?? "");
      setAddress(updated.address ?? "");
      await refreshMe();
      setSuccessMessage("Contact details saved.");
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1024 * 1024) {
      setError("Profile photo must be 1MB or smaller.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const updated = await api<StudentProfile>("/students/me", {
        method: "PATCH",
        body: JSON.stringify({ profilePhoto: dataUrl }),
      });
      setProfile(updated);
      if (updated.profilePhoto) setAvatarUrl(updated.profilePhoto);
      await refreshMe();
      setSuccessMessage(
        "Profile photo updated successfully. Topbar and sidebar avatars refreshed."
      );
      setShowSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to update photo"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const displayName = profile?.fullName || profile?.name || "Student";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#002147] md:text-2xl dark:text-slate-100">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal campus records. Only phone, address, and photo are editable.
        </p>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-xl border border-[#16a34a]/25 bg-[#16a34a]/10 px-4 py-2.5 text-sm font-medium text-[#16a34a] shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <Card className="border-red-200">
          <CardContent className="p-3 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <Card className="border-[#E5EBF3]">
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading profile…
          </CardContent>
        </Card>
      )}

      {!loading && profile && (
        <Tabs defaultValue={initialTab} key={initialTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="general">General Info</TabsTrigger>
            <TabsTrigger value="parents">Parents Info</TabsTrigger>
            <TabsTrigger value="emergency">Emergency Info</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <Card className="border-[#E5EBF3] shadow-sm">
              <CardHeader className="border-b border-[#E5EBF3] pb-3 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative h-20 w-20 shrink-0">
                    <div className="h-full w-full overflow-hidden rounded-full border-4 border-white bg-[#E5EBF3] shadow-md ring-2 ring-[#F68F3A]/35">
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full rounded-full object-cover object-center"
                      />
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#002147]/45">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleImageChange(e)}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || saving}
                      title="Change profile photo"
                      aria-label="Change profile photo"
                      className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#002147] text-white shadow-lg transition-all hover:scale-110 hover:bg-[#16a34a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F68F3A] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#002147] dark:text-slate-100">
                      {displayName}
                    </h2>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {profile.program || "—"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="info">{profile.studentCode}</Badge>
                      {profile.batch && (
                        <Badge variant="warning">{profile.batch}</Badge>
                      )}
                      <Badge
                        variant={
                          profile.status === "Active" ? "success" : "secondary"
                        }
                      >
                        {profile.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Click the camera icon to upload a photo (max 1MB). Name,
                      email, and academic IDs are admin-managed.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-5">
                <form
                  onSubmit={(e) => void saveContact(e)}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ReadOnlyProfileField label="Full Name" value={displayName} />
                    <ReadOnlyProfileField
                      label="Mother's Name"
                      value={profile.motherName ?? ""}
                    />
                    <ReadOnlyProfileField label="Email" value={profile.email} />
                    <ReadOnlyProfileField
                      label="Blood Group"
                      value={profile.bloodGroup ?? ""}
                    />
                    <ReadOnlyProfileField
                      label="Registration Code"
                      value={profile.studentCode}
                    />
                    <ReadOnlyProfileField label="Roll Number" value="—" />
                    <ReadOnlyProfileField label="Faculty" value={profile.faculty} />
                    <ReadOnlyProfileField
                      label="Department"
                      value={profile.department ?? ""}
                    />
                    <ReadOnlyProfileField label="Program" value={profile.program} />
                    <ReadOnlyProfileField label="Semester" value={profile.semester} />
                    <EditableProfileField
                      label="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                    />
                    <EditableProfileField
                      label="Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter address"
                      className="sm:col-span-2 lg:col-span-3"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={saving}
                    size="sm"
                    className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                  >
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save contact details
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parents" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-[#E5EBF3] shadow-sm">
                <CardHeader className="border-b border-[#E5EBF3] py-3">
                  <h3 className="text-sm font-bold text-[#002147] dark:text-slate-100">
                    Father&apos;s Information
                  </h3>
                </CardHeader>
                <CardContent className="grid gap-3 p-4">
                  <ProfileInfoText label="Father's Name" value="—" />
                  <ProfileInfoText label="Cell Number" value="—" />
                  <p className="text-xs text-muted-foreground">
                    Parent contact fields are not yet stored in the academic
                    profile API.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-[#E5EBF3] shadow-sm">
                <CardHeader className="border-b border-[#E5EBF3] py-3">
                  <h3 className="text-sm font-bold text-[#002147] dark:text-slate-100">
                    Mother&apos;s Information
                  </h3>
                </CardHeader>
                <CardContent className="grid gap-3 p-4">
                  <ProfileInfoText
                    label="Mother's Name"
                    value={profile.motherName ?? "—"}
                  />
                  <ProfileInfoText label="Cell Number" value="—" />
                  <p className="text-xs text-muted-foreground">
                    Mother&apos;s name is admin-managed and read-only here.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="emergency" className="mt-4">
            <Card className="border-[#E5EBF3] shadow-sm">
              <CardHeader className="border-b border-[#E5EBF3] py-3">
                <h3 className="text-sm font-bold text-[#002147] dark:text-slate-100">
                  Emergency Contact
                </h3>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                <ProfileInfoText label="Contact Person" value="—" />
                <ProfileInfoText label="Relation" value="—" />
                <ProfileInfoText label="Cell Number" value="—" />
                <ProfileInfoText
                  label="Registered Address"
                  value={profile.address ?? "—"}
                />
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  Dedicated emergency-contact records are not available in the
                  current API. Editable address is managed under General Info.
                </p>
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
      )}
    </div>
  );
}
