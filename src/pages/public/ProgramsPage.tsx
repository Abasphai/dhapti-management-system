import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { PublicPageShell } from "@/components/common/PublicPageShell";
import { FittedImage } from "@/components/common/FittedImage";
import {
  SafeHtml,
  htmlHasVisibleText,
} from "@/components/cms/SafeHtml";
import { DHAPTI_IMAGES, facultyDetails } from "@/data/publicSite";
import {
  fetchPublishedFaculties,
  fetchPublishedPrograms,
  mergeFacultyCatalog,
  type CmsProgramMarketing,
  type FacultyPublicView,
} from "@/lib/cmsFacultyPrograms";

const tracks = [
  {
    id: "undergraduate",
    title: "Undergraduate Programs",
    subtitle: "Bachelor pathways (typically 4 years)",
    description:
      "Foundation-to-professional degrees across Medicine, Engineering, Business, Science, Law, and Agriculture.",
    degrees: ["B.Sc.", "BBA", "MBBS", "Bachelor of Law & Sharia"],
  },
  {
    id: "postgraduate",
    title: "Postgraduate Programs",
    subtitle: "Master’s & advanced study",
    description:
      "Selected M.Sc. and postgraduate diplomas focused on research capacity and professional specialization.",
    degrees: ["M.Sc.", "Postgraduate Diploma", "Research Seminars"],
  },
  {
    id: "short-courses",
    title: "Short Courses & Diplomas",
    subtitle: "Skills for immediate impact",
    description:
      "Flexible diploma and certificate options in ICT, business management, clinical support, and agriculture.",
    degrees: ["Diploma", "Certificate", "Professional Workshops"],
  },
];

export function ProgramsPage() {
  const [faculties, setFaculties] =
    useState<FacultyPublicView[]>(facultyDetails);
  const [programs, setPrograms] = useState<CmsProgramMarketing[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cmsFaculties, cmsPrograms] = await Promise.all([
        fetchPublishedFaculties(),
        fetchPublishedPrograms(),
      ]);
      if (cancelled) return;
      setFaculties(mergeFacultyCatalog(cmsFaculties));
      setPrograms(cmsPrograms);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const programsByFaculty = useMemo(() => {
    const map = new Map<string, CmsProgramMarketing[]>();
    for (const p of programs) {
      const list = map.get(p.facultyKey) ?? [];
      list.push(p);
      map.set(p.facultyKey, list);
    }
    return map;
  }, [programs]);

  return (
    <PublicPageShell
      heroTitle="Academic Programs"
      heroSubtitle="Undergraduate, postgraduate, and short-course pathways designed for Somalia’s development priorities."
      heroImage={DHAPTI_IMAGES.lecture}
    >
      <section className="px-4 py-14 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {tracks.map((track, i) => (
            <motion.div
              key={track.id}
              id={track.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="scroll-mt-28 rounded-3xl bg-[#002147] p-6 shadow-lg md:p-8"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
                {track.subtitle}
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {track.title}
              </h2>
              <p className="mt-3 max-w-3xl text-xs font-medium leading-relaxed text-slate-300 md:text-sm">
                {track.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {track.degrees.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-[#F4F7FB] px-4 py-14 dark:bg-slate-900/40 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black text-[#002147] dark:text-white">
            Browse by Faculty
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {faculties.map((f, i) => {
              const facultyPrograms = programsByFaculty.get(f.id) ?? [];
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="group overflow-hidden rounded-2xl bg-[#002147] shadow-lg"
                >
                  <FittedImage
                    src={f.image}
                    alt=""
                    variant="banner"
                    className="rounded-none rounded-t-2xl"
                  />
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white transition-colors group-hover:text-orange-400 md:text-xl">
                      {f.shortName}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-300 md:text-sm">
                      {f.duration} · {f.credits}
                    </p>
                    {facultyPrograms.length > 0 && (
                      <ul className="mt-3 space-y-2 border-t border-white/15 pt-3">
                        {facultyPrograms.map((p) => (
                          <li key={p.id} className="text-sm">
                            <p className="font-semibold text-white">{p.title}</p>
                            <p className="text-xs font-medium text-slate-300">
                              {[
                                p.degreeTitle,
                                p.duration,
                                p.creditHours
                                  ? `${p.creditHours} credits`
                                  : "",
                                p.tuitionPerSemester
                                  ? `${p.tuitionPerSemester}/sem`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {htmlHasVisibleText(p.overviewHtml) && (
                              <SafeHtml
                                html={p.overviewHtml}
                                className="mt-1 text-xs font-medium leading-relaxed text-slate-300 [&_p]:mb-1 last:[&_p]:mb-0"
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      to={`/faculties#${f.id}`}
                      className="mt-4 inline-block text-sm font-bold text-orange-400 hover:text-orange-300 hover:underline"
                    >
                      Explore Faculty →
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/admissions"
              className="inline-flex rounded-xl bg-[#16a34a] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#15803d]"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
