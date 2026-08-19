import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshCw, Save, Settings } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cmsBtnPublishNavyClass } from "@/components/cms/cmsModalStyles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import type { CmsWebsiteSettings } from "@/lib/cmsPublic";
import { CmsImageField } from "./CmsImageField";

type FormState = CmsWebsiteSettings;

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function AdminCmsSettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<FormState>("/admin/cms/settings");
      setForm(data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load website settings"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSave() {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await api<FormState>("/admin/cms/settings", {
        method: "PATCH",
        body: JSON.stringify({
          universityName: form.universityName,
          universityShortName: form.universityShortName,
          logoUrl: form.logoUrl,
          faviconUrl: form.faviconUrl,
          logoMediaId: form.logoMediaId,
          faviconMediaId: form.faviconMediaId,
          contactPhone: form.contactPhone,
          emergencyPhone: form.emergencyPhone,
          contactEmail: form.contactEmail,
          admissionsEmail: form.admissionsEmail,
          supportEmail: form.supportEmail,
          campusAddress: form.campusAddress,
          officeHours: form.officeHours,
          socialFacebook: form.socialFacebook,
          socialTwitter: form.socialTwitter,
          socialLinkedIn: form.socialLinkedIn,
          socialYouTube: form.socialYouTube,
          socialInstagram: form.socialInstagram,
          websiteCopyright: form.websiteCopyright,
          privacyPolicyUrl: form.privacyPolicyUrl,
          termsOfUseUrl: form.termsOfUseUrl,
          themePrimary: form.themePrimary,
          themeSecondary: form.themeSecondary,
          themeAccent: form.themeAccent,
          websiteTitle: form.websiteTitle,
          websiteDescription: form.websiteDescription,
        }),
      });
      setForm(updated);
      toast.success("Website settings updated successfully!");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save website settings"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="CMS Site Settings"
          description="Manage public website branding, contact details, social links, and theme accents."
        />
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Reload
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void onSave()}
            disabled={!form || loading || saving}
            className={cmsBtnPublishNavyClass}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>

      {loading || !form ? (
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading website settings…
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
                <Settings className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base text-[#002147]">
                    Branding
                  </CardTitle>
                  <Badge variant="info">cms.settings.*</Badge>
                </div>
                <CardDescription>
                  University identity shown on the public Navbar and Footer.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="University name">
                <Input
                  value={form.universityName}
                  onChange={(e) => set("universityName", e.target.value)}
                />
              </Field>
              <Field label="Short name">
                <Input
                  value={form.universityShortName}
                  onChange={(e) => set("universityShortName", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <CmsImageField
                  label="Logo"
                  url={form.logoUrl}
                  mediaId={form.logoMediaId || null}
                  onChange={({ url, mediaId }) => {
                    set("logoUrl", url || "/dhapti-logo.png");
                    set("logoMediaId", mediaId ?? "");
                  }}
                  hint="Navbar / brand logo."
                />
              </div>
              <div className="sm:col-span-2">
                <CmsImageField
                  label="Favicon"
                  url={form.faviconUrl}
                  mediaId={form.faviconMediaId || null}
                  onChange={({ url, mediaId }) => {
                    set("faviconUrl", url);
                    set("faviconMediaId", mediaId ?? "");
                  }}
                  hint="Browser tab icon."
                />
              </div>
              <Field label="Website title">
                <Input
                  value={form.websiteTitle}
                  onChange={(e) => set("websiteTitle", e.target.value)}
                />
              </Field>
              <Field label="Website description">
                <Textarea
                  rows={3}
                  value={form.websiteDescription}
                  onChange={(e) => set("websiteDescription", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Contact details
              </CardTitle>
              <CardDescription>
                Phones, emails, campus address, and office hours for the public site.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary phone">
                <Input
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                />
              </Field>
              <Field label="Emergency phone">
                <Input
                  value={form.emergencyPhone}
                  onChange={(e) => set("emergencyPhone", e.target.value)}
                />
              </Field>
              <Field label="Admissions email">
                <Input
                  type="email"
                  value={form.admissionsEmail}
                  onChange={(e) => set("admissionsEmail", e.target.value)}
                />
              </Field>
              <Field label="Support email">
                <Input
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => set("supportEmail", e.target.value)}
                />
              </Field>
              <Field label="General contact email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                />
              </Field>
              <Field label="Office hours">
                <Input
                  value={form.officeHours}
                  onChange={(e) => set("officeHours", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Campus address">
                  <Textarea
                    rows={3}
                    value={form.campusAddress}
                    onChange={(e) => set("campusAddress", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Social media
              </CardTitle>
              <CardDescription>
                Leave blank to hide a network on the public Footer.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["socialFacebook", "Facebook URL"],
                  ["socialTwitter", "Twitter / X URL"],
                  ["socialLinkedIn", "LinkedIn URL"],
                  ["socialYouTube", "YouTube URL"],
                  ["socialInstagram", "Instagram URL"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </Field>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Footer & legal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Copyright text">
                  <Input
                    value={form.websiteCopyright}
                    onChange={(e) => set("websiteCopyright", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Privacy Policy link">
                <Input
                  value={form.privacyPolicyUrl}
                  onChange={(e) => set("privacyPolicyUrl", e.target.value)}
                />
              </Field>
              <Field label="Terms of Use link">
                <Input
                  value={form.termsOfUseUrl}
                  onChange={(e) => set("termsOfUseUrl", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Theme accents
              </CardTitle>
              <CardDescription>
                Hex colors used as CMS theme defaults (public layout accents may
                still follow user layout preferences).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["themePrimary", "Primary"],
                  ["themeSecondary", "Secondary"],
                  ["themeAccent", "Accent"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={label}
                      className="h-10 w-12 cursor-pointer rounded border border-[#E5EBF3] bg-white p-1"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                    <Input
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </div>
                </Field>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
