import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cmsBtnCancelClass,
  cmsBtnDraftClass,
  cmsBtnPublishNavyClass,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import {
  formatEventDate,
  formatEventTime,
  toDatetimeLocalValue,
  type CmsEvent,
} from "@/lib/cmsNewsEvents";
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

type EventForm = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  registrationUrl: string;
  coverMediaId: string | null;
  coverUrl: string | null;
};

const emptyForm = (): EventForm => ({
  title: "",
  description: "",
  location: "Main Campus Auditorium",
  startsAt: toDatetimeLocalValue(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  ),
  endsAt: "",
  registrationUrl: "",
  coverMediaId: null,
  coverUrl: null,
});

export function AdminCmsEventsPage() {
  const [items, setItems] = useState<CmsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsEvent[] }>("/admin/cms/events");
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load events"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      items
        .slice()
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        ),
    [items]
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(item: CmsEvent) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      location: item.location ?? "",
      startsAt: toDatetimeLocalValue(item.startsAt),
      endsAt: toDatetimeLocalValue(item.endsAt),
      registrationUrl: item.registrationUrl ?? "",
      coverMediaId: item.coverMediaId,
      coverUrl: item.coverUrl,
    });
    setDialogOpen(true);
  }

  async function onSave(andPublish: boolean) {
    if (!form.title.trim() || !form.startsAt) {
      toast.error("Title and start date/time are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        location: form.location.trim() || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        registrationUrl: form.registrationUrl.trim() || null,
        coverMediaId: form.coverMediaId,
      };
      let id = editingId;
      if (editingId) {
        await api(`/admin/cms/events/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const created = await api<CmsEvent>("/admin/cms/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        id = created.id;
      }
      if (andPublish && id) {
        await api(`/admin/cms/events/${id}/publish`, { method: "POST" });
        toast.success("Event published successfully!");
      } else {
        toast.success(editingId ? "Event updated" : "Event created as draft");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save event"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: CmsEvent) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      await api(`/admin/cms/events/${item.id}`, { method: "DELETE" });
      toast.success("Event deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete event"
      );
    }
  }

  async function onPublish(item: CmsEvent) {
    try {
      await api(`/admin/cms/events/${item.id}/publish`, { method: "POST" });
      toast.success("Event published successfully!");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to publish event"
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="CMS Events"
          description="Manage university events shown on /news and the homepage. Empty CMS uses approved sample events."
        />
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Reload
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            className="bg-[#002147] text-white hover:bg-[#003366]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New event
          </Button>
        </div>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-[#002147]">Events</CardTitle>
              <Badge variant="info">cms.events.*</Badge>
            </div>
            <CardDescription className="mt-1">
              Title, date/time, location, registration link, and cover image.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading events…
            </p>
          ) : sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No CMS events yet. Public pages will show approved sample events
              until you publish here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5EBF3]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-[#002147]">
                        {item.title}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatEventDate(item.startsAt)}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {formatEventTime(item.startsAt, item.endsAt)}
                        </span>
                      </TableCell>
                      <TableCell>{item.location || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "PUBLISHED"
                              ? "success"
                              : item.status === "ARCHIVED"
                                ? "secondary"
                                : "warning"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.status !== "PUBLISHED" ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void onPublish(item)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => void onDelete(item)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit event" : "New event"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Event title">
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date & time">
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startsAt: e.target.value }))
                  }
                />
              </Field>
              <Field label="End date & time">
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endsAt: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                placeholder="Campus Auditorium, Hall B…"
              />
            </Field>
            <Field label="Registration link">
              <Input
                value={form.registrationUrl}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    registrationUrl: e.target.value,
                  }))
                }
                placeholder="https://… or /admissions"
              />
            </Field>
            <CmsImageField
              label="Cover image"
              url={form.coverUrl}
              mediaId={form.coverMediaId}
              onChange={({ url, mediaId }) =>
                setForm((f) => ({
                  ...f,
                  coverUrl: url || null,
                  coverMediaId: mediaId,
                }))
              }
              onClear={() =>
                setForm((f) => ({
                  ...f,
                  coverUrl: null,
                  coverMediaId: null,
                }))
              }
              hint="Event cover — upload or reuse from the Media Library."
            />
            <Field label="Description">
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
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
              disabled={saving}
              className={cmsBtnPublishNavyClass}
              onClick={() => void onSave(true)}
            >
              <Send className="mr-1.5 h-4 w-4" />
              Save & publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
