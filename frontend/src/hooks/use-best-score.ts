import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';

export function useBestScore(game: string, mode: string, localBest = 0, clientCanSave = true) {
  const { user } = useAuth();
  const [bestScore, setBestScore] = useState(localBest);
  const bestRef = useRef(localBest);
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePending = useCallback(() => {
    if (!user || !clientCanSave || pendingRef.current <= 0) return;
    const score = pendingRef.current;
    pendingRef.current = 0;
    void api.saveBestScore(game, mode, score)
      .then((result) => {
        bestRef.current = Math.max(bestRef.current, result.score);
        setBestScore(bestRef.current);
      })
      .catch((error: unknown) => console.error('Could not save the best score', error));
  }, [clientCanSave, game, mode, user]);

  useEffect(() => {
    bestRef.current = localBest;
    pendingRef.current = 0;
    if (!user) return;
    let active = true;
    api.getBestScore(game, mode)
      .then((result) => {
        if (!active) return;
        const mergedBest = Math.max(localBest, result.score);
        bestRef.current = mergedBest;
        setBestScore(mergedBest);
        if (clientCanSave && localBest > result.score) {
          pendingRef.current = localBest;
          savePending();
        }
      })
      .catch((error: unknown) => console.error('Could not load the best score', error));
    return () => {
      active = false;
    };
  }, [clientCanSave, game, localBest, mode, savePending, user]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    savePending();
  }, [savePending]);

  const recordScore = useCallback((value: number) => {
    const score = Math.max(0, Math.min(2_147_483_647, Math.floor(value)));
    if (score <= bestRef.current) return;
    bestRef.current = score;
    setBestScore(score);
    if (!user || !clientCanSave) return;
    pendingRef.current = Math.max(pendingRef.current, score);
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      savePending();
    }, 1_500);
  }, [clientCanSave, savePending, user]);

  return { bestScore, recordScore };
}
