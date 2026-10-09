import type { GamepadControl } from '../../../lib/gamepad';
import type { TetrisGameController } from './types';

type ControllerActions = Pick<TetrisGameController,
  'game' | 'coop' | 'startSolo' | 'connectToCoop' | 'leaveCoop'
  | 'sendAction' | 'sendCommand' | 'returnToMenu'>;

export function handleTetrisController(control: GamepadControl, controller: ControllerActions) {
  const { game, coop, startSolo, connectToCoop, leaveCoop, sendAction, sendCommand, returnToMenu } = controller;
  if (game.status === 'ready') {
    const canCreate = coop.phase === 'idle' || coop.phase === 'error';
    if (canCreate && (control === 'south' || control === 'start')) startSolo();
    if (canCreate && control === 'west') connectToCoop('create', '', 'coop');
    if (canCreate && control === 'north') connectToCoop('create', '', 'duel');
    if (!canCreate && control === 'east') leaveCoop();
    return;
  }
  if (control === 'start') return sendCommand('toggle_pause');
  if (control === 'select') return sendCommand('restart');
  if (control === 'east' && game.status !== 'playing') return returnToMenu();
  if (game.status !== 'playing') return;
  if (control === 'north') return sendCommand('frog_flush');
  const player = game.mode === 'solo' ? 1 : coop.playerId;
  if (!player) return;
  if (control === 'left' || control === 'right' || control === 'down') sendAction(player, control);
  if (control === 'up') sendAction(player, 'rotate_ccw');
  if (control === 'south') sendAction(player, 'rotate');
  if (control === 'west') sendAction(player, 'drop');
  if (control === 'east') sendAction(player, 'hold');
}
