import { useState, useEffect, useRef } from 'react';
import Shkermit from '../../components/games/clicker/shkermit';
import Stats from '../../components/games/clicker/stats';
import Shop, { type Upgrade } from '../../components/games/clicker/shop';
import Buttons from '../../components/games/clicker/buttons';

export default function ShkermitClicker() {
  const [score, setScore] = useState(0);
  const [shkermitesPerClick, setShkermitesPerClick] = useState(1);
  const [clicksPerSecond, setClicksPerSecond] = useState(0);
  const [unlockedUpgrades, setUnlockedUpgrades] = useState<string[]>([]);
  const initialLoadRef = useRef(true);


  useEffect(() => {
    const loadSaved = () => {
      const savedGame = localStorage.getItem('shkermitClicker');
      if (savedGame) {
        try {
          const parsed = JSON.parse(savedGame);
          setScore(parsed.score || 0);
          setClicksPerSecond(parsed.clicksPerSecond || 0);
          setUnlockedUpgrades(parsed.unlockedUpgrades || []);
        } catch (error) {
          console.error('Failed to load saved game:', error);
        }
      }
    };
    if (initialLoadRef.current) {
      loadSaved();
      initialLoadRef.current = false;
    }
  }, []);
  const handleMainClick = () => {
    setScore(prev => prev + shkermitesPerClick);
  };

  const resetGame = () => {
    setScore(0);
    setClicksPerSecond(0);
    setShkermitesPerClick(1);
    setUnlockedUpgrades([]);
    localStorage.removeItem('shkermitClicker');
  };

   const purchaseUpgrade = (upgrade: Upgrade) => {
    if (score >= upgrade.cost) {
      setScore(prev => prev - upgrade.cost);
      setUnlockedUpgrades([...unlockedUpgrades, upgrade.id]);
      setClicksPerSecond(prev => prev + upgrade.clicksPerSecond);
    }
  };

  const upgradeCounts: Record<string, number> = unlockedUpgrades.reduce(
    (acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (clicksPerSecond > 0) {
        setScore(prev => prev + clicksPerSecond);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [clicksPerSecond]);

  useEffect(() => {
    const gameData = JSON.stringify({
      score,
      clicksPerSecond,
      unlockedUpgrades,
      shkermitesPerClick,
    });
    localStorage.setItem('shkermitClicker', gameData);
  }, [score, clicksPerSecond, unlockedUpgrades, shkermitesPerClick]);

  return (
    <div className="min-h-screen bg-linear-to-b from-purple-900 via-indigo-900 to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-linear-to-b from-purple-400 to-pink-500">
          ⭐ Shkermit Clicker ⭐
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 justify-center lg:items-start items-center-safe">
          <div className="flex flex-col items-center gap-6">
            <Shkermit score={score} handleMainClick={handleMainClick} />

            <Stats clicksPerSecond={clicksPerSecond} shkermitesPerClick={shkermitesPerClick} />
          </div>

          <div className="flex-1 max-w-md">
            <Shop score={score} upgradeCounts={upgradeCounts} onPurchase={purchaseUpgrade} />
            <Buttons onReset={resetGame} />
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
