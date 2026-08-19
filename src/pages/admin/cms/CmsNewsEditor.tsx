import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Newspaper,
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
import { Textarea } from "@/components/ui/textarea";
import { CmsRichTextEditor } from "@/components/cms/CmsRichTextEditor";
import { ApiError, api } from "@/lib/api";
import {
  NEWS_CATEGORIES,
  slugifyTitle,
  toDatetimeLocalValue,
  type CmsNewsPost,
  type NewsCategory,
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

type NewsForm = {
  title: string;
  slug: string;
  category: NewsCategory;
  excerpt: string;
  body: string;
  publishedAt: string;
  coverMediaId: string | null;
  coverUrl: string | null;
};

const emptyForm = (): NewsForm => ({
  title: "",
  slug: "",
  category: "Campus News",
  excerpt: "",
  body: "",
  publishedAt: toDatetimeLocalValue(new Date().toISOString()),
  coverMediaId: null,
  coverUrl: null,
});

export function AdminCmsNewsPage() {
  const [items, setItems] = useState<CmsNewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsForm>(emptyForm());
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsNewsPost[] }>("/admin/cms/news");
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load news posts"
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
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [items]
  );

  function openCreate() {
    setEditingId(null);
    setSlugManual(false);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(item: CmsNewsPost) {
    setEditingId(item.id);
    setSlugManual(true);
    setForm({
      title: item.title,
      slug: item.slug,
      category: (NEWS_CATEGORIES.includes(item.category as NewsCategory)
        ? item.category
        : "Campus News") as NewsCategory,
      excerpt: item.excerpt ?? "",
      body: item.body,
      publishedAt: toDatetimeLocalValue(
        item.publishedAt || item.createdAt
      ),
      coverMediaId: item.coverMediaId,
      coverUrl: item.coverUrl,
    });
    setDialogOpen(true);
  }

  async function onSave(andPublish: boolean) {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        category: form.category,
        excerpt: form.excerpt.trim() || null,
        body: form.body,
        coverMediaId: form.coverMediaId,
        publishedAt: form.publishedAt
          ? new Date(form.publishedAt).toISOString()
          : null,
      };
      let id = editingId;
      if (editingId) {
        await api(`/admin/cms/news/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const created = await api<CmsNewsPost>("/admin/cms/news", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        id = created.id;
      }
      if (andPublish && id) {
        await api(`/admin/cms/news/${id}/publish`, { method: "POST" });
        toast.success("News article published successfully!");
      } else {
        toast.success(
          editingId ? "News article updated" : "News article created as draft"
        );
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save news article"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: CmsNewsPost) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      await api(`/admin/cms/news/${item.id}`, { method: "DELETE" });
      toast.success("News article deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete news article"
      );
    }
  }

  async function onPublish(item: CmsNewsPost) {
    try {
      await api(`/admin/cms/news/${item.id}/publish`, { method: "POST" });
      toast.success("News article published successfully!");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to publish news"
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="CMS News"
          description="Create and publish campus news articles. Public /news uses published posts with safe hardcoded fallback."
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
            New article
          </Button>
        </div>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
            <Newspaper className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-[#002147]">
                News articles
              </CardTitle>
              <Badge variant="info">cms.news.*</Badge>
            </div>
            <CardDescription className="mt-1">
              Draft, publish, or archive posts. Cover images come from the Media
              Library.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading news…
            </p>
          ) : sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No CMS news yet. Public pages will show approved sample news until
              you publish articles here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5EBF3]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[280px] font-semibold text-[#002147]">
                        {item.title}
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.status !== "PUBLISHED" ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void onPublish(item)}
                              aria-label={`Publish ${item.title}`}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(item)}
                            aria-label={`Edit ${item.title}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => void onDelete(item)}
                            aria-label={`Delete ${item.title}`}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit news article" : "New news article"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({
                    ...f,
                    title,
                    slug: slugManual ? f.slug : slugifyTitle(title),
                  }));
                }}
              />
            </Field>
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      category: v as NewsCategory,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEWS_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Publication date">
                <Input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, publishedAt: e.target.value }))
                  }
                />
              </Field>
            </div>
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
              hint="News card cover — upload or reuse from the Media Library."
            />
            <Field label="Excerpt">
              <Textarea
                rows={2}
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
              />
            </Field>
            <Field label="Content">
              <CmsRichTextEditor
                value={form.body}
                onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                placeholder="Write the full article…"
                minHeightClass="min-h-[200px]"
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
