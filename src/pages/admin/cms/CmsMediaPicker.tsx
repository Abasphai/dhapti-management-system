import { useCallback, useEffect, useState } from "react";
import { Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FittedImage } from "@/components/common/FittedImage";
import {
  cmsBtnCancelClass,
  cmsBtnPublishNavyClass,
} from "@/components/cms/cmsModalStyles";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import type { CmsMediaAsset } from "@/lib/cmsNewsEvents";
import { cn } from "@/lib/utils";

export function CmsMediaPicker({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;
  onSelect: (asset: CmsMediaAsset | null) => void;
}) {
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(value);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CmsMediaAsset[] }>("/admin/cms/media");
      setAssets(
        (res.data ?? []).filter((a) => a.mimeType.startsWith("image/"))
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load media library"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(value);
      void load();
    }
  }, [open, value, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose from Media Library</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading media…
          </p>
        ) : assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5EBF3] py-10 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No images yet. Upload assets in Media Library first.
          </div>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {assets.map((asset) => {
              const active = selected === asset.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelected(asset.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-slate-50 text-left",
                    active
                      ? "border-[#ea580c] ring-2 ring-[#ea580c]/30"
                      : "border-[#E5EBF3]"
                  )}
                >
                  <FittedImage
                    src={asset.url}
                    alt={asset.altText || asset.originalName}
                    variant="thumb"
                    className="rounded-none rounded-t-xl"
                  />
                  <p className="truncate px-2 py-1.5 text-[11px] font-medium text-[#002147]">
                    {asset.originalName}
                  </p>
                  {active ? (
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-[#ea580c] p-1 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className={cmsBtnCancelClass}
            onClick={() => {
              onSelect(null);
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            className={cmsBtnPublishNavyClass}
            onClick={() => {
              const asset = assets.find((a) => a.id === selected) ?? null;
              onSelect(asset);
              onOpenChange(false);
            }}
          >
            Use selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
