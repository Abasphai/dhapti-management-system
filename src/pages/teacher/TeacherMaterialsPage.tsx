import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Link2,
  Presentation,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { FileDropzone } from "@/components/common/FileDropzone";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { api, apiUpload, ApiError } from "@/lib/api";

type MaterialType =
  | "PDF"
  | "POWERPOINT"
  | "WORD"
  | "ARCHIVE"
  | "AUDIO"
  | "VIDEO"
  | "LINK";

interface ClassOption {
  id: string;
  courseId: string;
  section: string;
  academicYear: string;
  semester: string;
  courseCode: string;
  courseTitle: string;
}

interface CourseOption {
  courseId: string;
  code: string;
  title: string;
}

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  materialType: MaterialType;
  fileName: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  fileUrl: string | null;
  createdAt: string;
  course?: { id: string; code: string; title: string };
  classSection?: { section: string } | null;
}

interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const MATERIAL_TYPE_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: "PDF", label: "PDF" },
  { value: "POWERPOINT", label: "PowerPoint" },
  { value: "WORD", label: "Word Document" },
  { value: "ARCHIVE", label: "ZIP/RAR Archive" },
  { value: "AUDIO", label: "Audio Recording" },
  { value: "VIDEO", label: "Video Lecture" },
  { value: "LINK", label: "External Web Link" },
];

const ACCEPT_BY_TYPE: Record<Exclude<MaterialType, "LINK">, string> = {
  PDF: ".pdf",
  POWERPOINT: ".ppt,.pptx",
  WORD: ".doc,.docx",
  ARCHIVE: ".zip,.rar,.7z",
  AUDIO: ".mp3,.wav,.m4a,.ogg",
  VIDEO: ".mp4,.webm,.mov",
};

function formatBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TypeIcon({ type }: { type: MaterialType }) {
  const className = "h-4 w-4";
  if (type === "PDF") return <FileText className={`${className} text-red-600`} />;
  if (type === "POWERPOINT")
    return <Presentation className={`${className} text-orange-600`} />;
  if (type === "WORD") return <FileText className={`${className} text-blue-600`} />;
  if (type === "ARCHIVE")
    return <FileArchive className={`${className} text-amber-700`} />;
  if (type === "AUDIO")
    return <FileAudio className={`${className} text-violet-600`} />;
  if (type === "VIDEO")
    return <FileVideo className={`${className} text-emerald-600`} />;
  return <Link2 className={`${className} text-[#002147]`} />;
}

const emptyForm = {
  courseId: "",
  classSectionId: "ALL",
  title: "",
  description: "",
  materialType: "PDF" as MaterialType,
  linkUrl: "",
};

export function TeacherMaterialsPage() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const classOptionsForCourse = useMemo(
    () => classes.filter((c) => c.courseId === form.courseId),
    [classes, form.courseId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (courseFilter !== "ALL") params.set("courseId", courseFilter);
      if (typeFilter !== "ALL") params.set("materialType", typeFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await api<ListResponse<MaterialRow>>(
        `/materials/me?${params}`
      );
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load materials"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, courseFilter, typeFilter, query]);

  useEffect(() => {
    void api<{ data: CourseOption[] }>("/teachers/me/courses")
      .then((res) => setCourses(res.data))
      .catch(() => setCourses([]));
    void api<{ data: ClassOption[] }>("/teachers/me/classes")
      .then((res) => setClasses(res.data))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openUpload = () => {
    setForm({
      ...emptyForm,
      courseId: courses[0]?.courseId ?? "",
    });
    setFile(null);
    setProgress(null);
    setActionError(null);
    setDialogOpen(true);
  };

  const submitUpload = async () => {
    if (!form.courseId) {
      setActionError("Select a course.");
      return;
    }
    if (form.title.trim().length < 2) {
      setActionError("Title is required (min 2 characters).");
      return;
    }
    if (form.materialType === "LINK") {
      if (!form.linkUrl.trim()) {
        setActionError("External link URL is required.");
        return;
      }
    } else if (!file) {
      setActionError("Please attach a file (max 500MB).");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append("title", form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("courseId", form.courseId);
      fd.append("materialType", form.materialType);
      if (form.classSectionId !== "ALL") {
        fd.append("classSectionId", form.classSectionId);
      }
      if (form.materialType === "LINK") {
        fd.append("linkUrl", form.linkUrl.trim());
      } else if (file) {
        fd.append("file", file);
      }

      await apiUpload("/materials/upload", fd, setProgress);
      toast.success("Course material uploaded");
      setDialogOpen(false);
      setFile(null);
      setProgress(null);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Upload failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteMaterial = async (row: MaterialRow) => {
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return;
    try {
      await api(`/materials/${row.id}`, { method: "DELETE" });
      toast.success("Material deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete material"
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Education Materials"
          description="Upload and share PDFs, slides, archives, audio, video, and external links with your classes."
        />
        <Button
          className="shrink-0 bg-[#002147] text-white hover:bg-[#003366]"
          onClick={openUpload}
        >
          <Plus className="h-4 w-4" />
          Upload Course Material
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          placeholder="Search by title…"
          className="h-10 sm:max-w-xs"
        />
        <Select
          value={courseFilter}
          onValueChange={(v) => {
            setCourseFilter(v);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="h-10 w-full sm:w-56">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.courseId} value={c.courseId}>
                {c.code} — {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="h-10 w-full sm:w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {MATERIAL_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="border-b border-[#E5EBF3] pb-4">
          <h2 className="text-lg font-bold text-[#002147]">Uploaded materials</h2>
          <p className="text-sm text-muted-foreground">
            {pagination.total} item{pagination.total === 1 ? "" : "s"}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              Loading materials…
            </p>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                icon={Archive}
                title="No materials yet"
                description="Upload lecture notes, slides, recordings, or links for your students."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                  <TableHead className="pl-6">Material</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-start gap-2">
                        <TypeIcon type={row.materialType} />
                        <div>
                          <p className="font-semibold text-[#002147]">
                            {row.title}
                          </p>
                          {row.description && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {row.description}
                            </p>
                          )}
                          {row.fileName && (
                            <p className="text-[11px] text-slate-500">
                              {row.fileName}
                            </p>
                          )}
                          {row.linkUrl && (
                            <p className="truncate text-[11px] text-[#16a34a]">
                              {row.linkUrl}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-semibold">
                        {row.course?.code ?? "—"}
                      </p>
                      {row.classSection && (
                        <p className="text-xs text-muted-foreground">
                          Sec {row.classSection.section}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.materialType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.materialType === "LINK"
                        ? "Link"
                        : formatBytes(row.fileSize)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => void deleteMaterial(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.page <= 1}
          onClick={() =>
            setPagination((p) => ({ ...p, page: p.page - 1 }))
          }
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() =>
            setPagination((p) => ({ ...p, page: p.page + 1 }))
          }
        >
          Next
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="font-bold text-[#002147]">
              Upload Course Material
            </DialogTitle>
            <DialogDescription className="font-semibold text-slate-600">
              Share files (up to 500MB) or an external link with enrolled students.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {actionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {actionError}
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[#002147]">
                Course
              </span>
              <Select
                value={form.courseId || undefined}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    courseId: v,
                    classSectionId: "ALL",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.courseId} value={c.courseId}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[#002147]">
                Class (optional)
              </span>
              <Select
                value={form.classSectionId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, classSectionId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All my sections for course</SelectItem>
                  {classOptionsForCourse.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Sec {c.section} · {c.academicYear} · {c.semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[#002147]">
                Title
              </span>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Week 3 Lecture Slides"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[#002147]">
                Description
              </span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                placeholder="Optional notes for students…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#002147] outline-none focus:ring-2 focus:ring-[#ea580c]/30"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[#002147]">
                Material Type
              </span>
              <Select
                value={form.materialType}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    materialType: v as MaterialType,
                    linkUrl: "",
                  }));
                  setFile(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {form.materialType === "LINK" ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[#002147]">
                  External Link URL
                </span>
                <Input
                  type="url"
                  value={form.linkUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, linkUrl: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </label>
            ) : (
              <FileDropzone
                label="Attach material file (Max 500MB)"
                file={file}
                onFileChange={setFile}
                progress={progress}
                disabled={saving}
                accept={ACCEPT_BY_TYPE[form.materialType]}
                hint={`Allowed for ${form.materialType}: ${ACCEPT_BY_TYPE[form.materialType]} · Max 500MB`}
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#16a34a] text-white hover:bg-[#15803d]"
              disabled={saving}
              onClick={() => void submitUpload()}
            >
              {saving ? "Uploading…" : "Upload Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
