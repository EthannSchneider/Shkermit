import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { api, type GameLeaderboard } from '../lib/api';

const BOARD_DETAILS: Record<string, { title: string; icon: string; accent: string }> = {
  'clicker:classic': { title: 'Shkermit Clicker', icon: '🖱️', accent: 'text-pink-300' },
  'snake:classic': { title: 'Snake · Classic', icon: '🐍', accent: 'text-emerald-300' },
  'tetris:solo': { title: 'Stacks · Solo', icon: '🧩', accent: 'text-lime-300' },
  'tetris:coop': { title: 'Stacks · Pond Pair', icon: '🐸', accent: 'text-pink-200' },
  'tetris:duel': { title: 'Stacks · Swamp Duel', icon: '⚔️', accent: 'text-orange-300' },
};

const medal = (rank: number) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? `#${rank}`);

export default function GameStats() {
  const { user } = useAuth();
  const [leaderboards, setLeaderboards] = useState<GameLeaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLeaderboards = useCallback(() => {
    setLoading(true);
    setError('');
    api.getLeaderboards()
      .then(({ leaderboards: nextLeaderboards }) => setLeaderboards(nextLeaderboards))
      .catch(() => setError('The scoreboards could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    api.getLeaderboards()
      .then(({ leaderboards: nextLeaderboards }) => {
        if (active) setLeaderboards(nextLeaderboards);
      })
      .catch(() => {
        if (active) setError('The scoreboards could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-linear-to-b from-purple-950 via-indigo-950 to-black px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link to="/games" className="text-xs text-purple-200/60 transition hover:text-purple-200">← GAME HAVEN</Link>
            <p className="mt-7 text-xs tracking-[0.3em] text-pink-300">HALL OF FROGS</p>
            <h1 className="mt-2 text-4xl font-bold sm:text-6xl">Best score boards</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">The ten highest account records for every available game and gameplay mode.</p>
          </div>
          <button
            type="button"
            onClick={loadLeaderboards}
            disabled={loading}
            className="rounded-xl border border-purple-300/20 bg-purple-300/10 px-5 py-3 text-xs text-purple-100 transition hover:bg-purple-300/20 disabled:opacity-50"
          >
            {loading ? 'LOADING…' : 'REFRESH SCORES'}
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">
            {error} <button type="button" onClick={loadLeaderboards} className="ml-2 underline">Try again</button>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(loading && leaderboards.length === 0
            ? Object.keys(BOARD_DETAILS).map((key) => {
                const [game, mode] = key.split(':');
                return { game, mode, entries: [] };
              })
            : leaderboards
          ).map((board) => {
            const details = BOARD_DETAILS[`${board.game}:${board.mode}`];
            if (!details) return null;
            return (
              <section key={`${board.game}:${board.mode}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-sm">
                <header className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
                  <span className="text-2xl" aria-hidden="true">{details.icon}</span>
                  <h2 className={`text-sm font-bold ${details.accent}`}>{details.title}</h2>
                </header>
                <ol className="divide-y divide-white/6">
                  {loading && board.entries.length === 0 ? (
                    [...Array(5)].map((_, index) => <li key={index} className="mx-5 my-3 h-7 animate-pulse rounded bg-white/5" />)
                  ) : board.entries.length === 0 ? (
                    <li className="px-5 py-10 text-center text-xs text-white/35">No score yet. Be the first frog!</li>
                  ) : board.entries.map((entry) => {
                    const isCurrentUser = user?.username === entry.username;
                    return (
                      <li key={`${entry.rank}:${entry.username}`} className={`flex items-center gap-3 px-5 py-3 text-sm ${isCurrentUser ? 'bg-purple-300/10' : ''}`}>
                        <span className="w-9 shrink-0 text-center text-xs text-white/55">{medal(entry.rank)}</span>
                        <span className={`min-w-0 flex-1 truncate ${isCurrentUser ? 'font-bold text-purple-200' : 'text-white/75'}`}>
                          {entry.username}{isCurrentUser ? ' · YOU' : ''}
                        </span>
                        <span className="font-mono text-xs text-white">{entry.score.toLocaleString()}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
