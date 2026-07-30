import { useState, useEffect } from 'react';
import img1 from "@/assets/img/1 ShkermitRTX.png";
import img2 from "@/assets/img/2 Shkermit RTX PDP.png";
import img3 from "@/assets/img/3 TeteShkermit RTX.png";
import img4 from "@/assets/img/4 ShkermitMLG.png";
import img5 from "@/assets/img/5 ShkermitMLG RTX.png";

type Upgrade = {
  id: string;
  name: string;
  description: string;
  cost: number;
  clicksPerSecond: number;
  image: string;
};

export default function ShkermitClicker() {
  const [score, setScore] = useState(0);
  const [shkermitesPerClick, setShkermitesPerClick] = useState(1);
  const [clicksPerSecond, setClicksPerSecond] = useState(0);
  const [unlockedUpgrades, setUnlockedUpgrades] = useState<string[]>([]);

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

  const handleMainClick = () => {
    setScore(prev => prev + 1);
  };

  const resetGame = () => {
    setScore(0);
    setClicksPerSecond(0);
    setShkermitesPerClick(1);
    setUnlockedUpgrades([]);
  };

  const purchaseUpgrade = (upgrade: Upgrade) => {
    if (score >= upgrade.cost && !unlockedUpgrades.includes(upgrade.id)) {
      setScore(prev => prev - upgrade.cost);
      setUnlockedUpgrades([...unlockedUpgrades, upgrade.id]);
      setClicksPerSecond(prev => prev + upgrade.clicksPerSecond);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (clicksPerSecond > 0) {
        setScore(prev => prev + clicksPerSecond);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [clicksPerSecond]);

  return (
    <div className="min-h-screen bg-linear-to-b from-purple-900 via-indigo-900 to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-linear-to-b from-purple-400 to-pink-500">
          ⭐ Shkermit Clicker ⭐
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 justify-center lg:items-start items-center-safe">
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl w-full flex flex-col">
              <div className="text-6xl mb-4">🖱️</div>
              <img
                src={img1}
                alt="Shkermit"
                onClick={handleMainClick}
                className="h-64 object-contain cursor-pointer hover:scale-110 transition-transform duration-200"
              />
              <div className="text-8xl font-bold text-center mt-6 text-yellow-400 drop-shadow-lg">
                {score.toLocaleString()}
              </div>
              <div className="text-center text-sm text-gray-300 mt-2">
                shkermites
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl w-full">
              <h3 className="text-xl font-bold mb-3 text-purple-300">Stats</h3>
              <p className="text-2xl">
                Per second:
                <span className="text-green-400 font-bold">{clicksPerSecond.toLocaleString()}</span>
              </p>
              <p className="text-2xl">
                Per click:
                <span className="text-green-400 font-bold">{shkermitesPerClick.toLocaleString()}</span>
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Shkermites per second = Clicks per second
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
              <h3 className="text-2xl font-bold mb-4 text-purple-300">Shkermit Shop 🛒</h3>

              <div className="space-y-3">
                {upgrades.map((upgrade) => {
                  const isUnlocked = unlockedUpgrades.includes(upgrade.id);
                  const canAfford = score >= upgrade.cost;

                  return (
                    <div
                      key={upgrade.id}
                      onClick={() => !isUnlocked && purchaseUpgrade(upgrade)}
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

            <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => resetGame()}
                  className="bg-linear-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white px-5 py-3 rounded-lg shadow-lg hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105 ring-2 ring-red-400/50"
                >
                  Reset Game 🔄
                </button>
                <button // TODO: add an effect
                  className="bg-linear-to-br from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 ring-2 ring-blue-400/50 active:scale-95"
                >
                  ✨ Open a Crate ✨
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Click the Shkermit to earn shkermites! 💫
          </p>
        </div>
      </div>
    </div>
  );
}
