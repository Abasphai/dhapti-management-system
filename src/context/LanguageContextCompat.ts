import type { Lang } from "@/locales/translations";

const STORAGE_KEY = "selectedLang";
const CMS_LOCALE_KEY = "biu.cms.locale";

export function getStoredLocale(): Lang {
  try {
    const selected = localStorage.getItem(STORAGE_KEY);
    if (selected === "en" || selected === "so" || selected === "ar") {
      return selected;
    }
    const legacy = localStorage.getItem(CMS_LOCALE_KEY);
    if (legacy === "en" || legacy === "so" || legacy === "ar") {
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

/** Pick localized string with English fallback. */
export function tField(
  en: string | null | undefined,
  so?: string | null | undefined,
  ar?: string | null | undefined,
  locale?: Lang
): string {
  const lang = locale ?? getStoredLocale();
  const english = en ?? "";
  if (lang === "so") {
    const v = (so ?? "").trim();
    return v || english;
  }
  if (lang === "ar") {
    const v = (ar ?? "").trim();
    return v || english;
  }
  return english;
}
