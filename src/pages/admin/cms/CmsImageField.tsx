import { useId, useRef, useState } from "react";
import { Image as ImageIcon, Library, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { FittedImage } from "@/components/common/FittedImage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, apiUpload } from "@/lib/api";
import type { CmsMediaAsset } from "@/lib/cmsNewsEvents";
import { cn } from "@/lib/utils";

import { CmsMediaPicker } from "./CmsMediaPicker";

export type CmsImageValue = {
  url: string;
  mediaId: string | null;
};

type CmsImageFieldProps = {
  label: string;
  /** Current image URL (public media URL or external path) */
  url: string | null | undefined;
  /** Optional CmsMediaAsset id when selected from library / upload */
  mediaId?: string | null;
  onChange: (next: CmsImageValue) => void;
  onClear?: () => void;
  hint?: string;
  className?: string;
  /** How the live site will crop this image */
  previewVariant?: "preview" | "video" | "banner" | "square";
};

/**
 * Visual image upload + media library picker for CMS editors.
 * Preview uses a fixed aspect box matching public cards.
 */
export function CmsImageField({
  label,
  url,
  mediaId = null,
  onChange,
  onClear,
  hint,
  className,
  previewVariant = "preview",
}: CmsImageFieldProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const preview = url?.trim() || "";

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const asset = await apiUpload<CmsMediaAsset>(
        "/admin/cms/media",
        formData
      );
      onChange({ url: asset.url, mediaId: asset.id });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to upload image"
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="flex flex-col gap-3">
        {preview ? (
          <FittedImage
            src={preview}
            alt="Cover preview"
            variant={previewVariant}
            zoomOnHover={false}
            className="max-w-xl border border-[#E5EBF3]"
          />
        ) : (
          <div
            className={cn(
              "flex aspect-video w-full max-w-xl items-center justify-center rounded-xl border border-dashed border-[#E5EBF3] bg-slate-50"
            )}
          >
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ImageIcon className="h-7 w-7" />
              <span className="text-[11px] font-medium">
                No image — preview will match live 16:9 crop
              </span>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={uploading}
              className="bg-[#002147] text-white hover:bg-[#003366]"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {uploading ? "Uploading…" : "Upload / Choose Image"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => setLibraryOpen(true)}
            >
              <Library className="mr-1.5 h-4 w-4" />
              Media Library
            </Button>
            {preview || mediaId ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={uploading}
                onClick={() => {
                  if (onClear) onClear();
                  else onChange({ url: "", mediaId: null });
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4 text-red-600" />
                Clear
              </Button>
            ) : null}
          </div>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Upload a new image or pick one from the Media Library. Preview
              shows the live-site crop (object-cover, centered).
            </p>
          )}
        </div>
      </div>

      <CmsMediaPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        value={mediaId}
        onSelect={(asset) => {
          if (!asset) {
            if (onClear) onClear();
            else onChange({ url: "", mediaId: null });
            return;
          }
          onChange({ url: asset.url, mediaId: asset.id });
        }}
      />
    </div>
  );
}
