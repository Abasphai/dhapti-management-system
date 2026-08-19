import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import {
  AdmissionHelpDesk,
  Navbar,
  HeroSection,
  SecondaryHeroSection,
  WhyChooseSection,
  FacultiesGrid,
  NewsEventsSection,
  Footer,
  ScrollToTopButton,
} from "../../components/common";
import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { DHAPTI_IMAGES } from "@/data/publicSite";
import { CmsText } from "@/components/cms/SafeHtml";
import {
  FALLBACK_HERO_SLIDES,
  FALLBACK_RECTOR,
  FALLBACK_WHY_CHOOSE,
  fetchPublishedCmsPage,
  findBlockPayload,
  normalizeHeroSlides,
  type HeroSlide,
  type RectorPayload,
  type WhyChoosePayload,
} from "@/lib/cmsPageContent";
import { cn } from "@/lib/utils";

export const HomePage = () => {
  const { accentColor, contentWidth } = useLayout();
  const { t, translateLabel, dir } = useLanguage();
  const [slides, setSlides] = useState<HeroSlide[]>(FALLBACK_HERO_SLIDES);
  const [why, setWhy] = useState<WhyChoosePayload>(FALLBACK_WHY_CHOOSE);
  const [rector, setRector] = useState<RectorPayload>(FALLBACK_RECTOR);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await fetchPublishedCmsPage("home");
      if (cancelled || !page?.blocks?.length) return;

      const heroPayload = findBlockPayload<{ slides: HeroSlide[] }>(
        page,
        "HERO_SLIDER"
      );
      const whyPayload = findBlockPayload<WhyChoosePayload>(page, "WHY_CHOOSE");
      const rectorPayload = findBlockPayload<RectorPayload>(
        page,
        "RECTOR_MESSAGE"
      );

      if (heroPayload?.slides?.length) {
        setSlides(normalizeHeroSlides(heroPayload.slides));
      }
      if (whyPayload?.stats?.length && whyPayload?.features?.length) {
        setWhy(whyPayload);
      }
      if (rectorPayload?.name && rectorPayload?.message) {
        setRector(rectorPayload);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="site-shell min-h-screen bg-white transition-colors dark:bg-slate-950"
      style={{ ["--portal-accent" as string]: accentColor }}
    >
      <Navbar />

      <HeroSection slides={slides} />
      <SecondaryHeroSection />

      <main
        className={cn(
          contentWidth === "Centered" && "mx-auto w-full max-w-7xl"
        )}
      >
        <section className="py-16 md:py-24 dark:bg-slate-950">
          <WhyChooseSection data={why} />
        </section>

        <section
          id="faculties"
          className="scroll-mt-24 bg-gray-50 py-16 transition-colors dark:bg-slate-900"
        >
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-black uppercase tracking-tight text-[#002147] dark:text-slate-100">
                {t("faculties.heading")}
              </h2>
              <div
                className="mx-auto h-1.5 w-24 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-slate-400">
                {t("faculties.subheading")}
              </p>
            </div>
            <FacultiesGrid />
          </div>
        </section>

        <section className="py-16 md:py-24 dark:bg-slate-950">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group grid overflow-hidden rounded-3xl bg-[#002147] shadow-2xl md:grid-cols-[280px_1fr]"
            >
              <div className="relative h-64 w-full overflow-hidden bg-slate-800 md:h-auto md:min-h-full">
                <img
                  src={rector.photoUrl}
                  alt={rector.name}
                  className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="relative overflow-hidden p-8 text-white md:p-12">
                <img
                  src={DHAPTI_IMAGES.campus}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-10"
                />
                <div className={`relative z-10 ${dir === "rtl" ? "text-right" : ""}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#ea580c]">
                    {translateLabel(rector.eyebrow || "Leadership")}
                  </p>
                  <h2 className="mt-3 text-3xl font-black md:text-4xl">
                    {translateLabel(
                      rector.heading || "Message from the University Rector"
                    )}
                  </h2>
                  <CmsText
                    value={
                      translateLabel(rector.message) ||
                      t("rector.message")
                    }
                    className="mt-5 max-w-2xl whitespace-pre-line leading-relaxed text-white/85 [&_a]:text-[#ea580c] [&_p]:mb-3 last:[&_p]:mb-0"
                  />
                  <p className="mt-6 font-bold">{rector.name}</p>
                  <p className="text-sm text-[#ea580c]">
                    {translateLabel(rector.title)}
                  </p>
                  <Link
                    to={rector.ctaHref || "/about"}
                    className="mt-6 inline-flex rounded-xl border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:border-white"
                  >
                    {translateLabel(
                      rector.ctaLabel || "Learn more about Dhapti"
                    )}
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16 md:py-24 dark:bg-slate-950">
          <NewsEventsSection />
        </section>

        <section className="relative overflow-hidden bg-[#002147] py-20 text-center text-white">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="container relative z-10 mx-auto px-4">
            <h2 className="mb-6 text-4xl font-black uppercase md:text-5xl">
              {t("home.cta.title")}
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-gray-300">
              {t("home.cta.body")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/admissions"
                className="rounded-xl px-10 py-4 text-lg font-bold text-white shadow-xl transition-all active:scale-95"
                style={{ backgroundColor: accentColor }}
              >
                {t("home.cta.apply")}
              </Link>
              <Link
                to="/faculties"
                className="rounded-xl border-2 border-white/30 px-10 py-4 text-lg font-bold text-white transition-all hover:border-white"
              >
                {t("btn.exploreFaculties")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ScrollToTopButton />
      <AdmissionHelpDesk />
    </div>
  );
};
