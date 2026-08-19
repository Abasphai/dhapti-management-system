import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { CmsRichTextEditor } from "@/components/cms/CmsRichTextEditor";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cmsBtnCancelClass,
  cmsBtnDraftClass,
  cmsBtnPublishClass,
} from "@/components/cms/cmsModalStyles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { facultyDetails } from "@/data/publicSite";
import { ApiError, api } from "@/lib/api";
import {
  DHAPTI_FACULTY_KEYS,
  type CmsFacultyMarketing,
} from "@/lib/cmsFacultyPrograms";
import { CmsImageField } from "./CmsImageField";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type FacultyForm = {
  facultyKey: string;
  name: string;
  shortName: string;
  heroImageUrl: string;
  overviewHtml: string;
  careerProspectsHtml: string;
  admissionRequirementsHtml: string;
  deanWelcomeHtml: string;
  departmentsText: string;
  degreesText: string;
  duration: string;
  credits: string;
};

function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

function emptyForm(key?: string): FacultyForm {
  const catalog = facultyDetails.find((f) => f.id === key);
  return {
    facultyKey: key ?? "",
    name: catalog?.name ?? "",
    shortName: catalog?.shortName ?? "",
    heroImageUrl: catalog?.image ?? "",
    overviewHtml: catalog ? `<p>${catalog.description}</p>` : "",
    careerProspectsHtml: "",
    admissionRequirementsHtml: catalog
      ? `<ul>${catalog.entryRequirements.map((r) => `<li>${r}</li>`).join("")}</ul>`
      : "",
    deanWelcomeHtml: "",
    departmentsText: listToLines(catalog?.departments ?? []),
    degreesText: listToLines(catalog?.degrees ?? []),
    duration: catalog?.duration ?? "",
    credits: catalog?.credits ?? "",
  };
}

export function AdminCmsFacultiesPage() {
  const [items, setItems] = useState<CmsFacultyMarketing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FacultyForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const usedKeys = useMemo(
    () => new Set(items.map((i) => i.facultyKey)),
    [items]
  );
  const availableKeys = DHAPTI_FACULTY_KEYS.filter((f) => !usedKeys.has(f.key));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsFacultyMarketing[] }>(
        "/admin/cms/faculties"
      );
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load faculty marketing"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (key?: string) => {
    setEditingId(null);
    setForm(emptyForm(key ?? availableKeys[0]?.key));
    setDialogOpen(true);
  };

  const openEdit = (item: CmsFacultyMarketing) => {
    setEditingId(item.id);
    setForm({
      facultyKey: item.facultyKey,
      name: item.name,
      shortName: item.shortName,
      heroImageUrl: item.heroImageUrl,
      overviewHtml: item.overviewHtml,
      careerProspectsHtml: item.careerProspectsHtml,
      admissionRequirementsHtml: item.admissionRequirementsHtml,
      deanWelcomeHtml: item.deanWelcomeHtml,
      departmentsText: listToLines(item.departments),
      degreesText: listToLines(item.degrees),
      duration: item.duration,
      credits: item.credits,
    });
    setDialogOpen(true);
  };

  const onSave = async (andPublish: boolean) => {
    if (!form.facultyKey || !form.name.trim() || !form.shortName.trim()) {
      toast.error("Faculty key, name, and short name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        facultyKey: form.facultyKey,
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        heroImageUrl: form.heroImageUrl.trim(),
        overviewHtml: form.overviewHtml,
        careerProspectsHtml: form.careerProspectsHtml,
        admissionRequirementsHtml: form.admissionRequirementsHtml,
        deanWelcomeHtml: form.deanWelcomeHtml,
        departments: linesToList(form.departmentsText),
        degrees: linesToList(form.degreesText),
        duration: form.duration.trim(),
        credits: form.credits.trim(),
      };
      let id = editingId;
      if (editingId) {
        const { facultyKey: _k, ...patch } = payload;
        void _k;
        await api(`/admin/cms/faculties/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } else {
        const created = await api<CmsFacultyMarketing>("/admin/cms/faculties", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        id = created.id;
      }
      if (andPublish && id) {
        await api(`/admin/cms/faculties/${id}/publish`, { method: "POST" });
      }
      toast.success(andPublish ? "Saved and published" : "Draft saved");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save faculty"
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: CmsFacultyMarketing) => {
    if (!window.confirm(`Delete marketing for ${item.shortName}?`)) return;
    try {
      await api(`/admin/cms/faculties/${item.id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete"
      );
    }
  };

  const onPublish = async (item: CmsFacultyMarketing) => {
    try {
      await api(`/admin/cms/faculties/${item.id}/publish`, { method: "POST" });
      toast.success("Published");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to publish"
      );
    }
  };

  const seedMissing = async () => {
    if (availableKeys.length === 0) {
      toast.message("All 6 Dhapti faculties already have CMS rows");
      return;
    }
    setSaving(true);
    try {
      for (const f of availableKeys) {
        const seed = emptyForm(f.key);
        await api("/admin/cms/faculties", {
          method: "POST",
          body: JSON.stringify({
            facultyKey: seed.facultyKey,
            name: seed.name,
            shortName: seed.shortName,
            heroImageUrl: seed.heroImageUrl,
            overviewHtml: seed.overviewHtml,
            careerProspectsHtml: "",
            admissionRequirementsHtml: seed.admissionRequirementsHtml,
            deanWelcomeHtml: "",
            departments: linesToList(seed.departmentsText),
            degrees: linesToList(seed.degreesText),
            duration: seed.duration,
            credits: seed.credits,
          }),
        });
      }
      toast.success(`Created ${availableKeys.length} draft facult(ies) from catalog`);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to seed faculties"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Faculty Marketing CMS"
          description="Public presentation for Dhapti faculties — hero, overview, careers, admissions, and Dean’s welcome. Empty/unpublished public pages fall back to the approved catalog."
        />
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || availableKeys.length === 0}
            onClick={() => void seedMissing()}
          >
            Seed from catalog
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={availableKeys.length === 0}
            onClick={() => openCreate()}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add faculty
          </Button>
        </div>
      </div>
      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Faculty marketing rows
          </CardTitle>
          <CardDescription>
            Keys match public site IDs: medicine, engineering, business, science,
            law, agriculture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.facultyKey}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "PUBLISHED" ? "default" : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {item.status !== "PUBLISHED" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void onPublish(item)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onDelete(item)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No faculty marketing yet — seed from the Dhapti catalog or add
                      one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit faculty marketing" : "New faculty marketing"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {!editingId && (
              <Field label="Faculty key">
                <Select
                  value={form.facultyKey}
                  onValueChange={(key) => setForm(emptyForm(key))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableKeys.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.shortName} ({f.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Full name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Short name">
              <Input
                value={form.shortName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, shortName: e.target.value }))
                }
              />
            </Field>
            <Field label="Duration">
              <Input
                value={form.duration}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration: e.target.value }))
                }
                placeholder="e.g. 4 Years"
              />
            </Field>
            <Field label="Credit hours">
              <Input
                value={form.credits}
                onChange={(e) =>
                  setForm((f) => ({ ...f, credits: e.target.value }))
                }
                placeholder="e.g. 140 Credit Hours"
              />
            </Field>
            <div className="sm:col-span-2">
              <CmsImageField
                label="Hero banner image"
                url={form.heroImageUrl}
                onChange={({ url }) =>
                  setForm((f) => ({ ...f, heroImageUrl: url ?? "" }))
                }
                hint="Public faculties accordion image."
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Public overview">
                <CmsRichTextEditor
                  value={form.overviewHtml}
                  onChange={(html) =>
                    setForm((f) => ({ ...f, overviewHtml: html }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Dean’s welcome">
                <CmsRichTextEditor
                  value={form.deanWelcomeHtml}
                  onChange={(html) =>
                    setForm((f) => ({ ...f, deanWelcomeHtml: html }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Career prospects">
                <CmsRichTextEditor
                  value={form.careerProspectsHtml}
                  onChange={(html) =>
                    setForm((f) => ({ ...f, careerProspectsHtml: html }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Admission requirements">
                <CmsRichTextEditor
                  value={form.admissionRequirementsHtml}
                  onChange={(html) =>
                    setForm((f) => ({
                      ...f,
                      admissionRequirementsHtml: html,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Departments (one per line)">
              <textarea
                className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.departmentsText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, departmentsText: e.target.value }))
                }
              />
            </Field>
            <Field label="Degrees (one per line)">
              <textarea
                className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.degreesText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, degreesText: e.target.value }))
                }
              />
            </Field>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={cmsBtnCancelClass}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cmsBtnDraftClass}
              disabled={saving}
              onClick={() => void onSave(false)}
            >
              Save draft
            </Button>
            <Button
              type="button"
              className={cmsBtnPublishClass}
              disabled={saving}
              onClick={() => void onSave(true)}
            >
              Save & publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
