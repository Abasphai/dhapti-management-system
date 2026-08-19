import { cn } from "@/lib/utils";

export type FittedImageVariant =
  | "video"
  | "banner"
  | "square"
  | "hero"
  | "thumb"
  | "preview";

const FRAME: Record<FittedImageVariant, string> = {
  /** News & event covers */
  video:
    "relative w-full aspect-video overflow-hidden rounded-t-2xl bg-slate-800/50 md:aspect-[16/9]",
  /** Faculty / program banners */
  banner:
    "relative w-full aspect-[21/9] overflow-hidden rounded-2xl bg-slate-800/50 md:aspect-[16/9]",
  /** Profile / candidate photos */
  square:
    "relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-800",
  /** Full-bleed hero slide plane */
  hero: "absolute inset-0 overflow-hidden bg-slate-900",
  /** Compact event sidebar / grid thumbs */
  thumb:
    "relative w-full aspect-video overflow-hidden rounded-xl bg-slate-800/50",
  /** CMS admin cover preview (how it will look live) */
  preview:
    "relative w-full aspect-video overflow-hidden rounded-xl border border-[#E5EBF3] bg-slate-100",
};

type FittedImageProps = {
  src: string;
  alt?: string;
  variant?: FittedImageVariant;
  className?: string;
  imgClassName?: string;
  /** Enable hover zoom (use with parent `group` class) */
  zoomOnHover?: boolean;
  objectPosition?: string;
};

/**
 * Overflow-safe image frame: fixed aspect ratio + object-cover.
 * Prevents stretch/distortion for any uploaded portrait/landscape asset.
 */
export function FittedImage({
  src,
  alt = "",
  variant = "video",
  className,
  imgClassName,
  zoomOnHover = true,
  objectPosition,
}: FittedImageProps) {
  return (
    <div className={cn(FRAME[variant], className)}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className={cn(
          "h-full w-full object-cover object-center",
          zoomOnHover && "transition-transform duration-500 group-hover:scale-105",
          objectPosition,
          imgClassName
        )}
      />
    </div>
  );
}
