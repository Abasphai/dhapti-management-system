import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";

import { PublicPageShell } from "@/components/common/PublicPageShell";
import { FittedImage } from "@/components/common/FittedImage";
import { useLocale } from "@/context/LocaleContext";
import { useLayout } from "@/context/LayoutContext";
import { DHAPTI_IMAGES, type NewsItem } from "@/data/publicSite";
import {
  FALLBACK_EVENTS,
  FALLBACK_NEWS,
  fetchPublishedEvents,
  fetchPublishedNews,
  newsCategoryBadgeClass,
  type PublicEventCard,
} from "@/lib/cmsNewsEvents";
import { cn } from "@/lib/utils";

const filters = ["All", "Campus News", "Research", "Admissions", "Events"] as const;

export function NewsPage() {
  const { locale } = useLocale();
  const { contentWidthClass } = useLayout();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_NEWS);
  const [events, setEvents] = useState<PublicEventCard[]>(FALLBACK_EVENTS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cmsNews, cmsEvents] = await Promise.all([
        fetchPublishedNews(),
        fetchPublishedEvents(),
      ]);
      if (cancelled) return;
      setNews(cmsNews);
      setEvents(cmsEvents);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const items = useMemo(() => {
    return news.filter((item) => {
      const matchesFilter = filter === "All" || item.category === filter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.excerpt.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, news]);

  return (
    <PublicPageShell
      heroTitle="News & Events"
      heroSubtitle="Campus announcements, research highlights, admissions updates, and upcoming university events."
      heroImage={DHAPTI_IMAGES.students}
    >
      <section className="py-12 pb-28">
        <div
          className={cn(
            "layout-content-width grid gap-10 lg:grid-cols-[1fr_320px]",
            contentWidthClass
          )}
        >
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search news..."
                  className="w-full rounded-xl border border-[#E5EBF3] bg-white py-3 pl-10 pr-4 text-sm text-[#002147] outline-none ring-[#ea580c] focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                    filter === f
                      ? "bg-[#ea580c] text-white"
                      : "bg-[#F4F7FB] text-[#002147] hover:bg-[#E5EBF3] dark:bg-slate-800 dark:text-white"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {items.map((item, i) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group overflow-hidden rounded-2xl bg-[#002147] shadow-lg"
                >
                  <FittedImage src={item.image} alt="" variant="video" />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          newsCategoryBadgeClass(item.category)
                        )}
                      >
                        {item.category}
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
              {items.length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600 dark:text-slate-300">
                  No news matches your search.
                </p>
              )}
            </div>
          </div>

          <aside className="h-fit rounded-2xl bg-[#001a38] p-6 pb-28 text-white shadow-xl lg:sticky lg:top-32 lg:pb-8">
            <h2 className="text-xl font-black text-white">
              Featured Upcoming Events
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-300">
              Dates, times, and campus locations
            </p>
            <div className="mt-6 space-y-4">
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
                    <h3 className="font-bold text-white">{event.title}</h3>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-300 md:text-sm">
                      <li className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                        {event.date}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                        {event.time}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ea580c]" />
                        {event.location}
                      </li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </PublicPageShell>
  );
}
