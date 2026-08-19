import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { FittedImage } from "@/components/common/FittedImage";
import { useLanguage } from "@/context/LanguageContext";
import { facultyDetails } from "@/data/publicSite";

export function FacultiesGrid() {
  const { t, translateLabel, dir } = useLanguage();

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {facultyDetails.map((faculty, i) => (
          <motion.article
            key={faculty.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="group flex flex-col overflow-hidden rounded-2xl bg-[#002147] shadow-lg transition-shadow hover:shadow-xl"
          >
            <FittedImage
              src={faculty.image}
              alt={translateLabel(faculty.shortName)}
              variant="banner"
              className="rounded-none rounded-t-2xl"
            />
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-bold leading-snug text-white transition-colors group-hover:text-orange-400 md:text-xl">
                {translateLabel(faculty.shortName)}
              </h3>
              <p className="mt-2 flex-1 text-xs font-medium leading-relaxed text-slate-300 md:text-sm">
                {translateLabel(faculty.description)}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
                <span className="text-xs font-medium text-slate-300">
                  {t("faculties.departments").replace(
                    "{count}",
                    String(faculty.departments.length)
                  )}
                </span>
                <Link
                  to={`/faculties#${faculty.id}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-orange-400 hover:text-orange-300 hover:underline"
                >
                  {t("faculties.explore")}
                  <ArrowRight
                    className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 ${
                      dir === "rtl" ? "rotate-180" : ""
                    }`}
                  />
                </Link>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button size="lg" variant="outline" className="gap-2" asChild>
          <Link to="/faculties">
            {t("faculties.viewAll")}
            <ArrowRight
              className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}
            />
          </Link>
        </Button>
      </div>
    </div>
  );
}
