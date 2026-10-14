import { useTranslation } from 'react-i18next';
const Stats = ({ clicksPerSecond, shkermitesPerClick }: { clicksPerSecond: number; shkermitesPerClick: number }) => {
  const { t, i18n } = useTranslation();
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl w-full">
      <h3 className="text-xl font-bold mb-3 text-purple-300">{t("Stats")}</h3>
      <p className="text-lg sm:text-2xl"> {t("Per second:")} <span className="text-green-400 font-bold">{clicksPerSecond.toLocaleString(i18n.resolvedLanguage)}</span>
      </p>
      <p className="text-lg sm:text-2xl"> {t("Per click:")} <span className="text-green-400 font-bold">{shkermitesPerClick.toLocaleString(i18n.resolvedLanguage)}</span>
      </p>
      <p className="text-sm text-gray-400 mt-1"> {t("Shkermites per second = Clicks per second")} </p>
    </div>
  );
};

export default Stats;
