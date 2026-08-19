import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Eye,
  Home,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cmsBtnDraftClass, cmsBtnPublishClass } from "@/components/cms/cmsModalStyles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CmsRichTextEditor } from "@/components/cms/CmsRichTextEditor";
import { ApiError, api } from "@/lib/api";
import {
  FALLBACK_HERO_SLIDES,
  FALLBACK_RECTOR,
  FALLBACK_WHY_CHOOSE,
  DEFAULT_SLIDE_IMAGES,
  defaultHomeBlocks,
  normalizeHeroSlides,
  resolveSlideImage,
  slideImageOnErrorSrc,
  type CmsPage,
  type HeroSlide,
  type RectorPayload,
  type WhyChooseFeature,
  type WhyChoosePayload,
  type WhyChooseStat,
} from "@/lib/cmsPageContent";
import { CmsImageField } from "./CmsImageField";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

async function ensureHomePage(): Promise<CmsPage> {
  try {
    return await api<CmsPage>("/admin/cms/pages/slug/home");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return api<CmsPage>("/admin/cms/pages", {
        method: "POST",
        body: JSON.stringify({
          slug: "home",
          title: "Homepage",
        }),
      });
    }
    throw err;
  }
}

function loadFromPage(page: CmsPage) {
  const hero = page.blocks.find((b) => b.blockType === "HERO_SLIDER");
  const why = page.blocks.find((b) => b.blockType === "WHY_CHOOSE");
  const rector = page.blocks.find((b) => b.blockType === "RECTOR_MESSAGE");

  const slides = normalizeHeroSlides(
    (hero?.payload as { slides?: HeroSlide[] } | undefined)?.slides ??
      FALLBACK_HERO_SLIDES
  );
  const whyPayload = (why?.payload as WhyChoosePayload | undefined) ??
    FALLBACK_WHY_CHOOSE;
  const rectorPayload =
    (rector?.payload as RectorPayload | undefined) ?? FALLBACK_RECTOR;

  return { slides, why: whyPayload, rector: rectorPayload };
}

export function AdminCmsHomePage() {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [slides, setSlides] = useState<HeroSlide[]>(FALLBACK_HERO_SLIDES);
  const [why, setWhy] = useState<WhyChoosePayload>(FALLBACK_WHY_CHOOSE);
  const [rector, setRector] = useState<RectorPayload>(FALLBACK_RECTOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await ensureHomePage();
      setPage(p);
      if (!p.blocks?.length) {
        const defaults = defaultHomeBlocks();
        setSlides(
          normalizeHeroSlides(
            (defaults[0].payload as { slides: HeroSlide[] }).slides
          )
        );
        setWhy(defaults[1].payload as WhyChoosePayload);
        setRector(defaults[2].payload as RectorPayload);
      } else {
        const loaded = loadFromPage(p);
        setSlides(loaded.slides);
        setWhy(loaded.why);
        setRector(loaded.rector);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load homepage CMS"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBlocks(thenPublish: boolean) {
    if (!page) return;
    setSaving(true);
    try {
      const blocks = [
        {
          blockType: "HERO_SLIDER",
          schemaVersion: 1,
          sortOrder: 0,
          payload: { slides: normalizeHeroSlides(slides) },
        },
        {
          blockType: "WHY_CHOOSE",
          schemaVersion: 1,
          sortOrder: 1,
          payload: why,
        },
        {
          blockType: "RECTOR_MESSAGE",
          schemaVersion: 1,
          sortOrder: 2,
          payload: rector,
        },
      ];
      const updated = await api<CmsPage>(`/admin/cms/pages/${page.id}/blocks`, {
        method: "PUT",
        body: JSON.stringify({ blocks }),
      });
      setPage(updated);

      if (thenPublish) {
        const published = await api<CmsPage>(
          `/admin/cms/pages/${page.id}/publish`,
          { method: "POST" }
        );
        setPage(published);
        toast.success("Homepage content published successfully!");
      } else {
        toast.success("Homepage draft saved successfully!");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save homepage"
      );
    } finally {
      setSaving(false);
    }
  }

  function updateSlide(index: number, patch: Partial<HeroSlide>) {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function updateStat(index: number, patch: Partial<WhyChooseStat>) {
    setWhy((prev) => ({
      ...prev,
      stats: prev.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function updateFeature(index: number, patch: Partial<WhyChooseFeature>) {
    setWhy((prev) => ({
      ...prev,
      features: prev.features.map((f, i) =>
        i === index ? { ...f, ...patch } : f
      ),
    }));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Homepage CMS"
          description="Edit hero slides, Why Choose Dhapti, and the Rector’s message. Public site uses published content with safe fallbacks."
        />
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Reload
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview Homepage
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cmsBtnDraftClass}
            onClick={() => void saveBlocks(false)}
            disabled={!page || loading || saving}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Save Draft
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void saveBlocks(true)}
            disabled={!page || loading || saving}
            className={cmsBtnPublishClass}
          >
            <Send className="mr-1.5 h-4 w-4" />
            Publish Changes
          </Button>
        </div>
      </div>

      {page ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">slug: home</Badge>
          <Badge variant={page.status === "PUBLISHED" ? "success" : "warning"}>
            {page.status}
          </Badge>
        </div>
      ) : null}

      {loading ? (
        <Card className="border-[#E5EBF3]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading homepage editor…
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
                  <Home className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-[#002147]">
                    Hero Slider
                  </CardTitle>
                  <CardDescription>
                    Add, edit, or remove homepage carousel slides.
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setSlides((prev) => [
                    ...prev,
                    {
                      title: "New Slide",
                      subtitle: "",
                      description: "",
                      imageUrl: DEFAULT_SLIDE_IMAGES[prev.length % DEFAULT_SLIDE_IMAGES.length],
                      buttonText: "Learn More",
                      buttonLink: "/about",
                      imagePos: "object-center",
                    },
                  ])
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add slide
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#002147]">
                      Slide {index + 1}
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={slides.length <= 1}
                      onClick={() =>
                        setSlides((prev) => prev.filter((_, i) => i !== index))
                      }
                      aria-label={`Delete slide ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                  <div className="w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden mb-3 border border-slate-700 relative">
                    <img
                      src={resolveSlideImage(slide, index)}
                      alt={`Slide ${index + 1}`}
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = slideImageOnErrorSrc(img.src, index);
                      }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Slide title">
                      <Input
                        value={slide.title}
                        onChange={(e) =>
                          updateSlide(index, { title: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Subtitle">
                      <Input
                        value={slide.subtitle ?? ""}
                        onChange={(e) =>
                          updateSlide(index, { subtitle: e.target.value })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Description">
                        <Textarea
                          rows={2}
                          value={slide.description}
                          onChange={(e) =>
                            updateSlide(index, {
                              description: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <CmsImageField
                        label="Background image"
                        url={resolveSlideImage(slide, index)}
                        onChange={({ url }) =>
                          updateSlide(index, {
                            imageUrl:
                              url?.trim() ||
                              DEFAULT_SLIDE_IMAGES[index % DEFAULT_SLIDE_IMAGES.length],
                          })
                        }
                        hint="Hero slide background — upload or pick from the library."
                      />
                    </div>
                    <Field label="Button text">
                      <Input
                        value={slide.buttonText}
                        onChange={(e) =>
                          updateSlide(index, { buttonText: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Button link">
                      <Input
                        value={slide.buttonLink}
                        onChange={(e) =>
                          updateSlide(index, { buttonLink: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Why Choose Dhapti
              </CardTitle>
              <CardDescription>
                Statistics counters and feature cards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Section title">
                  <Input
                    value={why.sectionTitle}
                    onChange={(e) =>
                      setWhy((p) => ({ ...p, sectionTitle: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Section label">
                  <Input
                    value={why.sectionLabel}
                    onChange={(e) =>
                      setWhy((p) => ({ ...p, sectionLabel: e.target.value }))
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Section description">
                    <Textarea
                      rows={2}
                      value={why.sectionDescription}
                      onChange={(e) =>
                        setWhy((p) => ({
                          ...p,
                          sectionDescription: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-[#002147]">
                  Statistics
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {why.stats.map((stat, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-3 gap-2 rounded-lg border border-[#E5EBF3] p-3"
                    >
                      <Field label="Value">
                        <Input
                          type="number"
                          value={stat.value}
                          onChange={(e) =>
                            updateStat(index, {
                              value: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                      <Field label="Suffix">
                        <Input
                          value={stat.suffix}
                          onChange={(e) =>
                            updateStat(index, { suffix: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Label">
                        <Input
                          value={stat.label}
                          onChange={(e) =>
                            updateStat(index, { label: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-[#002147]">
                  Feature cards
                </p>
                <div className="space-y-3">
                  {why.features.map((feature, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-lg border border-[#E5EBF3] p-3 sm:grid-cols-2"
                    >
                      <Field label="Title">
                        <Input
                          value={feature.title}
                          onChange={(e) =>
                            updateFeature(index, { title: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Icon">
                        <Input
                          value={feature.icon}
                          onChange={(e) =>
                            updateFeature(index, {
                              icon: e.target
                                .value as WhyChooseFeature["icon"],
                            })
                          }
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Description">
                          <Textarea
                            rows={2}
                            value={feature.description}
                            onChange={(e) =>
                              updateFeature(index, {
                                description: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-[#002147]">
                Rector’s Message
              </CardTitle>
              <CardDescription>
                Photo, name, title, and message body.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Rector name">
                <Input
                  value={rector.name}
                  onChange={(e) =>
                    setRector((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Title / role">
                <Input
                  value={rector.title}
                  onChange={(e) =>
                    setRector((p) => ({ ...p, title: e.target.value }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <CmsImageField
                  label="Rector photo"
                  url={rector.photoUrl}
                  onChange={({ url }) =>
                    setRector((p) => ({
                      ...p,
                      photoUrl: url || p.photoUrl,
                    }))
                  }
                  hint="Portrait shown beside the Rector’s message."
                />
              </div>
              <Field label="Section heading">
                <Input
                  value={rector.heading}
                  onChange={(e) =>
                    setRector((p) => ({ ...p, heading: e.target.value }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Message">
                  <CmsRichTextEditor
                    value={rector.message}
                    onChange={(html) =>
                      setRector((p) => ({ ...p, message: html }))
                    }
                    placeholder="Rector’s welcome message…"
                    minHeightClass="min-h-[160px]"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
