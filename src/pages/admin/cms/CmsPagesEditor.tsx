import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Eye,
  FileText,
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
  FALLBACK_HISTORY,
  FALLBACK_LEADERSHIP,
  FALLBACK_MISSION_VISION,
  defaultAboutBlocks,
  type CmsPage,
  type HistoryPayload,
  type LeadershipPayload,
  type MissionVisionPayload,
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

async function ensureAboutPage(): Promise<CmsPage> {
  try {
    return await api<CmsPage>("/admin/cms/pages/slug/about");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return api<CmsPage>("/admin/cms/pages", {
        method: "POST",
        body: JSON.stringify({
          slug: "about",
          title: "About Dhapti",
        }),
      });
    }
    throw err;
  }
}

export function AdminCmsPagesPage() {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [mission, setMission] = useState<MissionVisionPayload>(
    FALLBACK_MISSION_VISION
  );
  const [history, setHistory] = useState<HistoryPayload>(FALLBACK_HISTORY);
  const [leadership, setLeadership] =
    useState<LeadershipPayload>(FALLBACK_LEADERSHIP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await ensureAboutPage();
      setPage(p);
      if (!p.blocks?.length) {
        const defaults = defaultAboutBlocks();
        setMission(defaults[0].payload as MissionVisionPayload);
        setHistory(defaults[1].payload as HistoryPayload);
        setLeadership(defaults[2].payload as LeadershipPayload);
      } else {
        const mv = p.blocks.find((b) => b.blockType === "ABOUT_MISSION_VISION");
        const hist = p.blocks.find((b) => b.blockType === "ABOUT_HISTORY");
        const lead = p.blocks.find((b) => b.blockType === "ABOUT_LEADERSHIP");
        setMission(
          (mv?.payload as MissionVisionPayload | undefined) ??
            FALLBACK_MISSION_VISION
        );
        setHistory(
          (hist?.payload as HistoryPayload | undefined) ?? FALLBACK_HISTORY
        );
        setLeadership(
          (lead?.payload as LeadershipPayload | undefined) ??
            FALLBACK_LEADERSHIP
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load About page CMS"
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
          blockType: "ABOUT_MISSION_VISION",
          schemaVersion: 1,
          sortOrder: 0,
          payload: mission,
        },
        {
          blockType: "ABOUT_HISTORY",
          schemaVersion: 1,
          sortOrder: 1,
          payload: history,
        },
        {
          blockType: "ABOUT_LEADERSHIP",
          schemaVersion: 1,
          sortOrder: 2,
          payload: leadership,
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
        toast.success("About page published successfully!");
      } else {
        toast.success("About page draft saved successfully!");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save About page"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="CMS Pages — About Dhapti"
          description="Edit Mission, Vision, History timeline, and Leadership cards for /about."
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
            onClick={() =>
              window.open("/about", "_blank", "noopener,noreferrer")
            }
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview About
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
          <Badge variant="info">slug: about</Badge>
          <Badge variant={page.status === "PUBLISHED" ? "success" : "warning"}>
            {page.status}
          </Badge>
        </div>
      ) : null}

      {loading ? (
        <Card className="border-[#E5EBF3]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading About page editor…
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base text-[#002147]">
                  Mission & Vision
                </CardTitle>
                <CardDescription>
                  Primary About page messaging blocks.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Mission heading">
                <Input
                  value={mission.missionHeading}
                  onChange={(e) =>
                    setMission((p) => ({
                      ...p,
                      missionHeading: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Vision heading">
                <Input
                  value={mission.visionHeading}
                  onChange={(e) =>
                    setMission((p) => ({
                      ...p,
                      visionHeading: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Mission body">
                <CmsRichTextEditor
                  value={mission.missionBody}
                  onChange={(html) =>
                    setMission((p) => ({ ...p, missionBody: html }))
                  }
                  minHeightClass="min-h-[120px]"
                />
              </Field>
              <Field label="Vision body">
                <CmsRichTextEditor
                  value={mission.visionBody}
                  onChange={(html) =>
                    setMission((p) => ({ ...p, visionBody: html }))
                  }
                  minHeightClass="min-h-[120px]"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base text-[#002147]">
                  University History
                </CardTitle>
                <CardDescription>Timeline entries for /about#history.</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setHistory((p) => ({
                    ...p,
                    items: [
                      ...p.items,
                      {
                        year: String(new Date().getFullYear()),
                        title: "New milestone",
                        text: "",
                      },
                    ],
                  }))
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add entry
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Section title">
                <Input
                  value={history.sectionTitle}
                  onChange={(e) =>
                    setHistory((p) => ({
                      ...p,
                      sectionTitle: e.target.value,
                    }))
                  }
                />
              </Field>
              {history.items.map((item, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl border border-[#E5EBF3] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#002147]">
                      Entry {index + 1}
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={history.items.length <= 1}
                      onClick={() =>
                        setHistory((p) => ({
                          ...p,
                          items: p.items.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Year">
                      <Input
                        value={item.year}
                        onChange={(e) =>
                          setHistory((p) => ({
                            ...p,
                            items: p.items.map((it, i) =>
                              i === index
                                ? { ...it, year: e.target.value }
                                : it
                            ),
                          }))
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Title">
                        <Input
                          value={item.title}
                          onChange={(e) =>
                            setHistory((p) => ({
                              ...p,
                              items: p.items.map((it, i) =>
                                i === index
                                  ? { ...it, title: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="Text">
                        <CmsRichTextEditor
                          value={item.text}
                          onChange={(html) =>
                            setHistory((p) => ({
                              ...p,
                              items: p.items.map((it, i) =>
                                i === index ? { ...it, text: html } : it
                              ),
                            }))
                          }
                          minHeightClass="min-h-[80px]"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base text-[#002147]">
                  Leadership team
                </CardTitle>
                <CardDescription>
                  Cards shown in the University Leadership section.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLeadership((p) => ({
                    ...p,
                    people: [
                      ...p.people,
                      {
                        name: "New leader",
                        role: "Role",
                        bio: "",
                        imageUrl: "/dhapti-logo.png",
                      },
                    ],
                  }))
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add person
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Section title">
                <Input
                  value={leadership.sectionTitle}
                  onChange={(e) =>
                    setLeadership((p) => ({
                      ...p,
                      sectionTitle: e.target.value,
                    }))
                  }
                />
              </Field>
              {leadership.people.map((person, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl border border-[#E5EBF3] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#002147]">
                      {person.name || `Person ${index + 1}`}
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={leadership.people.length <= 1}
                      onClick={() =>
                        setLeadership((p) => ({
                          ...p,
                          people: p.people.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={person.name}
                        onChange={(e) =>
                          setLeadership((p) => ({
                            ...p,
                            people: p.people.map((it, i) =>
                              i === index
                                ? { ...it, name: e.target.value }
                                : it
                            ),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Role">
                      <Input
                        value={person.role}
                        onChange={(e) =>
                          setLeadership((p) => ({
                            ...p,
                            people: p.people.map((it, i) =>
                              i === index
                                ? { ...it, role: e.target.value }
                                : it
                            ),
                          }))
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <CmsImageField
                        label="Photo"
                        url={person.imageUrl}
                        onChange={({ url }) =>
                          setLeadership((p) => ({
                            ...p,
                            people: p.people.map((it, i) =>
                              i === index
                                ? {
                                    ...it,
                                    imageUrl: url || "/dhapti-logo.png",
                                  }
                                : it
                            ),
                          }))
                        }
                        hint="Leadership card photo."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Bio">
                        <Textarea
                          rows={2}
                          value={person.bio}
                          onChange={(e) =>
                            setLeadership((p) => ({
                              ...p,
                              people: p.people.map((it, i) =>
                                i === index
                                  ? { ...it, bio: e.target.value }
                                  : it
                              ),
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
