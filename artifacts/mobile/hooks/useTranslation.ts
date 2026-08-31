import en from "../i18n/en.json";
import es from "../i18n/es.json";
import fr from "../i18n/fr.json";
import zh from "../i18n/zh.json";

type TranslationDict = typeof en;

const TRANSLATIONS: Record<string, TranslationDict> = { en, es, fr, zh };

function detectLocale(): string {
  try {
    const locale = typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : "en";
    const lang = locale.split("-")[0] || "en";
    return TRANSLATIONS[lang] ? lang : "en";
  } catch {
    return "en";
  }
}

const activeLocale = detectLocale();
const dict: TranslationDict = TRANSLATIONS[activeLocale] ?? en;

type NestedKeyOf<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends object
    ? NestedKeyOf<T[K], `${Prefix}${string & K}.`>
    : `${Prefix}${string & K}`;
}[keyof T];

type TranslationKey = NestedKeyOf<TranslationDict>;

export function useTranslation() {
  function t(key: TranslationKey, fallback?: string): string {
    const parts = (key as string).split(".");
    let current: unknown = dict;
    for (const part of parts) {
      if (typeof current !== "object" || current === null) return fallback ?? (key as string);
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : fallback ?? (key as string);
  }

  return { t, locale: activeLocale };
}
