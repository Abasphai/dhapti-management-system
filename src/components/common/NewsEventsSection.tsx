import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { FittedImage } from "@/components/common/FittedImage";
import { useLanguage } from "@/context/LanguageContext";
import type { NewsItem } from "@/data/publicSite";
import {
  FALLBACK_EVENTS,
  FALLBACK_NEWS,
  fetchPublishedEvents,
  fetchPublishedNews,
  newsCategoryBadgeClass,
  type PublicEventCard,
} from "@/lib/cmsNewsEvents";
import { cn } from "@/lib/utils";

export function NewsEventsSection() {
  const { lang, t, translateLabel, dir } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_NEWS.slice(0, 3));
  const [events, setEvents] = useState<PublicEventCard[]>(FALLBACK_EVENTS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cmsNews, cmsEvents] = await Promise.all([
        fetchPublishedNews(),
        fetchPublishedEvents(),
      ]);
      if (cancelled) return;
      setNews(cmsNews.slice(0, 3));
      setEvents(cmsEvents.slice(0, 3));
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <section className="section-padding bg-muted/30">
      <div className="section-container">
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
            {t("news.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-black text-[#002147] dark:text-white md:text-4xl">
            {t("news.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
            {t("news.subtitle")}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
            {news.map((item, i) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group overflow-hidden rounded-2xl bg-[#002147] shadow-lg"
              >
                <FittedImage src={item.image} alt="" variant="video" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        newsCategoryBadgeClass(item.category)
                      )}
                    >
                      {translateLabel(item.category)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Calendar className="h-3.5 w-3.5 text-[#ea580c]" />
                      {item.date}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-white transition-colors group-hover:text-orange-400 md:text-xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300 md:text-sm">
                    {item.excerpt}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex h-full flex-col rounded-2xl bg-[#001a38] p-6 pb-8 text-white shadow-xl"
          >
            <h3 className="text-lg font-bold text-white">
              {t("news.upcoming")}
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-300">
              {t("news.upcomingSub")}
            </p>
            <div className="mt-5 flex-1 space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="group overflow-hidden rounded-xl border border-white/15 bg-white/5"
                >
                  <FittedImage
                    src={event.image}
                    alt=""
                    variant="thumb"
                    className="rounded-none rounded-t-xl"
                  />
                  <div className="p-4">
                    <p className="font-bold text-white">{event.title}</p>
                    <div className="mt-2 space-y-1.5 text-xs text-slate-300 md:text-sm">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                        {event.date}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                        {event.time}
                      </p>
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                        {event.location}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="secondary"
              className="mt-6 w-full gap-2 bg-white font-bold text-[#002147] hover:bg-orange-400 hover:text-white"
              asChild
            >
              <Link to="/news">
                {t("news.viewAll")}
                <ArrowRight
                  className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
