import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { PublicPageShell } from "@/components/common/PublicPageShell";
import { FittedImage } from "@/components/common/FittedImage";
import {
  CmsText,
  SafeHtml,
  htmlHasVisibleText,
} from "@/components/cms/SafeHtml";
import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { DHAPTI_IMAGES, facultyDetails } from "@/data/publicSite";
import {
  fetchPublishedFaculties,
  mergeFacultyCatalog,
  type FacultyPublicView,
} from "@/lib/cmsFacultyPrograms";
import { cn } from "@/lib/utils";

export function FacultiesPage() {
  const location = useLocation();
  const { t, translateLabel } = useLanguage();
  const { contentContainerClass } = useLayout();
  const [faculties, setFaculties] =
    useState<FacultyPublicView[]>(facultyDetails);
  const [openId, setOpenId] = useState(facultyDetails[0]?.id ?? "");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cms = await fetchPublishedFaculties();
      if (cancelled) return;
      setFaculties(mergeFacultyCatalog(cms));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash && faculties.some((f) => f.id === hash)) {
      setOpenId(hash);
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [location.hash, faculties]);

  return (
    <PublicPageShell
      heroTitle={t("faculties.pageTitle")}
      heroSubtitle={t("faculties.pageSubtitle")}
      heroImage={DHAPTI_IMAGES.lecture}
    >
      <section className="py-14">
        <div className={cn("layout-content-width space-y-4", contentContainerClass)}>
          {faculties.map((faculty) => {
            const open = openId === faculty.id;
            const overview =
              faculty.overviewHtml && htmlHasVisibleText(faculty.overviewHtml)
                ? faculty.overviewHtml
                : null;
            const admissions =
              faculty.admissionRequirementsHtml &&
              htmlHasVisibleText(faculty.admissionRequirementsHtml)
                ? faculty.admissionRequirementsHtml
                : null;
            const dean =
              faculty.deanWelcomeHtml &&
              htmlHasVisibleText(faculty.deanWelcomeHtml)
                ? faculty.deanWelcomeHtml
                : null;
            const careers =
              faculty.careerProspectsHtml &&
              htmlHasVisibleText(faculty.careerProspectsHtml)
                ? faculty.careerProspectsHtml
                : null;

            return (
              <div
                key={faculty.id}
                id={faculty.id}
                className="scroll-mt-28 overflow-hidden rounded-2xl bg-[#002147] shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? "" : faculty.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-start md:px-7"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white md:text-xl">
                      {translateLabel(faculty.shortName) || faculty.name}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-300">
                      {faculty.duration} · {faculty.credits}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-orange-400 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/15"
                    >
                      <div className="grid gap-6 p-5 md:grid-cols-[220px_1fr] md:p-7">
                        <FittedImage
                          src={faculty.image}
                          alt={translateLabel(faculty.shortName)}
                          variant="square"
                          className="rounded-xl"
                        />
                        <div className="space-y-4">
                          {overview ? (
                            <CmsText
                              value={overview}
                              className="text-xs font-medium leading-relaxed text-slate-300 md:text-sm [&_p]:mb-2 last:[&_p]:mb-0"
                            />
                          ) : (
                            <p className="text-xs font-medium leading-relaxed text-slate-300 md:text-sm">
                              {translateLabel(faculty.description)}
                            </p>
                          )}
                          {dean && (
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                                {t("faculties.deanWelcome")}
                              </h3>
                              <SafeHtml
                                html={dean}
                                className="mt-2 text-sm font-medium text-slate-300 [&_p]:mb-2 last:[&_p]:mb-0"
                              />
                            </div>
                          )}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                                {t("faculties.departmentsLabel")}
                              </h3>
                              <ul className="mt-2 space-y-1 text-sm font-medium text-white">
                                {faculty.departments.map((d) => (
                                  <li key={d}>• {d}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                                {t("faculties.degrees")}
                              </h3>
                              <ul className="mt-2 space-y-1 text-sm font-medium text-white">
                                {faculty.degrees.map((d) => (
                                  <li key={d}>• {d}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                              {t("faculties.entry")}
                            </h3>
                            {admissions ? (
                              <SafeHtml
                                html={admissions}
                                className="mt-2 text-sm font-medium text-slate-300 [&_li]:mb-1 [&_p]:mb-2 last:[&_p]:mb-0"
                              />
                            ) : (
                              <ul className="mt-2 space-y-1 text-sm font-medium text-slate-300">
                                {faculty.entryRequirements.map((r) => (
                                  <li key={r}>• {r}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {careers && (
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                                {t("faculties.careers")}
                              </h3>
                              <SafeHtml
                                html={careers}
                                className="mt-2 text-sm font-medium text-slate-300 [&_p]:mb-2 last:[&_p]:mb-0"
                              />
                            </div>
                          )}
                          <Link
                            to="/admissions"
                            className="inline-flex rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#15803d]"
                          >
                            {t("faculties.apply")}
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </PublicPageShell>
  );
}
