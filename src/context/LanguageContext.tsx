import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  t as translateKey,
  translateLabel,
  type Lang,
  type TranslationKey,
} from "@/locales/translations";

const STORAGE_KEY = "selectedLang";
/** Kept in sync so CMS ?lang= helpers keep working. */
const CMS_LOCALE_KEY = "biu.cms.locale";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  dir: "ltr" | "rtl";
  t: (key: TranslationKey) => string;
  translateLabel: (label: string, href?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLang(): Lang {
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

function applyDocumentLang(lang: Lang) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      applyDocumentLang(lang);
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.setItem(CMS_LOCALE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (next === "en" || next === "so" || next === "ar") {
      setLangState(next);
    }
  }, []);

  const tFn = useCallback((key: TranslationKey) => {
    try {
      return translateKey(lang, key);
    } catch {
      return String(key);
    }
  }, [lang]);

  const translateLabelFn = useCallback(
    (label: string, href?: string) => {
      try {
        return translateLabel(lang, label, href);
      } catch {
        return label;
      }
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      dir,
      t: tFn,
      translateLabel: translateLabelFn,
    }),
    [lang, setLang, dir, tFn, translateLabelFn]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

const SAFE_LANGUAGE: LanguageContextValue = {
  lang: "en",
  setLang: () => undefined,
  dir: "ltr",
  t: (key) => String(key),
  translateLabel: (label) => label,
};

export function useLanguage() {
  return useContext(LanguageContext) ?? SAFE_LANGUAGE;
}

export type { Lang, TranslationKey };
