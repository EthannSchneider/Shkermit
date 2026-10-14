import { useTranslation } from 'react-i18next';
import img1 from "../../../assets/img/1 ShkermitRTX.png";
import img6 from "../../../assets/img/6 ShkermitTHUG.png";
import img7 from "../../../assets/img/7 ShkermitTHUG RTX.png";
import img8 from "../../../assets/img/8 Shkermlette.png";

export type Weapon = {
  id: string;
  name: string;
  namePlural?: string;
  description: string;
  cost: number;
  shkermitesPerClick: number;
  image: string;
};

export interface WeaponsShopProps {
  score: number;
  weaponCounts: Record<string, number>;
  onPurchase: (weapon: Weapon) => void;
}

const weapons: Weapon[] = [
  {
    id: 'weapon1',
    name: 'Power Glove',
    namePlural: 'Power Gloves',
    description: '+2 shkermites per click',
    cost: 500,
    shkermitesPerClick: 2,
    image: img8
  },
  {
    id: 'weapon2',
    name: 'Hammer',
    namePlural: 'Hammers',
    description: '+10 shkermites per click',
    cost: 2000,
    shkermitesPerClick: 10,
    image: img6
  },
  {
    id: 'weapon3',
    name: 'Machine Gun',
    namePlural: 'Machine Guns',
    description: '+50 shkermites per click',
    cost: 10000,
    shkermitesPerClick: 50,
    image: img7
  },
  {
    id: 'weapon4',
    name: 'Laser Gun',
    namePlural: 'Laser Guns',
    description: '+350 shkermites per click',
    cost: 50000,
    shkermitesPerClick: 350,
    image: img1
  },
  {
    id: 'weapon5',
    name: 'Nuke',
    namePlural: 'Nukes',
    description: '+6969 shkermites per click',
    cost: 200000,
    shkermitesPerClick: 6969,
    image: img7
  },
];

export default function WeaponsShop({ score, weaponCounts, onPurchase }: WeaponsShopProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-xl lg:h-[500px] lg:overflow-y-auto">
      <h3 className="text-2xl font-bold mb-6 text-red-300">{t("Weapons Shop 🔫")}</h3>

      <div className="space-y-3">
        {weapons.map((weapon) => {
          const count = weaponCounts[weapon.id] || 0;
          const canAfford = score >= weapon.cost;

          return (
            <button
              type="button"
              key={weapon.id}
              disabled={!canAfford}
              onClick={() => onPurchase(weapon)}
              aria-label={t("Buy {{value1}} for {{value2}} shkermites", { value1: t(weapon.name), value2: weapon.cost.toLocaleString(i18n.resolvedLanguage) })}
              className={`w-full p-4 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center gap-3 ${
                canAfford
                  ? 'bg-linear-to-b from-red-500/50 to-orange-500/50 border border-red-400 hover:scale-105 hover:from-red-500/60 hover:to-orange-500/60'
                  : 'bg-gray-500/30 border border-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex w-full min-w-0 items-center gap-3">
                <img
                  src={weapon.image}
                  alt={t(weapon.name)}
                  className="h-12 w-12 shrink-0 sm:h-16 sm:w-16 object-contain"
                />
                <div className="min-w-0 text-left">
                  <h4 className="font-bold text-sm sm:text-lg">
                    {t(count > 0 ? weapon.namePlural || weapon.name : weapon.name)}
                  </h4>
                  <p className="text-sm opacity-80">{t(weapon.description)}</p>
                </div>
              </div>
              <div className="w-full flex flex-wrap gap-2 justify-between items-center pt-2 border-t border-white/10">
                <div className="bg-black/30 rounded-lg px-3 py-2 min-w-0 flex-1 text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {weapon.cost.toLocaleString(i18n.resolvedLanguage)}
                  </div>
                </div>
                {count > 0 ? (
                  <div className="text-green-400 text-sm font-bold px-3">{t("ownedCount", { count, formattedCount: count.toLocaleString(i18n.resolvedLanguage) })}</div>
                ) : (
                  <div className="text-red-400 text-sm font-bold px-3">{t("Buy")}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
