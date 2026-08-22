import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";

const SECONDARY_HERO_IMAGE =
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1920&auto=format&fit=crop";

export function SecondaryHeroSection() {
  const { t, dir } = useLanguage();
  const { contentWidthClass } = useLayout();

  return (
    <section className="relative w-full min-h-[70vh] overflow-hidden bg-black">
      <img
        src={SECONDARY_HERO_IMAGE}
        alt="Dhapti academic campus"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />

      <div className="relative z-10 flex min-h-[70vh] items-center">
        <div className={cn("layout-content-width py-20 md:py-28", contentWidthClass)}>
          <div className={`max-w-3xl ${dir === "rtl" ? "ms-auto" : ""}`}>
            <h2 className="text-3xl font-black uppercase leading-tight tracking-tight text-[#ea580c] drop-shadow-lg md:text-5xl lg:text-6xl">
              {t("secondary.title")}
            </h2>
            <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-white md:text-xl">
              {t("secondary.body")}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/admissions"
                className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-8 py-3.5 text-base font-bold text-white shadow-xl transition-all hover:bg-[#15803d] hover:scale-[1.02] active:scale-95 md:text-lg"
              >
                {t("btn.applyNow")}
                <ArrowRight
                  className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`}
                />
              </Link>
              <a
                href="#faculties"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/5 px-8 py-3.5 text-base font-bold text-white backdrop-blur-sm transition-all hover:border-white hover:bg-white/10 md:text-lg"
              >
                {t("btn.exploreFaculties")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
