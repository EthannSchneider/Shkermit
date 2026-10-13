import type { TFunction } from 'i18next';
import type { PlayerId } from './types';

// Game state and the multiplayer protocol keep their original messages.
// Translate at render time so switching languages also updates an active game.
export function localizeTetrisMessage(
  message: string,
  t: TFunction,
  playerLabel: (player: PlayerId) => string,
): string {
  return message.split(' • ').map((part) => {
    const win = /^PLAYER ([12]) WINS THE DUEL!$/.exec(part);
    if (win) return t('{{player}} WINS THE DUEL!', { player: playerLabel(Number(win[1]) as PlayerId) });

    const attack = /^PLAYER ([12]) ATTACKS!$/.exec(part);
    if (attack) return t('{{player}} ATTACKS!', { player: playerLabel(Number(attack[1]) as PlayerId) });

    const garbage = /^PLAYER ([12]) SENT (\d+) GARBAGE ROWS?!$/.exec(part);
    if (garbage) return t('garbageRows', {
      player: playerLabel(Number(garbage[1]) as PlayerId), count: Number(garbage[2]),
    });

    const clear = /^(\d+) lines? cleared$/.exec(part);
    if (clear) return t('clearedLines', { count: Number(clear[1]) });

    const combo = /^(\d+)x combo$/.exec(part);
    if (combo) return t('{{count}}x combo', { count: Number(combo[1]) });

    const flush = /^FROG FLUSH! (\d+) danger rows? gone\.$/.exec(part);
    if (flush) return t('flushedRows', { count: Number(flush[1]) });

    return t(part);
  }).join(' • ');
}
