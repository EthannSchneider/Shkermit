import img2 from "../../../assets/img/2 Shkermit RTX PDP.png";
import img3 from "../../../assets/img/3 TeteShkermit RTX.png";
import img4 from "../../../assets/img/4 ShkermitMLG.png";
import img5 from "../../../assets/img/5 ShkermitMLG RTX.png";

export type Upgrade = {
  id: string;
  name: string;
  description: string;
  cost: number;
  clicksPerSecond: number;
  image: string;
};

export interface ShopProps {
  score: number;
  unlockedUpgrades: string[];
  onPurchase: (upgrade: Upgrade) => void;
}

const upgrades: Upgrade[] = [
  {
    id: 'upgrade1',
    name: 'Shkermit Hand',
    description: '+1 click per second',
    cost: 15,
    clicksPerSecond: 1,
    image: img2
  },
  {
    id: 'upgrade2',
    name: 'Shkermit Robot',
    description: '+5 clicks per second',
    cost: 100,
    clicksPerSecond: 5,
    image: img4
  },
  {
    id: 'upgrade3',
    name: 'Shkermit Factory',
    description: '+20 clicks per second',
    cost: 500,
    clicksPerSecond: 20,
    image: img5
  },
  {
    id: 'shkermite',
    name: 'Shkermite Swarm',
    description: '+50 clicks per second',
    cost: 2000,
    clicksPerSecond: 50,
    image: img3
  },
];

export default function Shop({ score, unlockedUpgrades, onPurchase }: ShopProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
      <h3 className="text-2xl font-bold mb-4 text-purple-300">Shkermit Shop 🛒</h3>

      <div className="space-y-3">
        {upgrades.map((upgrade) => {
          const isUnlocked = unlockedUpgrades.includes(upgrade.id);
          const canAfford = score >= upgrade.cost;

          return (
            <div
              key={upgrade.id}
              onClick={() => !isUnlocked && onPurchase(upgrade)}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-4 ${
                isUnlocked
                  ? 'bg-green-500/30 border border-green-400 opacity-60'
                  : canAfford
                  ? 'bg-linear-to-b from-purple-500/50 to-pink-500/50 border border-purple-400 hover:scale-105'
                  : 'bg-gray-500/30 border border-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              <img
                src={upgrade.image}
                alt={upgrade.name}
                className="h-16 w-16 object-contain"
              />
              <div className="flex-1">
                <h4 className="font-bold text-lg">{upgrade.name}</h4>
                <p className="text-sm opacity-80">{upgrade.description}</p>
              </div>
              <div className="text-right">
                <div className="bg-black/30 rounded-lg px-3 py-2">
                  <div className="text-lg font-bold text-yellow-400">
                    {upgrade.cost.toLocaleString()}
                  </div>
                </div>
                {isUnlocked ? (
                  <div className="text-green-400 text-sm font-bold mt-1">✓ Owned</div>
                ) : (
                  <div className="text-purple-400 text-sm font-bold mt-1">Buy</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
