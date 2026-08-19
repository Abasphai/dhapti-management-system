export type CmsLocale = "en" | "so" | "ar";

export const CMS_LOCALES: CmsLocale[] = ["en", "so", "ar"];

export function parseCmsLocale(value: unknown): CmsLocale {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "so" || raw === "ar" || raw === "en") return raw;
  return "en";
}

/**
 * Pick localized string; fall back to English / default when missing.
 */
export function pickLocalized(
  lang: CmsLocale,
  english: string | null | undefined,
  so?: string | null | undefined,
  ar?: string | null | undefined
): string {
  const en = english ?? "";
  if (lang === "so") {
    const v = (so ?? "").trim();
    return v || en;
  }
  if (lang === "ar") {
    const v = (ar ?? "").trim();
    return v || en;
  }
  return en;
}

/**
 * Merge block payload with optional `i18n.so` / `i18n.ar` overrides.
 * English fields on the root remain the default; missing locale keys fall back.
 */
export function resolveBlockPayloadForLocale(
  payload: unknown,
  lang: CmsLocale
): unknown {
  if (!payload || typeof payload !== "object") return payload;
  if (lang === "en") {
    const { i18n: _i18n, ...rest } = payload as Record<string, unknown>;
    return rest;
  }
  const root = payload as Record<string, unknown>;
  const i18n = (root.i18n ?? {}) as Record<string, unknown>;
  const localeBag =
    lang === "so"
      ? (i18n.so as Record<string, unknown> | undefined)
      : (i18n.ar as Record<string, unknown> | undefined);
  if (!localeBag || typeof localeBag !== "object") {
    const { i18n: _i18n, ...rest } = root;
    return rest;
  }
  const { i18n: _drop, ...base } = root;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(localeBag)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    merged[key] = value;
  }
  return merged;
}
