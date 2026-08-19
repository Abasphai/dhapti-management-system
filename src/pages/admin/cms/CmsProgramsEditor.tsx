import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import { ApiError, api } from "@/lib/api";
import {
  DHAPTI_FACULTY_KEYS,
  type CmsProgramMarketing,
} from "@/lib/cmsFacultyPrograms";

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type ProgramForm = {
  programKey: string;
  facultyKey: string;
  title: string;
  degreeTitle: string;
  overviewHtml: string;
  duration: string;
  creditHours: string;
  tuitionPerSemester: string;
  careerOpportunitiesHtml: string;
};

const emptyForm = (): ProgramForm => ({
  programKey: "",
  facultyKey: DHAPTI_FACULTY_KEYS[0]?.key ?? "medicine",
  title: "",
  degreeTitle: "",
  overviewHtml: "",
  duration: "4 Years",
  creditHours: "",
  tuitionPerSemester: "",
  careerOpportunitiesHtml: "",
});

export function AdminCmsProgramsPage() {
  const [items, setItems] = useState<CmsProgramMarketing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramForm>(emptyForm());
  const [keyManual, setKeyManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsProgramMarketing[] }>(
        "/admin/cms/programs"
      );
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load program marketing"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setKeyManual(false);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (item: CmsProgramMarketing) => {
    setEditingId(item.id);
    setKeyManual(true);
    setForm({
      programKey: item.programKey,
      facultyKey: item.facultyKey,
      title: item.title,
      degreeTitle: item.degreeTitle,
      overviewHtml: item.overviewHtml,
      duration: item.duration,
      creditHours: item.creditHours,
      tuitionPerSemester: item.tuitionPerSemester,
      careerOpportunitiesHtml: item.careerOpportunitiesHtml,
    });
    setDialogOpen(true);
  };

  const onSave = async (andPublish: boolean) => {
    if (!form.programKey.trim() || !form.title.trim() || !form.facultyKey) {
      toast.error("Program key, title, and faculty are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        programKey: form.programKey.trim(),
        facultyKey: form.facultyKey,
        title: form.title.trim(),
        degreeTitle: form.degreeTitle.trim(),
        overviewHtml: form.overviewHtml,
        duration: form.duration.trim(),
        creditHours: form.creditHours.trim(),
        tuitionPerSemester: form.tuitionPerSemester.trim(),
        careerOpportunitiesHtml: form.careerOpportunitiesHtml,
      };
      let id = editingId;
      if (editingId) {
        const { programKey: _k, ...patch } = payload;
        void _k;
        await api(`/admin/cms/programs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } else {
        const created = await api<CmsProgramMarketing>("/admin/cms/programs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        id = created.id;
      }
      if (andPublish && id) {
        await api(`/admin/cms/programs/${id}/publish`, { method: "POST" });
      }
      toast.success(andPublish ? "Saved and published" : "Draft saved");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save program"
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: CmsProgramMarketing) => {
    if (!window.confirm(`Delete marketing for ${item.title}?`)) return;
    try {
      await api(`/admin/cms/programs/${item.id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete"
      );
    }
  };

  const onPublish = async (item: CmsProgramMarketing) => {
    try {
      await api(`/admin/cms/programs/${item.id}/publish`, { method: "POST" });
      toast.success("Published");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to publish"
      );
    }
  };

  const facultyLabel = (key: string) =>
    DHAPTI_FACULTY_KEYS.find((f) => f.key === key)?.shortName ?? key;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Program Marketing CMS"
          description="Public program overview, degree title, duration, credits, tuition, and careers. Unpublished content never appears on the public site."
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
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add program
          </Button>
        </div>
      </div>
      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Program marketing rows
          </CardTitle>
          <CardDescription>
            Soft-linked to faculty keys used on /faculties and /programs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Degree</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{facultyLabel(item.facultyKey)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.degreeTitle || "—"}
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
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No program marketing yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit program marketing" : "New program marketing"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({
                    ...f,
                    title,
                    programKey: keyManual ? f.programKey : slugify(title),
                  }));
                }}
              />
            </Field>
            <Field label="Program key">
              <Input
                value={form.programKey}
                disabled={!!editingId}
                onChange={(e) => {
                  setKeyManual(true);
                  setForm((f) => ({ ...f, programKey: e.target.value }));
                }}
              />
            </Field>
            <Field label="Faculty">
              <Select
                value={form.facultyKey}
                onValueChange={(facultyKey) =>
                  setForm((f) => ({ ...f, facultyKey }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DHAPTI_FACULTY_KEYS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Degree title">
              <Input
                value={form.degreeTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, degreeTitle: e.target.value }))
                }
                placeholder="e.g. B.Sc. Civil Engineering"
              />
            </Field>
            <Field label="Duration">
              <Input
                value={form.duration}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration: e.target.value }))
                }
              />
            </Field>
            <Field label="Total credit hours">
              <Input
                value={form.creditHours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, creditHours: e.target.value }))
                }
              />
            </Field>
            <Field label="Tuition per semester">
              <Input
                value={form.tuitionPerSemester}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    tuitionPerSemester: e.target.value,
                  }))
                }
                placeholder="e.g. $450"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Program overview">
                <CmsRichTextEditor
                  value={form.overviewHtml}
                  onChange={(html) =>
                    setForm((f) => ({ ...f, overviewHtml: html }))
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Career opportunities">
                <CmsRichTextEditor
                  value={form.careerOpportunitiesHtml}
                  onChange={(html) =>
                    setForm((f) => ({
                      ...f,
                      careerOpportunitiesHtml: html,
                    }))
                  }
                />
              </Field>
            </div>
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
