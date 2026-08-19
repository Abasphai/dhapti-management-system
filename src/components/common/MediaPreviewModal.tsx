import { useEffect, useState } from "react";
import { Download, Eye, FileText, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiBlobUrl, ApiError } from "@/lib/api";

export type MediaPreviewKind = "PDF" | "AUDIO" | "VIDEO";

type MediaPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  kind: MediaPreviewKind;
  /** API path relative to /api, e.g. `/materials/:id/file?inline=1` */
  filePath: string;
  onDownload?: () => void;
};

export function MediaPreviewModal({
  open,
  onOpenChange,
  title,
  subtitle,
  kind,
  filePath,
  onDownload,
}: MediaPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);
    void apiBlobUrl(filePath)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        revoked = blobUrl;
        setUrl(blobUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load preview"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, filePath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-bold text-[#002147]">
            <Eye className="h-5 w-5 text-[#ea580c]" />
            {title}
          </DialogTitle>
          {subtitle && (
            <DialogDescription className="font-semibold text-slate-600">
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-[240px] rounded-2xl border border-[#E5EBF3] bg-[#F4F7FB] p-3">
          {loading && (
            <div className="flex h-60 items-center justify-center gap-2 text-sm font-semibold text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-[#ea580c]" />
              Loading preview…
            </div>
          )}
          {error && (
            <div className="flex h-60 flex-col items-center justify-center gap-2 px-4 text-center">
              <FileText className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-semibold text-red-600">{error}</p>
            </div>
          )}
          {!loading && !error && url && kind === "PDF" && (
            <iframe
              title={title}
              src={url}
              className="h-[60vh] w-full rounded-xl bg-white"
            />
          )}
          {!loading && !error && url && kind === "AUDIO" && (
            <div className="flex h-60 flex-col items-center justify-center gap-4 px-4">
              <audio controls src={url} className="w-full max-w-xl" />
            </div>
          )}
          {!loading && !error && url && kind === "VIDEO" && (
            <video
              controls
              src={url}
              className="max-h-[60vh] w-full rounded-xl bg-black"
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          {onDownload && (
            <Button
              className="bg-[#002147] text-white hover:bg-[#16a34a]"
              onClick={onDownload}
            >
              <Download className="h-4 w-4" />
              Download File
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
