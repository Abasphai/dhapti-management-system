import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  label?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  label,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-10 md:mb-12",
        align === "center" && "text-center",
        className
      )}
    >
      {label && (
        <span
          className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--portal-accent)" }}
        >
          {label}
        </span>
      )}
      <h2 className="mb-4 text-2xl font-bold text-[#002147] md:text-3xl lg:text-4xl dark:text-slate-100">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-muted-foreground md:text-lg dark:text-slate-400",
            align === "center" && "mx-auto max-w-2xl"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
