import { en, type Translations } from "./translations/en";
import { es } from "./translations/es";

const translations: Record<string, Translations> = { en, es };

/**
 * Detects if the user's browser language is Spanish
 */
function detectLanguage(): "es" | "en" {
  if (typeof navigator === "undefined") return "en";
  
  const browserLang = navigator.language || (navigator as any).userLanguage || "en";
  const langCode = browserLang.toLowerCase();
  
  // Check for Spanish variants (es, es-AR, es-ES, es-MX, etc.)
  if (langCode.startsWith("es")) {
    return "es";
  }
  
  return "en";
}

// Cached language detection
let cachedLang: "es" | "en" | null = null;

export function getLanguage(): "es" | "en" {
  if (cachedLang === null) {
    cachedLang = detectLanguage();
  }
  return cachedLang;
}

export function t(): Translations {
  const lang = getLanguage();
  return translations[lang] || translations.en;
}

// Helper to get a specific translation string
export function useTranslations(): Translations {
  return t();
}

export { type Translations };
