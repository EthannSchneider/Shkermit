import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';

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
            {language === 'en' ? 'EN · English' : 'FR · Français'}
          </option>
        ))}
      </select>
    </label>
  );
}
