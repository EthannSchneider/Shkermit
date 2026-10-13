import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import de from './locales/de.json';
import lolcat from './locales/en-x-lolcat.json';

export const supportedLanguages = ['en', 'fr', 'it', 'de', 'en-x-lolcat'] as const;

function updateDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.resolvedLanguage ?? language.split('-')[0];
    document.documentElement.dir = i18n.dir(language);
  }
}

i18n.on('languageChanged', updateDocumentLanguage);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      it: { translation: it },
      de: { translation: de },
      'en-x-lolcat': { translation: lolcat },
    },
    supportedLngs: [...supportedLanguages],
    fallbackLng: 'en',
    // Keep the private English variant so Lolcat also works with Intl formatting.
    load: 'all',
    initAsync: false,
    // English phrases are the keys, including punctuation.
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'shkermitLanguage',
      caches: ['localStorage'],
      convertDetectedLanguage: (language) => {
        const normalized = language.toLowerCase();
        return normalized === 'en-x-lolcat' ? normalized : normalized.split('-')[0];
      },
    },
  });

updateDocumentLanguage(i18n.resolvedLanguage ?? 'en');

export default i18n;
