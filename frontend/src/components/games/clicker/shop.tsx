import img2 from "../../../assets/img/2 Shkermit RTX PDP.png";
import img3 from "../../../assets/img/3 TeteShkermit RTX.png";
import img4 from "../../../assets/img/4 ShkermitMLG.png";
import img5 from "../../../assets/img/5 ShkermitMLG RTX.png";

export type Upgrade = {
  id: string;
  name: string;
  namePlural?: string;
  description: string;
  cost: number;
  clicksPerSecond: number;
  image: string;
};

export interface ShopProps {
  score: number;
  upgradeCounts: Record<string, number>;
  onPurchase: (upgrade: Upgrade) => void;
}

const upgrades: Upgrade[] = [
  {
    id: 'upgrade1',
    name: 'Shkermit Hand',
    namePlural: 'Shkermit Hands',
    description: '+1 click per second',
    cost: 150,
    clicksPerSecond: 1,
    image: img2
  },
  {
    id: 'upgrade2',
    name: 'Shkermit Robot',
    namePlural: 'Shkermit Robots',
    description: '+5 clicks per second',
    cost: 1000,
    clicksPerSecond: 5,
    image: img4
  },
  {
    id: 'upgrade3',
    name: 'Shkermit Factory',
    namePlural: 'Shkermit Factories',
    description: '+20 clicks per second',
    cost: 5000,
    clicksPerSecond: 20,
    image: img5
  },
  {
    id: 'shkermite',
    name: 'Shkermite Swarm',
    namePlural: 'Shkermite Swarms',
    description: '+50 clicks per second',
    cost: 20000,
    clicksPerSecond: 50,
    image: img3
  },
];

export default function Shop({ score, upgradeCounts, onPurchase }: ShopProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl h-[500px] overflow-y-auto">
      <h3 className="text-2xl font-bold mb-6 text-purple-300">Shkermit Shop 🛒</h3>

      <div className="space-y-3">
        {upgrades.map((upgrade) => {
          const count = upgradeCounts[upgrade.id] || 0;
          const canAfford = score >= upgrade.cost;

          return (
            <div
              key={upgrade.id}
              onClick={() => canAfford && onPurchase(upgrade)}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center gap-3 ${
                canAfford
                  ? 'bg-linear-to-b from-purple-500/50 to-pink-500/50 border border-purple-400 hover:scale-105 hover:from-purple-500/60 hover:to-pink-500/60'
                  : 'bg-gray-500/30 border border-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={upgrade.image}
                  alt={upgrade.name}
                  className="h-16 w-16 object-contain"
                />
                <div className="text-left">
                  <h4 className="font-bold text-lg">
                    {count > 0 ? upgrade.namePlural || upgrade.name : upgrade.name}
                  </h4>
                  <p className="text-sm opacity-80">{upgrade.description}</p>
                </div>
              </div>
              <div className="w-full flex justify-between items-center pt-2 border-t border-white/10">
                <div className="bg-black/30 rounded-lg px-3 py-2 flex-1 text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {upgrade.cost.toLocaleString()}
                  </div>
                </div>
                {count > 0 ? (
                  <div className="text-green-400 text-sm font-bold px-3">{count} Owned</div>
                ) : (
                  <div className="text-purple-400 text-sm font-bold px-3">Buy</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
