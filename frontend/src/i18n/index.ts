import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const supportedLanguages = ['en', 'fr'] as const;

function updateDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language.split('-')[0];
    document.documentElement.dir = i18n.dir(language);
  }
}

i18n.on('languageChanged', updateDocumentLanguage);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    supportedLngs: [...supportedLanguages],
    fallbackLng: 'en',
    load: 'languageOnly',
    initAsync: false,
    // English phrases are the keys, including punctuation.
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'shkermitLanguage',
      caches: ['localStorage'],
    },
  });

updateDocumentLanguage(i18n.resolvedLanguage ?? 'en');

export default i18n;
