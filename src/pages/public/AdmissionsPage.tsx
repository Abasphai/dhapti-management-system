import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";

import { Footer, Navbar } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLayout } from "@/context/LayoutContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  FALLBACK_FACULTIES,
  FALLBACK_PROGRAMS,
} from "@/data/admissionsCatalog";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type FacultyOption = { id: string; name: string; code: string };
type ProgramOption = {
  id: string;
  code: string;
  title: string;
  facultyId: string | null;
  facultyCode?: string;
};

type ApplyResponse = {
  message: string;
  trackingId: string;
};

const fieldLabel =
  "text-sm font-bold text-[#002147] dark:text-slate-100";
const fieldControl =
  "h-11 rounded-xl border-[#E5EBF3] bg-white text-[#002147] shadow-sm transition-shadow focus-visible:border-[#ea580c] focus-visible:ring-2 focus-visible:ring-[#ea580c]/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function mergeFaculties(apiFaculties: FacultyOption[]): FacultyOption[] {
  const byCode = new Map(
    apiFaculties.map((f) => [f.code.toUpperCase(), f] as const)
  );
  const merged: FacultyOption[] = [...apiFaculties];
  for (const fb of FALLBACK_FACULTIES) {
    if (!byCode.has(fb.code.toUpperCase())) {
      merged.push(fb);
    }
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

function mergePrograms(
  apiPrograms: ProgramOption[],
  faculties: FacultyOption[]
): ProgramOption[] {
  const facultyByCode = new Map(
    faculties.map((f) => [f.code.toUpperCase(), f] as const)
  );
  const seenTitles = new Set(
    apiPrograms.map(
      (p) => `${p.facultyId ?? ""}::${p.title.trim().toLowerCase()}`
    )
  );
  const merged = [...apiPrograms];

  for (const fb of FALLBACK_PROGRAMS) {
    const faculty = facultyByCode.get(fb.facultyCode.toUpperCase());
    const facultyId = faculty?.id ?? fb.facultyId;
    const key = `${facultyId}::${fb.title.trim().toLowerCase()}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    merged.push({
      id: fb.id,
      code: fb.code,
      title: fb.title,
      facultyId,
      facultyCode: fb.facultyCode,
    });
  }
  return merged;
}

export function AdmissionsPage() {
  const { accentColor } = useLayout();
  const { t, translateLabel, dir } = useLanguage();
  const [faculties, setFaculties] = useState<FacultyOption[]>(FALLBACK_FACULTIES);
  const [programs, setPrograms] = useState<ProgramOption[]>(FALLBACK_PROGRAMS);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [admissionsOpen, setAdmissionsOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ApplyResponse | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    facultyId: "",
    programId: "",
    highSchoolGPA: "",
    documentsUrl: "",
    notes: "",
  });

  useEffect(() => {
    setOptionsLoading(true);

    void api<{ faculties: FacultyOption[]; programs: ProgramOption[] }>(
      "/admissions/options"
    )
      .then((opts) => {
        const nextFaculties = mergeFaculties(opts.faculties ?? []);
        const nextPrograms = mergePrograms(opts.programs ?? [], nextFaculties);
        setFaculties(nextFaculties);
        setPrograms(nextPrograms);
      })
      .catch(() => {
        setFaculties(FALLBACK_FACULTIES);
        setPrograms(FALLBACK_PROGRAMS);
      })
      .finally(() => setOptionsLoading(false));

    void api<{ isAdmissionsOpen: boolean }>("/settings/public")
      .then((settings) => setAdmissionsOpen(settings.isAdmissionsOpen))
      .catch(() => setAdmissionsOpen(true));
  }, []);

  const filteredPrograms = useMemo(() => {
    if (!form.facultyId) return [];
    const faculty = faculties.find((f) => f.id === form.facultyId);
    if (!faculty) return [];
    const code = faculty.code.toUpperCase();

    const catalog = FALLBACK_PROGRAMS.filter(
      (p) => p.facultyCode.toUpperCase() === code
    ).map((p) => ({
      ...p,
      facultyId: form.facultyId,
    }));

    const fromLoaded = programs.filter(
      (p) =>
        p.facultyId === form.facultyId ||
        (p.facultyCode && p.facultyCode.toUpperCase() === code)
    );

    const byTitle = new Map<string, ProgramOption>();
    for (const p of [...catalog, ...fromLoaded]) {
      const key = p.title.trim().toLowerCase();
      if (!byTitle.has(key)) {
        byTitle.set(key, { ...p, facultyId: form.facultyId });
      }
    }
    return [...byTitle.values()];
  }, [form.facultyId, programs, faculties]);

  const selectedFaculty = faculties.find((f) => f.id === form.facultyId);
  const selectedProgram =
    filteredPrograms.find((p) => p.id === form.programId) ||
    programs.find((p) => p.id === form.programId);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (!form.facultyId || !selectedFaculty) {
        throw new ApiError(400, t("admissions.errorFaculty"));
      }

      const gpa = form.highSchoolGPA.trim()
        ? Number(form.highSchoolGPA)
        : null;
      if (gpa !== null && (Number.isNaN(gpa) || gpa < 0 || gpa > 100)) {
        throw new ApiError(400, t("admissions.errorGpa"));
      }

      const facultyIsFallback = form.facultyId.startsWith("fallback:");
      const programIsFallback =
        !!form.programId && form.programId.startsWith("fallback:");

      const res = await api<ApplyResponse>("/admissions/apply", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          facultyId: facultyIsFallback ? null : form.facultyId,
          facultyCode: selectedFaculty.code,
          programId:
            form.programId && !programIsFallback ? form.programId : null,
          programTitle: selectedProgram?.title ?? null,
          highSchoolGPA: gpa,
          documentsUrl: form.documentsUrl.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      setSuccess(res);
      setForm({
        fullName: "",
        email: "",
        phone: "",
        facultyId: "",
        programId: "",
        highSchoolGPA: "",
        documentsUrl: "",
        notes: "",
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("admissions.errorFailed")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="site-shell min-h-screen bg-[#F4F7FB] transition-colors dark:bg-slate-950"
      style={{ ["--portal-accent" as string]: accentColor }}
      dir={dir}
    >
      <Navbar />

      <main className="relative px-4 pb-16 pt-28 md:px-6 md:pb-20">
        {/* Soft branded atmosphere behind the card */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[#002147]/8 via-[#ea580c]/5 to-transparent" />

        <div
          className={cn(
            "relative mx-auto my-12 max-w-3xl rounded-[32px] border border-white/10",
            "bg-white p-8 shadow-2xl md:p-12",
            "dark:border-slate-700/80 dark:bg-slate-900"
          )}
        >
          {/* Brand header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-2xl border border-[#E5EBF3] bg-[#F4F7FB] p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <img
                src="/dhapti-logo.png"
                alt="Dhapti Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#002147] md:text-3xl dark:text-slate-100">
              Dhapti University
            </h1>
            <p className="mt-2 max-w-md text-sm font-medium text-[#ea580c] md:text-base">
              {t("admissions.title")}
            </p>
            <div
              className="mt-4 h-1 w-16 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </div>

          {!admissionsOpen && !success ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-bold">{t("admissions.closedTitle")}</p>
              <p className="mt-2 text-sm">{t("admissions.closedBody")}</p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#002147] underline-offset-4 hover:underline dark:text-slate-100"
              >
                <ArrowLeft
                  className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                />
                {t("admissions.backHome")}
              </Link>
            </div>
          ) : success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a]/15">
                <CheckCircle2 className="h-8 w-8 text-[#16a34a]" />
              </div>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                {success.message}
              </p>
              <p className="mt-2 text-sm text-emerald-800/90 dark:text-emerald-200/90">
                {t("admissions.trackingIdLabel")}{" "}
                <span className="font-mono font-bold">{success.trackingId}</span>
                . {t("admissions.trackingKeep")}
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  className="rounded-xl bg-[#16a34a] px-6 font-bold hover:bg-[#15803d]"
                  onClick={() => setSuccess(null)}
                >
                  {t("admissions.submitAnother")}
                </Button>
                <Link
                  to="/"
                  className="text-sm font-semibold text-[#002147] underline-offset-4 hover:underline dark:text-slate-100"
                >
                  {t("admissions.backHome")}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className={fieldLabel}>
                    {t("admissions.fullName")}
                  </Label>
                  <Input
                    id="fullName"
                    required
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fullName: e.target.value }))
                    }
                    placeholder={t("admissions.placeholder.fullName")}
                    className={fieldControl}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className={fieldLabel}>
                    {t("admissions.email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder={t("admissions.placeholder.email")}
                    className={fieldControl}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className={fieldLabel}>
                    {t("admissions.phone")}
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder={t("admissions.placeholder.phone")}
                    className={fieldControl}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpa" className={fieldLabel}>
                    {t("admissions.gpa")}
                  </Label>
                  <Input
                    id="gpa"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.highSchoolGPA}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        highSchoolGPA: e.target.value,
                      }))
                    }
                    placeholder={t("admissions.placeholder.gpa")}
                    className={fieldControl}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty" className={fieldLabel}>
                    {t("admissions.faculty")}
                  </Label>
                  <Select
                    value={form.facultyId || undefined}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        facultyId: value,
                        programId: "",
                      }))
                    }
                  >
                    <SelectTrigger
                      id="faculty"
                      className={cn(fieldControl, "w-full")}
                    >
                      <SelectValue
                        placeholder={
                          optionsLoading
                            ? t("admissions.loadingFaculties")
                            : t("admissions.selectFaculty")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      sideOffset={6}
                      align="start"
                      avoidCollisions={false}
                      className="bg-white text-[#002147]"
                    >
                      {faculties.map((f) => (
                        <SelectItem
                          key={f.id}
                          value={f.id}
                          className="!bg-white !text-[#002147] data-[highlighted]:!bg-[#002147] data-[highlighted]:!text-white"
                        >
                          {translateLabel(f.name) || f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="program" className={fieldLabel}>
                    {t("admissions.program")}
                  </Label>
                  <Select
                    key={`program-${form.facultyId || "none"}`}
                    value={form.programId || undefined}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        programId: value === "__none__" ? "" : value,
                      }))
                    }
                    disabled={!form.facultyId || filteredPrograms.length === 0}
                  >
                    <SelectTrigger
                      id="program"
                      className={cn(
                        fieldControl,
                        "w-full disabled:opacity-60"
                      )}
                    >
                      <SelectValue
                        placeholder={
                          !form.facultyId
                            ? t("admissions.selectFacultyFirst")
                            : filteredPrograms.length === 0
                              ? t("admissions.noPrograms")
                              : t("admissions.selectProgram")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="bottom"
                      sideOffset={6}
                      align="start"
                      avoidCollisions={false}
                      className="bg-white text-[#002147]"
                    >
                      <SelectItem
                        value="__none__"
                        className="!bg-white !text-[#002147] data-[highlighted]:!bg-[#002147] data-[highlighted]:!text-white"
                      >
                        {t("admissions.noProgramSelected")}
                      </SelectItem>
                      {filteredPrograms.map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          className="!bg-white !text-[#002147] data-[highlighted]:!bg-[#002147] data-[highlighted]:!text-white"
                        >
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="documentsUrl" className={fieldLabel}>
                    {t("admissions.documents")}
                  </Label>
                  <Input
                    id="documentsUrl"
                    type="url"
                    value={form.documentsUrl}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        documentsUrl: e.target.value,
                      }))
                    }
                    placeholder={t("admissions.placeholder.documents")}
                    className={fieldControl}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes" className={fieldLabel}>
                    {t("admissions.notes")}
                  </Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={3}
                    placeholder={t("admissions.placeholder.notes")}
                    className="min-h-[96px] rounded-xl border-[#E5EBF3] bg-white text-[#002147] shadow-sm focus-visible:border-[#ea580c] focus-visible:ring-2 focus-visible:ring-[#ea580c]/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={busy || !form.facultyId}
                className="w-full rounded-xl bg-[#16a34a] py-4 text-lg font-bold text-white shadow-xl hover:bg-[#15803d] disabled:opacity-60"
              >
                {busy ? t("admissions.submitting") : t("admissions.submit")}
              </Button>

              <div className="text-center">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#002147]/70 underline-offset-4 hover:text-[#002147] hover:underline dark:text-slate-300"
                >
                  <ArrowLeft
                    className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                  />
                  {t("admissions.backHome")}
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
