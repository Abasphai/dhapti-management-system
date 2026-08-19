import { useCallback, useEffect, useState } from "react";
import { Copy, Image as ImageIcon, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { FileDropzone } from "@/components/common/FileDropzone";
import { FittedImage } from "@/components/common/FittedImage";
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
import { ApiError, api, apiUpload } from "@/lib/api";
import type { CmsMediaAsset } from "@/lib/cmsNewsEvents";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminCmsMediaPage() {
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsMediaAsset[] }>("/admin/cms/media");
      setAssets(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load media library"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload() {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiUpload<CmsMediaAsset>("/admin/cms/media", formData, (p) =>
        setProgress(p)
      );
      toast.success("Media uploaded successfully!");
      setFile(null);
      setProgress(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to upload media"
      );
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function onDelete(asset: CmsMediaAsset) {
    if (!window.confirm(`Delete “${asset.originalName}”?`)) return;
    try {
      await api(`/admin/cms/media/${asset.id}`, { method: "DELETE" });
      toast.success("Media deleted");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete media"
      );
    }
  }

  async function copyUrl(asset: CmsMediaAsset) {
    try {
      const absolute = `${window.location.origin}${asset.url}`;
      await navigator.clipboard.writeText(absolute);
      toast.success("Image URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Media Library"
          description="Upload reusable images and PDFs for news covers, events, and page blocks."
        />
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
      </div>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-[#002147]">Upload</CardTitle>
              <Badge variant="info">cms.media.*</Badge>
            </div>
            <CardDescription className="mt-1">
              Images (PNG/JPG/WebP/GIF) and PDFs. Assets are reusable across CMS
              editors.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            label="Drop image or PDF"
            file={file}
            onFileChange={setFile}
            progress={progress}
            disabled={uploading}
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,image/*,application/pdf"
            hint="Images and PDFs only"
          />
          <Button
            type="button"
            onClick={() => void onUpload()}
            disabled={!file || uploading}
            className="bg-[#002147] text-white hover:bg-[#003366]"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? "Uploading…" : "Upload to library"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Library assets
          </CardTitle>
          <CardDescription>
            Preview, copy public URL, or delete unused assets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading media…
            </p>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E5EBF3] py-12 text-center text-sm text-muted-foreground">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No media uploaded yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset) => {
                const isImage = asset.mimeType.startsWith("image/");
                return (
                  <div
                    key={asset.id}
                    className="group overflow-hidden rounded-xl border border-[#E5EBF3] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    {isImage ? (
                      <FittedImage
                        src={asset.url}
                        alt={asset.altText || asset.originalName}
                        variant="thumb"
                        className="rounded-none rounded-t-xl"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-[#F4F7FB] text-sm font-bold text-[#002147]">
                        PDF
                      </div>
                    )}
                    <div className="space-y-2 p-3">
                      <p className="truncate text-sm font-semibold text-[#002147] dark:text-slate-100">
                        {asset.originalName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(asset.size)} · {asset.mimeType}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => void copyUrl(asset)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy URL
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => void onDelete(asset)}
                          aria-label={`Delete ${asset.originalName}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
