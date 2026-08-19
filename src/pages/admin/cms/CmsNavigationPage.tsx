import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cmsBtnCancelClass,
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
import { cn } from "@/lib/utils";

type NavLocation = "HEADER" | "FOOTER";

type NavItem = {
  id: string;
  label: string;
  href: string;
  location: NavLocation;
  sortOrder: number;
  visible: boolean;
  parentId: string | null;
};

type NavForm = {
  label: string;
  href: string;
  location: NavLocation;
  sortOrder: number;
  visible: boolean;
  parentId: string | null;
};

const emptyForm = (location: NavLocation = "HEADER"): NavForm => ({
  label: "",
  href: "/",
  location,
  sortOrder: 0,
  visible: true,
  parentId: null,
});

export function AdminCmsNavigationPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | NavLocation>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NavForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: NavItem[] }>("/admin/cms/nav");
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load navigation"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const list =
      filter === "ALL" ? items : items.filter((i) => i.location === filter);
    return list
      .slice()
      .sort(
        (a, b) =>
          a.location.localeCompare(b.location) ||
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label)
      );
  }, [items, filter]);

  const parentOptions = useMemo(() => {
    return items.filter(
      (i) =>
        i.location === form.location &&
        !i.parentId &&
        i.id !== editingId
    );
  }, [items, form.location, editingId]);

  function openCreate(location: NavLocation = "HEADER") {
    setEditingId(null);
    setForm(emptyForm(location));
    setDialogOpen(true);
  }

  function openEdit(item: NavItem) {
    setEditingId(item.id);
    setForm({
      label: item.label,
      href: item.href,
      location: item.location,
      sortOrder: item.sortOrder,
      visible: item.visible,
      parentId: item.parentId,
    });
    setDialogOpen(true);
  }

  async function onSave() {
    if (!form.label.trim() || !form.href.trim()) {
      toast.error("Label and URL are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        href: form.href.trim(),
        location: form.location,
        sortOrder: Number(form.sortOrder) || 0,
        visible: form.visible,
        parentId: form.parentId,
      };
      if (editingId) {
        await api(`/admin/cms/nav/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Navigation item updated");
      } else {
        await api("/admin/cms/nav", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Navigation item created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save navigation item"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: NavItem) {
    if (!window.confirm(`Delete “${item.label}”?`)) return;
    try {
      await api(`/admin/cms/nav/${item.id}`, { method: "DELETE" });
      toast.success("Navigation item deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete navigation item"
      );
    }
  }

  async function toggleVisible(item: NavItem) {
    try {
      await api(`/admin/cms/nav/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ visible: !item.visible }),
      });
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update visibility"
      );
    }
  }

  function parentLabel(id: string | null) {
    if (!id) return "—";
    return items.find((i) => i.id === id)?.label ?? id.slice(0, 8);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="CMS Navigation"
          description="Manage Header and Footer menu links for the public website. Empty CMS nav keeps the approved hardcoded menus."
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
            onClick={() => openCreate("HEADER")}
            className="bg-[#002147] text-white hover:bg-[#003366]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add item
          </Button>
        </div>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
              <Menu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base text-[#002147]">
                  Menu items
                </CardTitle>
                <Badge variant="info">cms.nav.*</Badge>
              </div>
              <CardDescription className="mt-1">
                Use a parent item for dropdown groups. Top-level items without
                children render as standalone links.
              </CardDescription>
            </div>
          </div>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All locations</SelectItem>
              <SelectItem value="HEADER">Header</SelectItem>
              <SelectItem value="FOOTER">Footer</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading navigation…
            </p>
          ) : visibleItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No CMS navigation items yet. Public Navbar/Footer will use the
              approved hardcoded Dhapti menus until you add items here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5EBF3]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-[#002147]">
                        {item.label}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-xs">
                        {item.href}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.location === "HEADER" ? "info" : "secondary"
                          }
                        >
                          {item.location}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.sortOrder}</TableCell>
                      <TableCell>{parentLabel(item.parentId)}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => void toggleVisible(item)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            item.visible
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {item.visible ? "Visible" : "Hidden"}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(item)}
                            aria-label={`Edit ${item.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => void onDelete(item)}
                            aria-label={`Delete ${item.label}`}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit menu item" : "Add menu item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Menu label</Label>
              <Input
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="About"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL / route</Label>
              <Input
                value={form.href}
                onChange={(e) =>
                  setForm((f) => ({ ...f, href: e.target.value }))
                }
                placeholder="/about"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select
                  value={form.location}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      location: v as NavLocation,
                      parentId: null,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEADER">Header</SelectItem>
                    <SelectItem value="FOOTER">Footer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Display order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Parent menu (optional)</Label>
              <Select
                value={form.parentId ?? "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    parentId: v === "__none__" ? null : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#E5EBF3] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#002147]">Visible</p>
                <p className="text-xs text-muted-foreground">
                  Hidden items stay in admin but are omitted from public nav.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.visible}
                onClick={() =>
                  setForm((f) => ({ ...f, visible: !f.visible }))
                }
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  form.visible ? "bg-[#ea580c]" : "bg-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                    form.visible ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>
          <DialogFooter>
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
              onClick={() => void onSave()}
              disabled={saving}
              className={cmsBtnPublishNavyClass}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
