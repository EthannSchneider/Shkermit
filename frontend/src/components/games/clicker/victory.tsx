export const VICTORY_COST = 100_000_000_000;

type VictoryProps = {
  score: number;
  hasWon: boolean;
  showCelebration: boolean;
  onPurchase: () => void;
  onDismiss: () => void;
  onReset: () => void;
};

export default function Victory({
  score,
  hasWon,
  showCelebration,
  onPurchase,
  onDismiss,
  onReset,
}: VictoryProps) {
  const canAfford = score >= VICTORY_COST;

  return (
    <>
      <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-yellow-400/30">
        <h3 className="text-2xl font-bold text-yellow-300">Victory 🏆</h3>
        <p className="mt-2 text-sm text-gray-300">
          {hasWon
            ? 'You conquered the Shkermit Clicker!'
            : 'Buy the ultimate victory and become the Shkermit champion.'}
        </p>

        <button
          type="button"
          onClick={onPurchase}
          disabled={!canAfford || hasWon}
          className={`mt-4 w-full rounded-xl px-4 py-3 font-bold transition-all duration-200 ${
            hasWon
              ? 'bg-green-500/30 border border-green-400 text-green-300 cursor-default'
              : canAfford
                ? 'bg-linear-to-r from-yellow-500 to-orange-500 text-black hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/30'
                : 'bg-gray-500/30 border border-gray-400 text-gray-400 cursor-not-allowed'
          }`}
        >
          {hasWon ? 'Victory claimed! ✓' : `Claim Victory — ${VICTORY_COST.toLocaleString()}`}
        </button>
      </div>

      {showCelebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="victory-title"
        >
          <div className="w-full max-w-lg rounded-3xl border-2 border-yellow-400 bg-linear-to-b from-purple-900 to-indigo-950 p-8 text-center shadow-2xl shadow-yellow-500/30">
            <div className="text-7xl" aria-hidden="true">🏆</div>
            <h2 id="victory-title" className="mt-4 text-4xl font-bold text-yellow-300">
              Victory!
            </h2>
            <p className="mt-4 text-lg text-white">
              You spent {VICTORY_COST.toLocaleString()} shkermites and conquered the clicker!
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg bg-purple-600 px-5 py-3 font-bold transition-colors hover:bg-purple-500"
              >
                Keep playing
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg bg-red-700 px-5 py-3 font-bold transition-colors hover:bg-red-600"
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
