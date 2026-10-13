import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';

const languageLabels: Record<typeof supportedLanguages[number], string> = {
  en: 'EN · English',
  fr: 'FR · Français',
  it: 'IT · Italiano',
  de: 'DE · Deutsch',
  'en-x-lolcat': 'LOL · Lolcat',
};

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-white">
      <span className="sr-only">{t('Language')}</span>
      <select
        value={i18n.resolvedLanguage ?? 'en'}
        onChange={(event) => { void i18n.changeLanguage(event.target.value); }}
        className="cursor-pointer rounded border border-green-600 bg-green-900 px-2 py-1 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-200"
      >
        {supportedLanguages.map((language) => (
          <option key={language} value={language} lang={language}>
            {languageLabels[language]}
          </option>
        ))}
      </select>
    </label>
  );
}
