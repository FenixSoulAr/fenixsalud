import { en, type Translations } from "./translations/en";
import { es } from "./translations/es";

const translations: Record<string, Translations> = { en, es };

const LANG_KEY = "mhh_lang";

function detectLanguage(): "es" | "en" {
  // 1. User preference stored in localStorage
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === "es" || stored === "en") return stored;
  // 2. Browser language fallback
  if (typeof navigator === "undefined") return "en";
  const browserLang = (navigator.language || "en").toLowerCase();
  return browserLang.startsWith("es") ? "es" : "en";
}

let cachedLang: "es" | "en" | null = null;

export function getLanguage(): "es" | "en" {
  if (cachedLang === null) {
    cachedLang = detectLanguage();
  }
  return cachedLang;
}

export function setLanguage(lang: "es" | "en"): void {
  localStorage.setItem(LANG_KEY, lang);
  cachedLang = lang;
  window.location.reload();
}

export function t(): Translations {
  return translations[getLanguage()] || translations.en;
}

export function useTranslations(): Translations {
  return t();
}

export { type Translations };
