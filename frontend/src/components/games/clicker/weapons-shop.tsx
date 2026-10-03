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
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl h-[500px] overflow-y-auto">
      <h3 className="text-2xl font-bold mb-6 text-red-300">Weapons Shop 🔫</h3>

      <div className="space-y-3">
        {weapons.map((weapon) => {
          const count = weaponCounts[weapon.id] || 0;
          const canAfford = score >= weapon.cost;

          return (
            <div
              key={weapon.id}
              onClick={() => canAfford && onPurchase(weapon)}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center gap-3 ${
                canAfford
                  ? 'bg-linear-to-b from-red-500/50 to-orange-500/50 border border-red-400 hover:scale-105 hover:from-red-500/60 hover:to-orange-500/60'
                  : 'bg-gray-500/30 border border-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={weapon.image}
                  alt={weapon.name}
                  className="h-16 w-16 object-contain"
                />
                <div className="text-left">
                  <h4 className="font-bold text-lg">
                    {count > 0 ? weapon.namePlural || weapon.name : weapon.name}
                  </h4>
                  <p className="text-sm opacity-80">{weapon.description}</p>
                </div>
              </div>
              <div className="w-full flex justify-between items-center pt-2 border-t border-white/10">
                <div className="bg-black/30 rounded-lg px-3 py-2 flex-1 text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {weapon.cost.toLocaleString()}
                  </div>
                </div>
                {count > 0 ? (
                  <div className="text-green-400 text-sm font-bold px-3">{count} Owned</div>
                ) : (
                  <div className="text-red-400 text-sm font-bold px-3">Buy</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
