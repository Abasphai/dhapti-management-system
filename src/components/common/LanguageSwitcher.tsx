import { useLanguage, type Lang } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "EN" },
  { code: "so", label: "SO" },
  { code: "ar", label: "AR" },
];

type Props = {
  className?: string;
  /** Dark navy bar (mobile drawer header) vs light main bar */
  variant?: "light" | "dark";
};

export function LanguageSwitcher({
  className,
  variant = "light",
}: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border p-0.5 text-[10px] font-bold tracking-wide",
        variant === "light"
          ? "border-[#E5EBF3] bg-[#F4F7FB] text-[#002147] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          : "border-white/20 bg-white/10 text-white",
        className
      )}
    >
      {OPTIONS.map((opt, i) => {
        const active = lang === opt.code;
        return (
          <span key={opt.code} className="inline-flex items-center">
            {i > 0 && (
              <span
                className={cn(
                  "mx-0.5 h-3 w-px",
                  variant === "light"
                    ? "bg-[#E5EBF3] dark:bg-slate-700"
                    : "bg-white/25"
                )}
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => setLang(opt.code)}
              aria-pressed={active}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                active
                  ? opt.code === "ar"
                    ? "bg-[#16a34a] text-white shadow-sm"
                    : "bg-[#ea580c] text-white shadow-sm"
                  : variant === "light"
                    ? "text-[#002147]/70 hover:text-[#ea580c] dark:text-slate-300 dark:hover:text-[#ea580c]"
                    : "text-white/70 hover:text-[#ea580c]"
              )}
            >
              {opt.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
