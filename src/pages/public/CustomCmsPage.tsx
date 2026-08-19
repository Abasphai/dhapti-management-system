import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, FileQuestion, Home } from "lucide-react";
import { motion } from "framer-motion";

import { CmsText } from "@/components/cms/SafeHtml";
import { EmptyState } from "@/components/common/EmptyState";
import { PublicPageShell } from "@/components/common/PublicPageShell";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/context/LocaleContext";
import { DHAPTI_IMAGES } from "@/data/publicSite";
import {
  fetchPublishedCmsPage,
  mediaDownloadUrl,
  type CalloutBannerBlockPayload,
  type CmsPage,
  type CmsPageBlock,
  type DownloadsBlockPayload,
  type FaqAccordionBlockPayload,
  type RichTextBlockPayload,
} from "@/lib/cmsPageContent";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function RichTextBlock({ payload }: { payload: RichTextBlockPayload }) {
  const heading = payload.heading?.trim();
  const body = payload.body?.trim();
  if (!heading && !body) return null;
  return (
    <section className="space-y-4">
      {heading ? (
        <h2 className="text-2xl font-black text-[#002147] dark:text-slate-100 md:text-3xl">
          {heading}
        </h2>
      ) : null}
      {body ? (
        <CmsText
          value={body}
          className="leading-relaxed text-slate-600 dark:text-slate-300"
        />
      ) : null}
    </section>
  );
}

function FaqBlock({ payload }: { payload: FaqAccordionBlockPayload }) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-black text-[#002147] dark:text-slate-100 md:text-3xl">
        {payload.sectionTitle?.trim() || "Frequently Asked Questions"}
      </h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={`${item.question}-${i}`}
            className="group overflow-hidden rounded-xl border border-[#E5EBF3] bg-white open:shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#002147] marker:content-none dark:text-slate-100 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.question}
                <span className="text-[#ea580c] transition group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <div className="border-t border-[#E5EBF3] px-5 py-4 dark:border-slate-800">
              <CmsText
                value={item.answer}
                className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function DownloadsBlockView({
  payload,
}: {
  payload: DownloadsBlockPayload;
}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const mediaIds = items.map((i) => i.mediaId).filter(Boolean).join(",");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const ids = mediaIds.split(",").filter(Boolean);
    if (ids.length === 0) {
      setCounts({});
      return;
    }
    void (async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        ids.map(async (mediaId) => {
          try {
            const res = await fetch(
              `${API_BASE}/public/cms/media/${mediaId}`
            );
            if (!res.ok) return;
            const data = (await res.json()) as { downloadCount?: number };
            if (typeof data.downloadCount === "number") {
              next[mediaId] = data.downloadCount;
            }
          } catch {
            /* ignore */
          }
        })
      );
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaIds]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-black text-[#002147] dark:text-slate-100 md:text-3xl">
        {payload.sectionTitle?.trim() || "Downloads"}
      </h2>
      <ul className="divide-y divide-[#E5EBF3] overflow-hidden rounded-xl border border-[#E5EBF3] bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {items.map((item, i) => {
          const count = counts[item.mediaId];
          return (
            <li
              key={`${item.mediaId}-${i}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#002147] dark:text-slate-100">
                  {item.title}
                </p>
                {item.description?.trim() ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {item.description}
                  </p>
                ) : null}
                {typeof count === "number" ? (
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {count} download{count === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
              <a
                href={mediaDownloadUrl(item.mediaId)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#002147] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#003366]"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CalloutBannerBlock({
  payload,
}: {
  payload: CalloutBannerBlockPayload;
}) {
  const bg =
    payload.backgroundImageUrl?.trim() ||
    (payload.backgroundMediaId
      ? `${API_BASE}/public/cms/media/${payload.backgroundMediaId}/file`
      : DHAPTI_IMAGES.campus);

  return (
    <section className="relative overflow-hidden rounded-3xl">
      <img
        src={bg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#002147]/95 via-[#002147]/80 to-[#002147]/55" />
      <div className="relative z-10 px-6 py-12 md:px-12 md:py-16">
        <h2 className="max-w-2xl text-2xl font-black text-white md:text-4xl">
          {payload.title}
        </h2>
        {payload.body?.trim() ? (
          <p className="mt-3 max-w-xl text-base text-white/85">{payload.body}</p>
        ) : null}
        {payload.ctaHref?.startsWith("http") ? (
          <a
            href={payload.ctaHref}
            className="mt-6 inline-flex rounded-lg bg-[#ea580c] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-orange-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            {payload.ctaLabel || "Learn more"}
          </a>
        ) : (
          <Link
            to={payload.ctaHref || "/"}
            className="mt-6 inline-flex rounded-lg bg-[#ea580c] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-orange-600"
          >
            {payload.ctaLabel || "Learn more"}
          </Link>
        )}
      </div>
    </section>
  );
}

function renderBlock(block: CmsPageBlock, index: number) {
  const type = block.blockType;
  const payload = (block.payload ?? {}) as Record<string, unknown>;

  let content: ReactNode = null;
  if (type === "RICH_TEXT_BLOCK" || type === "RICH_TEXT") {
    content = <RichTextBlock payload={payload as RichTextBlockPayload} />;
  } else if (type === "FAQ_ACCORDION_BLOCK") {
    content = <FaqBlock payload={payload as FaqAccordionBlockPayload} />;
  } else if (type === "DOWNLOADS_BLOCK") {
    content = (
      <DownloadsBlockView payload={payload as DownloadsBlockPayload} />
    );
  } else if (type === "CALLOUT_BANNER_BLOCK") {
    content = (
      <CalloutBannerBlock payload={payload as CalloutBannerBlockPayload} />
    );
  }

  if (!content) return null;

  return (
    <motion.div
      key={block.id ?? `${type}-${index}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {content}
    </motion.div>
  );
}

export function CustomCmsPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { locale, dir } = useLocale();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void (async () => {
      const result = await fetchPublishedCmsPage(slug, locale);
      if (cancelled) return;
      if (!result) {
        setPage(null);
        setNotFound(true);
      } else {
        setPage(result);
        setNotFound(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  if (loading) {
    return (
      <PublicPageShell
        heroTitle="Loading…"
        heroSubtitle="Fetching page content"
        heroImage={DHAPTI_IMAGES.campus}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-500">
          Loading page…
        </div>
      </PublicPageShell>
    );
  }

  if (notFound || !page) {
    return (
      <PublicPageShell
        heroTitle="Page not found"
        heroSubtitle="This page is unavailable or has not been published yet."
        heroImage={DHAPTI_IMAGES.campus}
      >
        <div className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            icon={FileQuestion}
            title="We couldn't find that page"
            description={`No published CMS page matches “${slug}”. It may be a draft, archived, or the link is incorrect.`}
            action={
              <Button asChild className="bg-[#002147] hover:bg-[#003366]">
                <Link to="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to home
                </Link>
              </Button>
            }
          />
        </div>
      </PublicPageShell>
    );
  }

  const blocks = [...(page.blocks ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <PublicPageShell
      heroTitle={page.title}
      heroSubtitle={page.metaDescription ?? undefined}
      heroImage={DHAPTI_IMAGES.campus}
    >
      <div dir={dir} className="mx-auto max-w-6xl space-y-12 px-4 py-14 md:px-8">
        {blocks.length === 0 ? (
          <EmptyState
            title="This page has no content yet"
            description="Check back soon — content is being prepared."
            action={
              <Button asChild variant="outline">
                <Link to="/">Return home</Link>
              </Button>
            }
          />
        ) : (
          blocks.map((block, i) => renderBlock(block, i))
        )}
      </div>
    </PublicPageShell>
  );
}
