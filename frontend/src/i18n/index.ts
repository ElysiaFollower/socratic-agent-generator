/**
 * i18n configuration for react-i18next
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zh from "./locales/zh.json";
import en from "./locales/en.json";

// Supported languages - maps display names to LLM instruction strings
export const SUPPORTED_LANGUAGES = {
  zh: { displayName: "简体中文", llmLanguage: "Simplified Chinese" },
  en: { displayName: "English", llmLanguage: "English" },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    fallbackLng: "en",
    defaultNS: "translation",
    ns: "translation",
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    lng: "en", // Explicitly set default language to English
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;
