import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Link2,
  Presentation,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import {
  MediaPreviewModal,
  type MediaPreviewKind,
} from "@/components/common/MediaPreviewModal";
import { CardGridSkeleton } from "@/components/common/TableSkeleton";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, apiDownload, ApiError } from "@/lib/api";

type MaterialType =
  | "PDF"
  | "POWERPOINT"
  | "WORD"
  | "ARCHIVE"
  | "AUDIO"
  | "VIDEO"
  | "LINK";

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
  previewable?: boolean;
  course?: { id: string; code: string; title: string };
  teacher?: { name: string; fullName?: string };
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

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "PDF", label: "PDF" },
  { value: "POWERPOINT", label: "Slides (PowerPoint)" },
  { value: "WORD", label: "Word Document" },
  { value: "ARCHIVE", label: "ZIP / Archive" },
  { value: "AUDIO", label: "Audio" },
  { value: "VIDEO", label: "Video" },
  { value: "LINK", label: "External Link" },
];

function formatBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

function TypeIcon({ type }: { type: MaterialType }) {
  const className = "h-6 w-6";
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

export function StudentEducationMaterialsPage() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 24,
    total: 0,
    totalPages: 1,
  });

  const [preview, setPreview] = useState<{
    title: string;
    subtitle: string;
    kind: MediaPreviewKind;
    path: string;
    fileName: string;
  } | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<
    Array<{ id: string; label: string }>
  >([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    void api<{
      data: Array<{
        classSection: {
          course: { id: string; code: string; title: string };
        };
      }>;
    }>("/students/me/enrollments")
      .then((res) => {
        const map = new Map<string, string>();
        for (const row of res.data) {
          const course = row.classSection?.course;
          if (course) map.set(course.id, `${course.code} — ${course.title}`);
        }
        setEnrolledCourses(
          [...map.entries()].map(([id, label]) => ({ id, label }))
        );
      })
      .catch(() => setEnrolledCourses([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (courseFilter !== "ALL") params.set("courseId", courseFilter);
      if (typeFilter !== "ALL") params.set("materialType", typeFilter);
      const res = await api<ListResponse<MaterialRow>>(
        `/student/materials?${params}`
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
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedQuery,
    courseFilter,
    typeFilter,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const courseOptions = useMemo(() => {
    if (enrolledCourses.length > 0) return enrolledCourses;
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.course) {
        map.set(row.course.id, `${row.course.code} — ${row.course.title}`);
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [enrolledCourses, rows]);

  const downloadFile = async (row: MaterialRow) => {
    if (!row.fileUrl) return;
    try {
      await apiDownload(
        `/materials/${row.id}/file`,
        row.fileName || `${row.title}.bin`
      );
      toast.success("Download started");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Download failed"
      );
    }
  };

  const openPreview = (row: MaterialRow) => {
    if (!["PDF", "AUDIO", "VIDEO"].includes(row.materialType)) {
      toast.message("Preview is available for PDF, audio, and video files.");
      return;
    }
    setPreview({
      title: row.title,
      subtitle: `${row.course?.code ?? ""} · ${row.teacher?.name || row.teacher?.fullName || "Lecturer"}`,
      kind: row.materialType as MediaPreviewKind,
      path: `/materials/${row.id}/file?inline=1`,
      fileName: row.fileName || row.title,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Education Materials"
        description="Browse, preview, and download learning materials from your enrolled courses."
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Search by lesson title or course…"
            className="h-10 pl-9"
          />
        </div>
        <Select
          value={courseFilter}
          onValueChange={(v) => {
            setCourseFilter(v);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="h-10 w-full lg:w-64">
            <SelectValue placeholder="Course / Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Courses</SelectItem>
            {courseOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
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
          <SelectTrigger className="h-10 w-full lg:w-56">
            <SelectValue placeholder="Material type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
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

      {loading && <CardGridSkeleton count={6} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No materials available"
          description="When your lecturers upload notes, slides, or recordings, they will appear here."
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card
              key={row.id}
              className="flex h-full flex-col border-[#E5EBF3] shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F7FB]">
                    <TypeIcon type={row.materialType} />
                  </div>
                  <Badge variant="secondary">{row.materialType}</Badge>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#002147]">
                    {row.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {row.course?.code} — {row.course?.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.teacher?.name || row.teacher?.fullName || "Lecturer"}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                {row.description && (
                  <p className="line-clamp-2 text-xs text-slate-600">
                    {row.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {row.materialType === "LINK"
                      ? "External link"
                      : formatBytes(row.fileSize)}
                  </span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.materialType === "LINK" && row.linkUrl ? (
                    <a
                      href={row.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#16a34a]"
                    >
                      <ExternalLink size={14} />
                      Open External Link
                    </a>
                  ) : (
                    <>
                      {row.previewable && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#002147]/20"
                          onClick={() => openPreview(row)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => void downloadFile(row)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#002147] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#16a34a]"
                      >
                        <Download size={14} />
                        Download File
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && rows.length > 0 && (
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
      )}

      <MediaPreviewModal
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.title ?? ""}
        subtitle={preview?.subtitle}
        kind={preview?.kind ?? "PDF"}
        filePath={preview?.path ?? ""}
        onDownload={
          preview
            ? () =>
                void apiDownload(
                  preview.path.replace("?inline=1", ""),
                  preview.fileName
                ).catch((err) =>
                  toast.error(
                    err instanceof ApiError ? err.message : "Download failed"
                  )
                )
            : undefined
        }
      />
    </div>
  );
}
