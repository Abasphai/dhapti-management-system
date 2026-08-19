import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SystemSettings = {
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
  requireAdminGradeApproval: boolean;
  minAttendanceThreshold: number;
  passingGradeCutoff: number;
  maxUploadFileMb: number;
  defaultTuitionFee: number;
  admissionApplicationFee: number;
  paymentCurrency: "USD" | "SOS";
  paymentGracePeriodDays: number;
  sendStudentWelcomeEmail: boolean;
  sendLowAttendanceWarning: boolean;
  sendGradeApprovalAlert: boolean;
  facultyAttendanceGraceMinutes: number;
  facultyQrTokenTtlSeconds: number;
  facultyRequiredClassMinutesFallback: number;
  allowManualFacultyAttendance: boolean;
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  user: string;
  role: string;
  ip: string;
};

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div>
        <p className="font-semibold text-[#002147] dark:text-slate-100">
          {label}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          enabled ? "bg-[#ea580c]" : "bg-zinc-300 dark:bg-zinc-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            enabled ? "left-5" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
        {label}
      </label>
      <div className="relative">
        <Input
          type="number"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rounded-xl border-[#E5EBF3] pr-14"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SystemSettings>("/admin/settings");
      setSettings(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api<{ data: AuditRow[] }>(
        "/admin/settings/audit-logs?page=1&pageSize=25"
      );
      setAuditRows(res.data);
    } catch {
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAuditLogs();
  }, [load, loadAuditLogs]);

  const save = async (patch: Partial<SystemSettings>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<SystemSettings>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSettings(updated);
      toast.success("Settings updated successfully!");
      void loadAuditLogs();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const downloadBackup = async () => {
    setBackupBusy(true);
    try {
      const token = localStorage.getItem("dhapti-auth-token");
      const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
      const res = await fetch(`${base}/admin/settings/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error("Backup export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhapti-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("System backup downloaded.");
      void loadAuditLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBackupBusy(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="System Settings"
          description="Configure university policies, finance, notifications, and security."
        />
        <p className="text-sm text-muted-foreground">
          {error ?? "Loading settings…"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="System Settings"
        description="Code-free control over academics, finance, notifications, and backups."
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="portal-rules">Portal Rules</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="academic">Academic Rules</TabsTrigger>
          <TabsTrigger value="financial">Financial Rules</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Data & Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                University Information
              </CardTitle>
              <CardDescription>
                Update core university identity and campus contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                  University Name
                </label>
                <Input
                  value={settings.universityName}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, universityName: e.target.value } : s
                    )
                  }
                  className="rounded-xl border-[#E5EBF3]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                  Campus Address
                </label>
                <Input
                  value={settings.campusAddress}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, campusAddress: e.target.value } : s
                    )
                  }
                  className="rounded-xl border-[#E5EBF3]"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, contactEmail: e.target.value } : s
                      )
                    }
                    className="rounded-xl border-[#E5EBF3]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                    Contact Phone
                  </label>
                  <Input
                    value={settings.contactPhone}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, contactPhone: e.target.value } : s
                      )
                    }
                    className="rounded-xl border-[#E5EBF3]"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                    Academic Year
                  </label>
                  <Input
                    value={settings.currentAcademicYear}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, currentAcademicYear: e.target.value } : s
                      )
                    }
                    className="rounded-xl border-[#E5EBF3]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                    Current Semester
                  </label>
                  <Input
                    value={settings.currentSemester}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, currentSemester: e.target.value } : s
                      )
                    }
                    className="rounded-xl border-[#E5EBF3]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#002147] hover:bg-[#003366]"
                  disabled={busy}
                  onClick={() =>
                    void save({
                      universityName: settings.universityName,
                      campusAddress: settings.campusAddress,
                      contactEmail: settings.contactEmail,
                      contactPhone: settings.contactPhone,
                      currentAcademicYear: settings.currentAcademicYear,
                      currentSemester: settings.currentSemester,
                    })
                  }
                >
                  Save General Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal-rules">
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Portal Rules
              </CardTitle>
              <CardDescription>
                Control registration windows and portal availability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                enabled={settings.registrationOpen}
                onChange={(v) =>
                  setSettings((s) => (s ? { ...s, registrationOpen: v } : s))
                }
                label="Online Registration"
                description="Open or close online course and semester registration."
              />
              <Toggle
                enabled={settings.isAdmissionsOpen}
                onChange={(v) =>
                  setSettings((s) => (s ? { ...s, isAdmissionsOpen: v } : s))
                }
                label="Public Admissions Applications"
                description="Allow prospective students to submit applications online."
              />
              <Toggle
                enabled={settings.studentPortalEnabled}
                onChange={(v) =>
                  setSettings((s) =>
                    s ? { ...s, studentPortalEnabled: v } : s
                  )
                }
                label="Student Portal Access"
                description="Allow enrolled students to sign in."
              />
              <Toggle
                enabled={settings.teacherPortalEnabled}
                onChange={(v) =>
                  setSettings((s) =>
                    s ? { ...s, teacherPortalEnabled: v } : s
                  )
                }
                label="Teacher Portal Access"
                description="Allow faculty to manage classes and grades."
              />
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#ea580c] hover:bg-[#c2410c]"
                  disabled={busy}
                  onClick={() =>
                    void save({
                      registrationOpen: settings.registrationOpen,
                      isAdmissionsOpen: settings.isAdmissionsOpen,
                      studentPortalEnabled: settings.studentPortalEnabled,
                      teacherPortalEnabled: settings.teacherPortalEnabled,
                    })
                  }
                >
                  Save Portal Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                    Maintenance
                  </CardTitle>
                  <CardDescription>
                    Platform availability controls for system updates.
                  </CardDescription>
                </div>
                <Badge variant={settings.maintenanceMode ? "warning" : "success"}>
                  {settings.maintenanceMode
                    ? "Maintenance Active"
                    : "System Online"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                enabled={settings.maintenanceMode}
                onChange={(v) =>
                  setSettings((s) => (s ? { ...s, maintenanceMode: v } : s))
                }
                label="Maintenance Mode"
                description="Temporarily disable student and teacher portal access."
              />
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#002147] hover:bg-[#003366]"
                  disabled={busy}
                  onClick={() =>
                    void save({ maintenanceMode: settings.maintenanceMode })
                  }
                >
                  Save Maintenance Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Academic & Grading Rules
              </CardTitle>
              <CardDescription>
                Control approval gates, attendance, pass marks, and uploads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Toggle
                enabled={settings.requireAdminGradeApproval}
                onChange={(v) =>
                  setSettings((s) =>
                    s ? { ...s, requireAdminGradeApproval: v } : s
                  )
                }
                label="Require Admin Grade Approval"
                description="Require Admin review before student marks are published."
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  label="Minimum Attendance Threshold"
                  value={settings.minAttendanceThreshold}
                  onChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, minAttendanceThreshold: v } : s
                    )
                  }
                  min={0}
                  max={100}
                  suffix="%"
                />
                <NumberField
                  label="Passing Grade Cutoff"
                  value={settings.passingGradeCutoff}
                  onChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, passingGradeCutoff: v } : s
                    )
                  }
                  min={0}
                  max={100}
                  suffix="marks"
                />
                <NumberField
                  label="Max Upload File Size"
                  value={settings.maxUploadFileMb}
                  onChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, maxUploadFileMb: v } : s
                    )
                  }
                  min={1}
                  max={2000}
                  suffix="MB"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#002147] hover:bg-[#003366]"
                  disabled={busy}
                  onClick={() =>
                    void save({
                      requireAdminGradeApproval:
                        settings.requireAdminGradeApproval,
                      minAttendanceThreshold: settings.minAttendanceThreshold,
                      passingGradeCutoff: settings.passingGradeCutoff,
                      maxUploadFileMb: settings.maxUploadFileMb,
                    })
                  }
                >
                  Save Academic Rules
                </Button>
              </div>

              <div className="border-t border-[#E5EBF3] pt-5 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#002147]">
                  Faculty QR Attendance
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dynamic QR Verified Attendance policy (Phase A). TTL defaults
                  to 5 minutes; grace applies to late check-in detection in later
                  phases.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <NumberField
                    label="Check-in Grace Period"
                    value={settings.facultyAttendanceGraceMinutes}
                    onChange={(v) =>
                      setSettings((s) =>
                        s ? { ...s, facultyAttendanceGraceMinutes: v } : s
                      )
                    }
                    min={0}
                    max={120}
                    suffix="min"
                  />
                  <NumberField
                    label="QR Token TTL"
                    value={settings.facultyQrTokenTtlSeconds}
                    onChange={(v) =>
                      setSettings((s) =>
                        s ? { ...s, facultyQrTokenTtlSeconds: v } : s
                      )
                    }
                    min={60}
                    max={3600}
                    suffix="sec"
                  />
                  <NumberField
                    label="Required Minutes Fallback"
                    value={settings.facultyRequiredClassMinutesFallback}
                    onChange={(v) =>
                      setSettings((s) =>
                        s
                          ? { ...s, facultyRequiredClassMinutesFallback: v }
                          : s
                      )
                    }
                    min={30}
                    max={480}
                    suffix="min"
                  />
                </div>
                <div className="mt-4">
                  <Toggle
                    enabled={settings.allowManualFacultyAttendance}
                    onChange={(v) =>
                      setSettings((s) =>
                        s ? { ...s, allowManualFacultyAttendance: v } : s
                      )
                    }
                    label="Allow Manual Faculty Attendance"
                    description="When off, teachers must use Dynamic QR Verified Attendance (server-enforced)."
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    className="rounded-xl bg-[#002147] hover:bg-[#003366]"
                    disabled={busy}
                    onClick={() =>
                      void save({
                        facultyAttendanceGraceMinutes:
                          settings.facultyAttendanceGraceMinutes,
                        facultyQrTokenTtlSeconds:
                          settings.facultyQrTokenTtlSeconds,
                        facultyRequiredClassMinutesFallback:
                          settings.facultyRequiredClassMinutesFallback,
                        allowManualFacultyAttendance:
                          settings.allowManualFacultyAttendance,
                      })
                    }
                  >
                    Save Faculty Attendance Policy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Financial & Fee Settings
              </CardTitle>
              <CardDescription>
                Configure tuition, admission fees, currency, and grace period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Default Tuition Fee per Semester"
                  value={settings.defaultTuitionFee}
                  onChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, defaultTuitionFee: v } : s
                    )
                  }
                  min={0}
                  suffix="$"
                />
                <NumberField
                  label="Admission Application Fee"
                  value={settings.admissionApplicationFee}
                  onChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, admissionApplicationFee: v } : s
                    )
                  }
                  min={0}
                  suffix="$"
                />
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                    Payment Currency
                  </label>
                  <Select
                    value={settings.paymentCurrency}
                    onValueChange={(v) =>
                      setSettings((s) =>
                        s
                          ? {
                              ...s,
                              paymentCurrency: v as "USD" | "SOS",
                            }
                          : s
                      )
                    }
                  >
                    <SelectTrigger className="rounded-xl border-[#E5EBF3] bg-white text-[#002147]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="SOS">SOS (So.Sh.)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField
                  label="Payment Grace Period"
                  value={settings.paymentGracePeriodDays}
                  onChange={(v) =>
                    setSettings((s) =>
                      s ? { ...s, paymentGracePeriodDays: v } : s
                    )
                  }
                  min={0}
                  max={365}
                  suffix="days"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#16a34a] hover:bg-[#15803d]"
                  disabled={busy}
                  onClick={() =>
                    void save({
                      defaultTuitionFee: settings.defaultTuitionFee,
                      admissionApplicationFee: settings.admissionApplicationFee,
                      paymentCurrency: settings.paymentCurrency,
                      paymentGracePeriodDays: settings.paymentGracePeriodDays,
                    })
                  }
                >
                  Save Financial Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                Notifications & Email Triggers
              </CardTitle>
              <CardDescription>
                Automate welcome, attendance, and grade-review alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                enabled={settings.sendStudentWelcomeEmail}
                onChange={(v) =>
                  setSettings((s) =>
                    s ? { ...s, sendStudentWelcomeEmail: v } : s
                  )
                }
                label="Send Student Welcome Email"
                description="Auto-send login credentials when an admission is approved."
              />
              <Toggle
                enabled={settings.sendLowAttendanceWarning}
                onChange={(v) =>
                  setSettings((s) =>
                    s ? { ...s, sendLowAttendanceWarning: v } : s
                  )
                }
                label="Send Low Attendance Warning"
                description="Alert students when attendance falls below the minimum threshold."
              />
              <Toggle
                enabled={settings.sendGradeApprovalAlert}
                onChange={(v) =>
                  setSettings((s) =>
                    s ? { ...s, sendGradeApprovalAlert: v } : s
                  )
                }
                label="Send Grade Approval Alert"
                description="Alert teachers when Admin approves or returns submitted marks."
              />
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#ea580c] hover:bg-[#c2410c]"
                  disabled={busy}
                  onClick={() =>
                    void save({
                      sendStudentWelcomeEmail: settings.sendStudentWelcomeEmail,
                      sendLowAttendanceWarning:
                        settings.sendLowAttendanceWarning,
                      sendGradeApprovalAlert: settings.sendGradeApprovalAlert,
                    })
                  }
                >
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                  Data Backup
                </CardTitle>
                <CardDescription>
                  Export a JSON snapshot of faculties, students, classes, fees,
                  and settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="rounded-xl bg-[#002147] hover:bg-[#003366]"
                  disabled={backupBusy}
                  onClick={() => void downloadBackup()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {backupBusy
                    ? "Preparing backup…"
                    : "Download System Backup (JSON/SQL)"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-[#002147] dark:text-slate-100">
                    System Audit Log
                  </CardTitle>
                  <CardDescription>
                    Recent administrative actions across the platform.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void loadAuditLogs()}
                  disabled={auditLoading}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-x-hidden">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="border-b border-slate-700/50 bg-[#002147]/80 hover:bg-[#002147]/80">
                        <TableHead className="w-[22%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                          User
                        </TableHead>
                        <TableHead className="w-[28%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                          Action
                        </TableHead>
                        <TableHead className="w-[20%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                          Timestamp
                        </TableHead>
                        <TableHead className="w-[15%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                          Role
                        </TableHead>
                        <TableHead className="w-[15%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                          IP
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLoading && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            Loading audit logs…
                          </TableCell>
                        </TableRow>
                      )}
                      {!auditLoading && auditRows.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            No audit events yet. Saving settings will create
                            entries.
                          </TableCell>
                        </TableRow>
                      )}
                      {!auditLoading &&
                        auditRows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="border-b border-slate-100"
                          >
                            <TableCell className="max-w-0 truncate px-3 py-3 text-sm font-semibold text-[#002147]">
                              {row.user}
                            </TableCell>
                            <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-slate-600">
                              {row.action}
                              {row.entityType ? ` · ${row.entityType}` : ""}
                            </TableCell>
                            <TableCell className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                              {new Date(row.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="whitespace-nowrap px-3 py-3 text-xs font-bold text-slate-600">
                              {row.role}
                            </TableCell>
                            <TableCell className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                              {row.ip}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
