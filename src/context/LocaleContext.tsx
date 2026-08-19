/**
 * Compatibility bridge for CMS i18n helpers.
 * Source of truth: LanguageContext (`selectedLang` + document dir/lang).
 */
import {
  LanguageProvider,
  useLanguage,
  type Lang,
} from "@/context/LanguageContext";
import { getStoredLocale, tField } from "@/context/LanguageContextCompat";

export type Locale = Lang;

export { LanguageProvider as LocaleProvider, getStoredLocale, tField };

/** CMS-friendly alias — `locale` maps to LanguageContext `lang`. */
export function useLocale() {
  const { lang, setLang, dir, t, translateLabel } = useLanguage();
  return {
    locale: lang,
    setLocale: setLang,
    dir,
    lang,
    setLang,
    t,
    translateLabel,
  };
}
