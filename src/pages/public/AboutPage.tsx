import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { PublicPageShell } from "@/components/common/PublicPageShell";
import { FittedImage } from "@/components/common/FittedImage";
import { CmsText } from "@/components/cms/SafeHtml";
import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { DHAPTI_IMAGES, coreValues } from "@/data/publicSite";
import {
  FALLBACK_ABOUT_HERO,
  FALLBACK_HISTORY,
  FALLBACK_LEADERSHIP,
  FALLBACK_MISSION_VISION,
  fetchPublishedCmsPage,
  findBlockPayload,
  type HistoryPayload,
  type LeadershipPayload,
  type MissionVisionPayload,
} from "@/lib/cmsPageContent";
import { cn } from "@/lib/utils";

export function AboutPage() {
  const { t, translateLabel } = useLanguage();
  const { contentWidthClass } = useLayout();
  const [mission, setMission] = useState<MissionVisionPayload>(
    FALLBACK_MISSION_VISION
  );
  const [history, setHistory] = useState<HistoryPayload>(FALLBACK_HISTORY);
  const [leadership, setLeadership] =
    useState<LeadershipPayload>(FALLBACK_LEADERSHIP);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await fetchPublishedCmsPage("about");
      if (cancelled || !page?.blocks?.length) return;

      const mv = findBlockPayload<MissionVisionPayload>(
        page,
        "ABOUT_MISSION_VISION"
      );
      const hist = findBlockPayload<HistoryPayload>(page, "ABOUT_HISTORY");
      const lead = findBlockPayload<LeadershipPayload>(
        page,
        "ABOUT_LEADERSHIP"
      );

      if (mv?.missionHeading && mv?.visionHeading) setMission(mv);
      if (hist?.items?.length) setHistory(hist);
      if (lead?.people?.length) setLeadership(lead);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicPageShell
      heroTitle={t("about.heroTitle")}
      heroSubtitle={t("about.heroSubtitle")}
      heroImage={FALLBACK_ABOUT_HERO.image || DHAPTI_IMAGES.campus}
    >
      <section id="mission" className="scroll-mt-28 py-16">
        <div
          className={cn(
            "layout-content-width grid gap-8 md:grid-cols-2",
            contentWidthClass
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-[#E5EBF3] bg-[#F4F7FB] p-8 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              {translateLabel(mission.missionEyebrow)}
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#002147] dark:text-slate-100">
              {translateLabel(mission.missionHeading)}
            </h2>
            <CmsText
              value={translateLabel(mission.missionBody)}
              className="mt-4 whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-300 [&_p]:mb-3 last:[&_p]:mb-0"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-[#002147] p-8 text-white"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              {translateLabel(mission.visionEyebrow)}
            </p>
            <h2 className="mt-3 text-2xl font-black">
              {translateLabel(mission.visionHeading)}
            </h2>
            <CmsText
              value={translateLabel(mission.visionBody)}
              className="mt-4 whitespace-pre-line leading-relaxed text-white/80 [&_p]:mb-3 last:[&_p]:mb-0"
            />
          </motion.div>
        </div>
      </section>

      <section className="bg-[#F4F7FB] py-16 dark:bg-slate-900/50">
        <div className={cn("layout-content-width", contentWidthClass)}>
          <h2 className="text-center text-3xl font-black text-[#002147] dark:text-slate-100">
            {t("about.coreValues")}
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {coreValues.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-[#E5EBF3] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-3 h-1.5 w-10 rounded-full bg-[#ea580c]" />
                <h3 className="text-lg font-bold text-[#002147] dark:text-slate-100">
                  {translateLabel(value.title)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {translateLabel(value.description)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="history" className="scroll-mt-28 py-16">
        <div className={cn("layout-content-width", contentWidthClass)}>
          <h2 className="text-center text-3xl font-black text-[#002147] dark:text-slate-100">
            {translateLabel(history.sectionTitle)}
          </h2>
          <div className="relative mt-12 space-y-8 border-l-2 border-[#ea580c]/40 pl-8 rtl:border-l-0 rtl:border-r-2 rtl:pl-0 rtl:pr-8">
            {history.items.map((item, i) => (
              <motion.div
                key={`${item.year}-${item.title}-${i}`}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <span className="absolute -left-[2.4rem] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#ea580c] text-[10px] font-bold text-white rtl:left-auto rtl:-right-[2.4rem]">
                  •
                </span>
                <p className="text-sm font-bold text-[#ea580c]">{item.year}</p>
                <h3 className="mt-1 text-xl font-bold text-[#002147] dark:text-slate-100">
                  {item.title}
                </h3>
                <CmsText
                  value={item.text}
                  className="mt-2 text-slate-600 dark:text-slate-400 [&_p]:mb-2 last:[&_p]:mb-0"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#002147] py-16">
        <div className={cn("layout-content-width", contentWidthClass)}>
          <h2 className="text-center text-3xl font-black text-white">
            {translateLabel(leadership.sectionTitle)}
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {leadership.people.map((person, i) => (
              <motion.article
                key={`${person.name}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group overflow-hidden rounded-2xl bg-white shadow-xl"
              >
                <FittedImage
                  src={person.imageUrl}
                  alt={person.name}
                  variant="square"
                  className="rounded-none rounded-t-2xl"
                />
                <div className="p-5">
                  <h3 className="font-bold text-[#002147]">{person.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                    {translateLabel(person.role)}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">{person.bio}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
