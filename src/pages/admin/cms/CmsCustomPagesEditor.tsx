import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cmsBtnDraftClass,
  cmsBtnPublishClass,
  cmsDialogContentClass,
  cmsFieldClass,
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
  slugifyTitle,
} from "@/lib/cmsNewsEvents";
import type {
  CalloutBannerBlockPayload,
  CmsPage,
  DownloadsBlockPayload,
  FaqAccordionBlockPayload,
  RichTextBlockPayload,
} from "@/lib/cmsPageContent";

const CUSTOM_BLOCK_TYPES = [
  "RICH_TEXT_BLOCK",
  "FAQ_ACCORDION_BLOCK",
  "DOWNLOADS_BLOCK",
  "CALLOUT_BANNER_BLOCK",
] as const;

type CustomBlockType = (typeof CUSTOM_BLOCK_TYPES)[number];

type EditorBlock = {
  key: string;
  blockType: CustomBlockType;
  schemaVersion: number;
  sortOrder: number;
  payload: Record<string, unknown>;
};

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

function blockLabel(type: string): string {
  switch (type) {
    case "RICH_TEXT_BLOCK":
      return "Rich Text";
    case "FAQ_ACCORDION_BLOCK":
      return "FAQ Accordion";
    case "DOWNLOADS_BLOCK":
      return "Downloads";
    case "CALLOUT_BANNER_BLOCK":
      return "Callout Banner";
    default:
      return type;
  }
}

function defaultPayload(type: CustomBlockType): Record<string, unknown> {
  switch (type) {
    case "RICH_TEXT_BLOCK":
      return { heading: "", body: "", i18n: { so: {}, ar: {} } };
    case "FAQ_ACCORDION_BLOCK":
      return {
        sectionTitle: "Frequently Asked Questions",
        items: [{ question: "Sample question?", answer: "Sample answer." }],
        i18n: { so: {}, ar: {} },
      };
    case "DOWNLOADS_BLOCK":
      return {
        sectionTitle: "Downloads",
        items: [
          {
            title: "Document",
            description: "",
            mediaId: "",
            fileName: "",
          },
        ],
        i18n: { so: {}, ar: {} },
      };
    case "CALLOUT_BANNER_BLOCK":
      return {
        title: "Call to action",
        body: "",
        ctaLabel: "Learn more",
        ctaHref: "/admissions",
        backgroundImageUrl: "",
        backgroundMediaId: null,
        i18n: { so: {}, ar: {} },
      };
  }
}

function makeKey() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blocksFromPage(page: CmsPage): EditorBlock[] {
  return (page.blocks ?? [])
    .filter((b) =>
      CUSTOM_BLOCK_TYPES.includes(b.blockType as CustomBlockType)
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b, i) => ({
      key: b.id ?? makeKey(),
      blockType: b.blockType as CustomBlockType,
      schemaVersion: b.schemaVersion || 1,
      sortOrder: b.sortOrder ?? i,
      payload: {
        ...defaultPayload(b.blockType as CustomBlockType),
        ...((b.payload as Record<string, unknown>) ?? {}),
      },
    }));
}

function I18nCollapse({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#E5EBF3] bg-[#FAFBFD] p-3">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-bold uppercase tracking-wider text-[#002147]"
      >
        {open ? "▾" : "▸"} Somali / Arabic (optional)
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}

function RichTextEditorFields({
  payload,
  onChange,
}: {
  payload: RichTextBlockPayload;
  onChange: (next: RichTextBlockPayload) => void;
}) {
  const [i18nOpen, setI18nOpen] = useState(false);
  const so = (payload.i18n?.so ?? {}) as Record<string, string>;
  const ar = (payload.i18n?.ar ?? {}) as Record<string, string>;

  return (
    <div className="space-y-3">
      <Field label="Heading">
        <Input
          className={cmsFieldClass}
          value={payload.heading ?? ""}
          onChange={(e) => onChange({ ...payload, heading: e.target.value })}
        />
      </Field>
      <Field label="Body">
        <CmsRichTextEditor
          value={payload.body ?? ""}
          onChange={(html) => onChange({ ...payload, body: html })}
          placeholder="Write page content…"
        />
      </Field>
      <I18nCollapse open={i18nOpen} onToggle={() => setI18nOpen((v) => !v)}>
        <Field label="Heading (SO)">
          <Input
            className={cmsFieldClass}
            value={so.heading ?? ""}
            onChange={(e) =>
              onChange({
                ...payload,
                i18n: {
                  ...payload.i18n,
                  so: { ...so, heading: e.target.value },
                  ar,
                },
              })
            }
          />
        </Field>
        <Field label="Body (SO)">
          <Textarea
            className={cmsFieldClass}
            rows={3}
            value={so.body ?? ""}
            onChange={(e) =>
              onChange({
                ...payload,
                i18n: {
                  ...payload.i18n,
                  so: { ...so, body: e.target.value },
                  ar,
                },
              })
            }
          />
        </Field>
        <Field label="Heading (AR)">
          <Input
            className={cmsFieldClass}
            dir="rtl"
            value={ar.heading ?? ""}
            onChange={(e) =>
              onChange({
                ...payload,
                i18n: {
                  ...payload.i18n,
                  so,
                  ar: { ...ar, heading: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Body (AR)">
          <Textarea
            className={cmsFieldClass}
            dir="rtl"
            rows={3}
            value={ar.body ?? ""}
            onChange={(e) =>
              onChange({
                ...payload,
                i18n: {
                  ...payload.i18n,
                  so,
                  ar: { ...ar, body: e.target.value },
                },
              })
            }
          />
        </Field>
      </I18nCollapse>
    </div>
  );
}

function FaqEditorFields({
  payload,
  onChange,
}: {
  payload: FaqAccordionBlockPayload;
  onChange: (next: FaqAccordionBlockPayload) => void;
}) {
  const items = payload.items ?? [];
  return (
    <div className="space-y-3">
      <Field label="Section title">
        <Input
          className={cmsFieldClass}
          value={payload.sectionTitle ?? ""}
          onChange={(e) =>
            onChange({ ...payload, sectionTitle: e.target.value })
          }
        />
      </Field>
      {items.map((item, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-[#E5EBF3] bg-white p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Q&A {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={items.length <= 1}
              onClick={() =>
                onChange({
                  ...payload,
                  items: items.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
          <Input
            className={cmsFieldClass}
            placeholder="Question"
            value={item.question}
            onChange={(e) => {
              const next = items.map((row, j) =>
                j === i ? { ...row, question: e.target.value } : row
              );
              onChange({ ...payload, items: next });
            }}
          />
          <Textarea
            className={cmsFieldClass}
            placeholder="Answer"
            rows={3}
            value={item.answer}
            onChange={(e) => {
              const next = items.map((row, j) =>
                j === i ? { ...row, answer: e.target.value } : row
              );
              onChange({ ...payload, items: next });
            }}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...payload,
            items: [...items, { question: "", answer: "" }],
          })
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Q&A
      </Button>
    </div>
  );
}

function DownloadsEditorFields({
  payload,
  onChange,
}: {
  payload: DownloadsBlockPayload;
  onChange: (next: DownloadsBlockPayload) => void;
}) {
  const items = payload.items ?? [];
  return (
    <div className="space-y-3">
      <Field label="Section title">
        <Input
          className={cmsFieldClass}
          value={payload.sectionTitle ?? ""}
          onChange={(e) =>
            onChange({ ...payload, sectionTitle: e.target.value })
          }
        />
      </Field>
      {items.map((item, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-[#E5EBF3] bg-white p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              File {i + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={items.length <= 1}
              onClick={() =>
                onChange({
                  ...payload,
                  items: items.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
          <Input
            className={cmsFieldClass}
            placeholder="Title"
            value={item.title}
            onChange={(e) => {
              const next = items.map((row, j) =>
                j === i ? { ...row, title: e.target.value } : row
              );
              onChange({ ...payload, items: next });
            }}
          />
          <Input
            className={cmsFieldClass}
            placeholder="Description (optional)"
            value={item.description ?? ""}
            onChange={(e) => {
              const next = items.map((row, j) =>
                j === i ? { ...row, description: e.target.value } : row
              );
              onChange({ ...payload, items: next });
            }}
          />
          <Input
            className={cmsFieldClass}
            placeholder="Media asset ID"
            value={item.mediaId}
            onChange={(e) => {
              const next = items.map((row, j) =>
                j === i ? { ...row, mediaId: e.target.value } : row
              );
              onChange({ ...payload, items: next });
            }}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...payload,
            items: [
              ...items,
              { title: "", description: "", mediaId: "", fileName: "" },
            ],
          })
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add download
      </Button>
    </div>
  );
}

function CalloutEditorFields({
  payload,
  onChange,
}: {
  payload: CalloutBannerBlockPayload;
  onChange: (next: CalloutBannerBlockPayload) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title">
        <Input
          className={cmsFieldClass}
          value={payload.title}
          onChange={(e) => onChange({ ...payload, title: e.target.value })}
        />
      </Field>
      <Field label="CTA label">
        <Input
          className={cmsFieldClass}
          value={payload.ctaLabel}
          onChange={(e) => onChange({ ...payload, ctaLabel: e.target.value })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Body">
          <Textarea
            className={cmsFieldClass}
            rows={3}
            value={payload.body ?? ""}
            onChange={(e) => onChange({ ...payload, body: e.target.value })}
          />
        </Field>
      </div>
      <Field label="CTA link">
        <Input
          className={cmsFieldClass}
          value={payload.ctaHref}
          onChange={(e) => onChange({ ...payload, ctaHref: e.target.value })}
        />
      </Field>
      <Field label="Background image URL">
        <Input
          className={cmsFieldClass}
          value={payload.backgroundImageUrl ?? ""}
          onChange={(e) =>
            onChange({ ...payload, backgroundImageUrl: e.target.value })
          }
        />
      </Field>
      <Field label="Background media ID (optional)">
        <Input
          className={cmsFieldClass}
          value={payload.backgroundMediaId ?? ""}
          onChange={(e) =>
            onChange({
              ...payload,
              backgroundMediaId: e.target.value || null,
            })
          }
        />
      </Field>
    </div>
  );
}

type CreateForm = {
  title: string;
  slug: string;
  metaDescription: string;
  status: "DRAFT" | "PUBLISHED";
  starterBlock: CustomBlockType | "NONE";
};

const EMPTY_CREATE_FORM: CreateForm = {
  title: "",
  slug: "",
  metaDescription: "",
  status: "DRAFT",
  starterBlock: "RICH_TEXT_BLOCK",
};

export function AdminCmsCustomPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<CmsPage | null>(null);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [meta, setMeta] = useState({
    title: "",
    slug: "",
    metaDescription: "",
    titleSo: "",
    titleAr: "",
    metaDescriptionSo: "",
    metaDescriptionAr: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [addType, setAddType] = useState<CustomBlockType>("RICH_TEXT_BLOCK");

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsPage[] }>(
        "/admin/cms/pages?scope=custom"
      );
      setPages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load custom pages"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function selectPage(id: string) {
    setSelectedId(id);
    setSaving(false);
    try {
      const p = await api<CmsPage>(`/admin/cms/pages/${id}`);
      setPage(p);
      setMeta({
        title: p.titleEn ?? p.title ?? "",
        slug: p.slug,
        metaDescription: p.metaDescriptionEn ?? p.metaDescription ?? "",
        titleSo: p.titleSo ?? "",
        titleAr: p.titleAr ?? "",
        metaDescriptionSo: p.metaDescriptionSo ?? "",
        metaDescriptionAr: p.metaDescriptionAr ?? "",
      });
      setBlocks(blocksFromPage(p));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load page"
      );
    }
  }

  async function createPage() {
    if (!createForm.title.trim() || !createForm.slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    setSaving(true);
    try {
      const created = await api<CmsPage>("/admin/cms/pages", {
        method: "POST",
        body: JSON.stringify({
          title: createForm.title.trim(),
          slug: createForm.slug.trim(),
          metaDescription: createForm.metaDescription.trim() || null,
          customPage: true,
          status: "DRAFT",
        }),
      });

      if (createForm.starterBlock !== "NONE") {
        await api<CmsPage>(`/admin/cms/pages/${created.id}/blocks`, {
          method: "PUT",
          body: JSON.stringify({
            blocks: [
              {
                blockType: createForm.starterBlock,
                schemaVersion: 1,
                sortOrder: 0,
                payload: defaultPayload(createForm.starterBlock),
              },
            ],
          }),
        });
      }

      if (createForm.status === "PUBLISHED") {
        await api(`/admin/cms/pages/${created.id}/publish`, { method: "POST" });
        toast.success("Custom page created and published");
      } else {
        toast.success("Custom page created as draft");
      }

      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      await loadList();
      await selectPage(created.id);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to create page"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMeta() {
    if (!page) return;
    setSaving(true);
    try {
      const updated = await api<CmsPage>(`/admin/cms/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: meta.title.trim(),
          slug: meta.slug.trim(),
          metaDescription: meta.metaDescription.trim() || null,
          titleSo: meta.titleSo.trim() || null,
          titleAr: meta.titleAr.trim() || null,
          metaDescriptionSo: meta.metaDescriptionSo.trim() || null,
          metaDescriptionAr: meta.metaDescriptionAr.trim() || null,
          customPage: true,
        }),
      });
      setPage(updated);
      toast.success("Page details saved");
      await loadList();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save page details"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveBlocks(thenPublish: boolean) {
    if (!page) return;
    setSaving(true);
    try {
      const payload = {
        blocks: blocks.map((b, i) => ({
          blockType: b.blockType,
          schemaVersion: b.schemaVersion || 1,
          sortOrder: i,
          payload: b.payload,
        })),
      };
      const updated = await api<CmsPage>(
        `/admin/cms/pages/${page.id}/blocks`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      setPage(updated);
      setBlocks(blocksFromPage(updated));

      if (thenPublish) {
        const published = await api<CmsPage>(
          `/admin/cms/pages/${page.id}/publish`,
          { method: "POST" }
        );
        setPage(published);
        toast.success("Page published");
      } else {
        toast.success("Blocks saved as draft");
      }
      await loadList();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save blocks"
      );
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    if (!page) return;
    setSaving(true);
    try {
      const updated = await api<CmsPage>(
        `/admin/cms/pages/${page.id}/unpublish`,
        { method: "POST" }
      );
      setPage(updated);
      toast.success("Page unpublished (draft)");
      await loadList();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to unpublish"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePage(id: string) {
    if (!confirm("Delete this custom page permanently?")) return;
    try {
      await api(`/admin/cms/pages/${id}`, { method: "DELETE" });
      toast.success("Page deleted");
      if (selectedId === id) {
        setSelectedId(null);
        setPage(null);
        setBlocks([]);
      }
      await loadList();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete page"
      );
    }
  }

  function updateBlockPayload(key: string, next: Record<string, unknown>) {
    setBlocks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, payload: next } : b))
    );
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      {
        key: makeKey(),
        blockType: addType,
        schemaVersion: 1,
        sortOrder: prev.length,
        payload: defaultPayload(addType),
      },
    ]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Custom Pages"
          description="Build published pages at /pages/:slug with rich text, FAQ, downloads, and callout blocks."
        />
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadList()}
            disabled={loading || saving}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Reload
          </Button>
          <Button
            type="button"
            size="sm"
            className={cmsBtnPublishClass}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New page
          </Button>
        </div>
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Custom pages
          </CardTitle>
          <CardDescription>
            System routes (home, about, …) are excluded. Public URL:{" "}
            <code className="text-xs">/pages/your-slug</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : pages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No custom pages yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow
                    key={p.id}
                    className={
                      selectedId === p.id ? "bg-[#002147]/5" : undefined
                    }
                  >
                    <TableCell className="font-semibold text-[#002147]">
                      {p.title}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "PUBLISHED" ? "success" : "warning"
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void selectPage(p.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            `/pages/${p.slug}`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void deletePage(p.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {page ? (
        <>
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base text-[#002147]">
                    Page details
                  </CardTitle>
                  <Badge
                    variant={
                      page.status === "PUBLISHED" ? "success" : "warning"
                    }
                  >
                    {page.status}
                  </Badge>
                </div>
                <CardDescription>
                  English is the default; SO/AR fall back when empty.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title">
                  <Input
                    className={cmsFieldClass}
                    value={meta.title}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, title: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Slug">
                  <Input
                    className={cmsFieldClass}
                    value={meta.slug}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, slug: e.target.value }))
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Meta description">
                    <Textarea
                      className={cmsFieldClass}
                      rows={2}
                      value={meta.metaDescription}
                      onChange={(e) =>
                        setMeta((m) => ({
                          ...m,
                          metaDescription: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Title (SO)">
                  <Input
                    className={cmsFieldClass}
                    value={meta.titleSo}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, titleSo: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Title (AR)">
                  <Input
                    className={cmsFieldClass}
                    dir="rtl"
                    value={meta.titleAr}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, titleAr: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Meta (SO)">
                  <Textarea
                    className={cmsFieldClass}
                    rows={2}
                    value={meta.metaDescriptionSo}
                    onChange={(e) =>
                      setMeta((m) => ({
                        ...m,
                        metaDescriptionSo: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Meta (AR)">
                  <Textarea
                    className={cmsFieldClass}
                    dir="rtl"
                    rows={2}
                    value={meta.metaDescriptionAr}
                    onChange={(e) =>
                      setMeta((m) => ({
                        ...m,
                        metaDescriptionAr: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cmsBtnDraftClass}
                  disabled={saving}
                  onClick={() => void saveMeta()}
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  Save details
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={cmsBtnPublishClass}
                  disabled={saving}
                  onClick={() => void saveBlocks(true)}
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  Publish
                </Button>
                {page.status === "PUBLISHED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void unpublish()}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" />
                    Unpublish
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Block builder
              </CardTitle>
              <CardDescription>
                Add, reorder, and edit content blocks. Save draft before
                publishing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-56">
                  <Field label="Block type">
                    <Select
                      value={addType}
                      onValueChange={(v) =>
                        setAddType(v as CustomBlockType)
                      }
                    >
                      <SelectTrigger className={cmsFieldClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOM_BLOCK_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {blockLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addBlock}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add block
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={cmsBtnDraftClass}
                  disabled={saving}
                  onClick={() => void saveBlocks(false)}
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  Save blocks
                </Button>
              </div>

              {blocks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No blocks yet. Add a rich text, FAQ, downloads, or callout
                  block.
                </p>
              ) : (
                <div className="space-y-4">
                  {blocks.map((block, index) => (
                    <div
                      key={block.key}
                      className="rounded-xl border border-[#E5EBF3] bg-[#FAFBFD] p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="info">
                          {index + 1}. {blockLabel(block.blockType)}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === 0}
                            onClick={() => moveBlock(index, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === blocks.length - 1}
                            onClick={() => moveBlock(index, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setBlocks((prev) =>
                                prev.filter((b) => b.key !== block.key)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {block.blockType === "RICH_TEXT_BLOCK" ? (
                        <RichTextEditorFields
                          payload={block.payload as RichTextBlockPayload}
                          onChange={(next) =>
                            updateBlockPayload(
                              block.key,
                              next as Record<string, unknown>
                            )
                          }
                        />
                      ) : null}
                      {block.blockType === "FAQ_ACCORDION_BLOCK" ? (
                        <FaqEditorFields
                          payload={
                            block.payload as FaqAccordionBlockPayload
                          }
                          onChange={(next) =>
                            updateBlockPayload(
                              block.key,
                              next as Record<string, unknown>
                            )
                          }
                        />
                      ) : null}
                      {block.blockType === "DOWNLOADS_BLOCK" ? (
                        <DownloadsEditorFields
                          payload={block.payload as DownloadsBlockPayload}
                          onChange={(next) =>
                            updateBlockPayload(
                              block.key,
                              next as Record<string, unknown>
                            )
                          }
                        />
                      ) : null}
                      {block.blockType === "CALLOUT_BANNER_BLOCK" ? (
                        <CalloutEditorFields
                          payload={
                            block.payload as CalloutBannerBlockPayload
                          }
                          onChange={(next) =>
                            updateBlockPayload(
                              block.key,
                              next as Record<string, unknown>
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={cmsDialogContentClass}>
          <DialogHeader>
            <DialogTitle>Create Custom Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Title">
              <Input
                className={cmsFieldClass}
                value={createForm.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setCreateForm((f) => ({
                    ...f,
                    title,
                    slug: slugifyTitle(title),
                  }));
                }}
                placeholder="e.g. Student Resources"
              />
            </Field>
            <Field label="Slug (auto-generated)">
              <Input
                className={cmsFieldClass}
                value={createForm.slug}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder="student-resources"
              />
            </Field>
            <Field label="Meta description">
              <Textarea
                className={cmsFieldClass}
                rows={2}
                value={createForm.metaDescription}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    metaDescription: e.target.value,
                  }))
                }
                placeholder="Short SEO / share description"
              />
            </Field>
            <Field label="Status">
              <Select
                value={createForm.status}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    status: v as "DRAFT" | "PUBLISHED",
                  }))
                }
              >
                <SelectTrigger className={cmsFieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">DRAFT</SelectItem>
                  <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Starter block (Block Builder)">
              <Select
                value={createForm.starterBlock}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    starterBlock: v as CreateForm["starterBlock"],
                  }))
                }
              >
                <SelectTrigger className={cmsFieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None — add blocks later</SelectItem>
                  {CUSTOM_BLOCK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {blockLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                After create you can add, reorder, and edit FAQ, Downloads, Rich
                Text, and Callout blocks in the editor.
              </p>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cmsBtnPublishClass}
              disabled={saving}
              onClick={() => void createPage()}
            >
              {createForm.status === "PUBLISHED"
                ? "Create & publish"
                : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
