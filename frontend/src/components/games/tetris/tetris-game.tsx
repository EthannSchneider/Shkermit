import { useEffect, useState } from 'react';
import shkermitImage from '../../../assets/img/3 TeteShkermit RTX.png';
import { BoardGrid } from './board-grid';
import { KEYBOARD_ACTION_LABELS, KEYBOARD_ACTIONS, MOVEMENT_REPEAT, PLAYER_COLORS } from './constants';
import { ControlPad } from './control-pad';
import { MiniPiece } from './mini-piece';
import type { PlayerId, TetrisGameController } from './types';
import antoineLoupImage from '../../../assets/img/antoine-loup.jpg';
import { useGamepad } from '../../../hooks/use-gamepad';
import { ControllerHelp } from '../controller-help';
import { handleTetrisController } from './controller-input';
import { useControllerBindings } from '../../../hooks/use-controller-bindings';
import { AutoSettingsDialog } from './auto-settings-dialog';

type TetrisGameProps = {
  controller: TetrisGameController;
};

export default function TetrisGame({ controller }: TetrisGameProps) {
  const controllerSettings = useControllerBindings('tetris');
  const [isAntoineLoupOpen, setIsAntoineLoupOpen] = useState(false);
  const {
    game,
    bestScores,
    coop,
    joinCode,
    setJoinCode,
    keyBindings,
    bindingAction,
    setBindingAction,
    resetBindings,
    startSolo,
    connectToCoop,
    leaveCoop,
    sendAction,
    sendCommand,
    renderedBoards,
    returnToMenu,
    soundEnabled,
    toggleSound,
    canAutoPlay,
    autoEnabled,
    autoSettingsOpen,
    openAutoSettings,
  } = controller;
  const autoButton = canAutoPlay ? (
    <button
      type="button"
      onClick={openAutoSettings}
      aria-haspopup="dialog"
      aria-expanded={autoSettingsOpen}
      aria-label={`Auto settings, autopilot ${autoEnabled ? 'on' : 'off'}`}
      title="Autopilot settings"
      className={`rounded-lg border px-3 py-2 text-[9px] transition ${autoEnabled ? 'border-lime-300/50 bg-lime-300/15 text-lime-200' : 'border-white/10 bg-white/4 text-white/35 hover:bg-white/10 hover:text-white/75'}`}
    >auto</button>
  ) : null;
  const playerLabel = (player: PlayerId) => coop.playerNames[player] || `PLAYER ${player}`;
  const gameMessage = ([1, 2] as PlayerId[]).reduce(
    (message, player) => message.split(`PLAYER ${player}`).join(playerLabel(player)),
    game.message,
  );
  const controllerStatus = useGamepad({
    enabled: !bindingAction && !isAntoineLoupOpen && !controllerSettings.settingsOpen && !autoSettingsOpen,
    bindings: controllerSettings.bindings,
    onCapture: controllerSettings.onCapture,
    repeat: ['left', 'right', 'down'],
    repeatTiming: MOVEMENT_REPEAT,
    onControl: (control) => handleTetrisController(control, controller),
  });
  const controllerHelp = (
    <ControllerHelp
      status={controllerStatus}
      settings={controllerSettings}
      onOpen={() => {
        setBindingAction(null);
        if (game.status === 'playing') sendCommand('toggle_pause');
      }}
    />
  );

  useEffect(() => {
    if (!isAntoineLoupOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAntoineLoupOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isAntoineLoupOpen]);

  if (game.status === 'ready') {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#061008] px-4 py-10 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(151,255,99,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(151,255,99,.05) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
        <img src={shkermitImage} alt="" className="pointer-events-none absolute -bottom-20 -right-24 w-110 opacity-15 grayscale" />
        <section className="relative mx-auto max-w-6xl">
          <div className="mb-10 flex items-center justify-between gap-4">
            <a href="/games" className="inline-flex items-center gap-2 text-xs text-lime-200/60 transition hover:text-lime-200">← BACK TO THE ARCADE</a>
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleSound} aria-pressed={soundEnabled} className="rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[9px] text-white/50 transition hover:bg-white/10 hover:text-white/75">
                {soundEnabled ? '🔊 SOUND ON' : '🔇 SOUND OFF'}
              </button>
            </div>
          </div>
          <div className="mb-12 max-w-3xl">
            <p className="mb-4 text-xs tracking-[0.35em] text-lime-300">SHKERMIT ARCADE / 03</p>
            <h1 className="text-5xl leading-[0.9] text-white sm:text-7xl">SHKERMIT<br /><span className="text-lime-300">STACKS</span></h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/55 sm:text-base">Classic falling blocks, remixed for the pond. Clear lines, build combos, and charge Shkermit's emergency Frog Flush.</p>
          </div>

          <div className="grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={startSolo}
              className="group w-full rounded-2xl border border-lime-300/25 bg-lime-300/6 p-7 text-left transition hover:-translate-y-1 hover:border-lime-300/60 hover:bg-lime-300/10"
            >
              <div className="mb-10 flex items-start justify-between"><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-white/50">1 PLAYER</span><span className="text-3xl transition group-hover:rotate-6">▦</span></div>
              <h2 className="text-2xl text-lime-200">SOLO STACK</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">The familiar 10 × 20 board. Chase your best score and charge the Frog Flush.</p>
            </button>

            <div className="rounded-2xl border border-pink-300/25 bg-pink-300/5.5 p-7">
              <div className="mb-7 flex items-start justify-between"><span className="rounded-full border border-pink-200/20 px-3 py-1 text-[10px] text-pink-100/70">2 PLAYERS · ONLINE</span><span className="text-3xl">▦▦</span></div>
              <h2 className="text-2xl text-pink-200">POND PAIR</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">Share a wider board in real time. Each frog controls one piece; both share every clear, combo, and close call.</p>

              {(coop.phase === 'idle' || coop.phase === 'error') && (
                <div className="mt-6 space-y-3">
                  {coop.error && <p role="alert" className="rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-[10px] leading-5 text-red-100">{coop.error}</p>}
                  <button onClick={() => connectToCoop('create', '', 'coop')} className="w-full rounded-lg bg-pink-200 px-4 py-3 text-[10px] text-[#1b0715] transition hover:bg-pink-100">CREATE A CO-OP POND</button>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && joinCode.length === 5) connectToCoop('join', joinCode);
                      }}
                      maxLength={5}
                      aria-label="Multiplayer room code"
                      placeholder="ROOM CODE"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-center text-sm uppercase tracking-[0.25em] text-white outline-none focus:border-pink-200/60"
                    />
                    <button disabled={joinCode.length !== 5} onClick={() => connectToCoop('join', joinCode)} className="rounded-lg border border-pink-200/30 px-4 py-3 text-[10px] text-pink-100 disabled:cursor-not-allowed disabled:opacity-35">JOIN</button>
                  </div>
                </div>
              )}

              {coop.phase === 'connecting' && game.mode !== 'duel' && <p className="mt-6 animate-pulse text-[10px] text-pink-100/70">OPENING THE POND…</p>}

              {coop.phase === 'hosting' && game.mode === 'coop' && (
                <div className="mt-6 rounded-xl border border-pink-200/20 bg-black/25 p-4 text-center">
                  <p className="text-[9px] text-white/40">SHARE THIS POND CODE</p>
                  <p className="mt-2 text-3xl tracking-[0.22em] text-pink-100">{coop.roomCode}</p>
                  <p className="mt-3 animate-pulse text-[9px] text-white/45">WAITING FOR PLAYER 2…</p>
                  <div className="mt-4 flex justify-center gap-4 text-[9px]">
                    <button onClick={() => void navigator.clipboard?.writeText(coop.roomCode)} className="text-pink-100/70 underline">COPY CODE</button>
                    <button onClick={leaveCoop} className="text-white/35 underline">CANCEL</button>
                  </div>
                </div>
              )}

              {coop.phase === 'connected' && game.mode === 'coop' && <p className="mt-6 animate-pulse text-[10px] text-pink-100/70">PARTNER FOUND · SYNCING THE STACK…</p>}
            </div>

            <div className="rounded-2xl border border-orange-300/25 bg-orange-300/5.5 p-7">
              <div className="mb-7 flex items-start justify-between"><span className="rounded-full border border-orange-200/20 px-3 py-1 text-[10px] text-orange-100/70">2 PLAYERS · VERSUS</span><span className="text-3xl">▦⚔▦</span></div>
              <h2 className="text-2xl text-orange-200">SWAMP DUEL</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">Race on separate boards. Clear lines or land T-spins to send garbage to your rival. First frog to top out loses.</p>

              {(coop.phase === 'idle' || coop.phase === 'error') && (
                <button onClick={() => connectToCoop('create', '', 'duel')} className="mt-6 w-full rounded-lg bg-orange-200 px-4 py-3 text-[10px] text-[#1b1007] transition hover:bg-orange-100">CREATE A DUEL</button>
              )}
              {coop.phase === 'connecting' && game.mode === 'duel' && <p className="mt-6 animate-pulse text-[10px] text-orange-100/70">OPENING THE ARENA…</p>}
              {coop.phase === 'hosting' && game.mode === 'duel' && (
                <div className="mt-6 rounded-xl border border-orange-200/20 bg-black/25 p-4 text-center">
                  <p className="text-[9px] text-white/40">SHARE THIS DUEL CODE</p>
                  <p className="mt-2 text-3xl tracking-[0.22em] text-orange-100">{coop.roomCode}</p>
                  <p className="mt-3 animate-pulse text-[9px] text-white/45">WAITING FOR YOUR RIVAL…</p>
                  <div className="mt-4 flex justify-center gap-4 text-[9px]">
                    <button onClick={() => void navigator.clipboard?.writeText(coop.roomCode)} className="text-orange-100/70 underline">COPY CODE</button>
                    <button onClick={leaveCoop} className="text-white/35 underline">CANCEL</button>
                  </div>
                </div>
              )}
              {coop.phase === 'connected' && game.mode === 'duel' && <p className="mt-6 animate-pulse text-[10px] text-orange-100/70">RIVAL FOUND · PREPARING THE ARENA…</p>}
            </div>
          </div>

          <section className="mt-5 max-w-6xl rounded-2xl border border-white/10 bg-white/3.5 p-5 sm:p-7" aria-labelledby="keyboard-controls-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[9px] tracking-[0.22em] text-white/35">LOCAL SETTINGS</p>
                <h2 id="keyboard-controls-title" className="mt-2 text-lg text-white">YOUR KEYBOARD CONTROLS</h2>
                <p className="mt-2 max-w-xl text-[10px] leading-5 text-white/40">These keys control you in solo, co-op, and duels, whether you are Player 1 or Player 2. They are saved on this device.</p>
              </div>
              <button onClick={resetBindings} className="rounded-lg border border-white/10 px-3 py-2 text-[9px] text-white/40 transition hover:bg-white/8 hover:text-white/70">RESET DEFAULTS</button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {KEYBOARD_ACTIONS.map((action) => {
                const listening = bindingAction === action;
                return (
                  <div key={action} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 p-2 pl-3">
                    <span className="text-[9px] text-white/45">{KEYBOARD_ACTION_LABELS[action]}</span>
                    <button
                      onClick={() => setBindingAction(action)}
                      aria-label={listening ? `Press a key for ${KEYBOARD_ACTION_LABELS[action]}` : `Change ${KEYBOARD_ACTION_LABELS[action]} key`}
                      className={`min-w-14 rounded-md border px-2 py-2 text-[10px] transition ${listening ? 'animate-pulse border-lime-200 bg-lime-200 text-[#071008]' : 'border-lime-200/20 bg-lime-300/6 text-lime-100 hover:border-lime-200/50'}`}
                    >
                      {listening ? 'PRESS…' : keyBindings[action].label}
                    </button>
                  </div>
                );
              })}
            </div>
            {bindingAction && <p className="mt-3 text-[9px] text-lime-100/55">Press any key for {KEYBOARD_ACTION_LABELS[bindingAction]}. Press Escape to cancel. If that key is already used, the two bindings will swap.</p>}
          </section>

          {controllerHelp}

          <button
            type="button"
            onClick={() => setIsAntoineLoupOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isAntoineLoupOpen}
            className="mt-8 flex w-fit cursor-zoom-in items-center gap-5 rounded-2xl border border-lime-200/15 bg-lime-200/4 px-5 py-4 text-left shadow-[0_0_28px_rgba(117,255,76,0.06)] transition hover:border-lime-200/35 hover:bg-lime-200/7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-200/70"
          >
            <img src={antoineLoupImage} alt="Antoine Loup" className="h-20 w-20 rounded-full border border-lime-200/30 object-cover ring-2 ring-lime-200/10" />
            <span className="text-xs leading-6 tracking-[0.16em] text-lime-200/60">APPROVED BY<br /><span className="text-lg text-lime-200/95">ANTOINE LOUP</span><br /><span className="text-[10px] text-white/35">BEST PLAYER OF TETRIS IN SWITZERLAND</span></span>
          </button>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[10px] text-white/35">
            <span>7-BAG RANDOMIZER</span><span>GHOST PIECES</span><span>T-SPINS</span><span>REAL-TIME MULTIPLAYER</span><span>GARBAGE ATTACKS</span><span>CUSTOM KEYS</span><span>TOUCH READY</span>
          </div>
        </section>

        {isAntoineLoupOpen && (
          <div
            className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-8"
            onClick={() => setIsAntoineLoupOpen(false)}
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="antoine-loup-dialog-title"
              className="relative cursor-default rounded-2xl border border-lime-200/25 bg-[#061008] p-3 shadow-[0_0_80px_rgba(117,255,76,0.18)] sm:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsAntoineLoupOpen(false)}
                autoFocus
                aria-label="Close Antoine Loup image"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/65 text-lg text-white/70 transition hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-lime-200"
              >
                ×
              </button>
              <img
                src={antoineLoupImage}
                alt="Antoine Loup"
                className="max-h-[78vh] max-w-[88vw] rounded-xl object-contain sm:max-w-4xl"
              />
              <div className="px-2 pb-1 pt-4 text-center">
                <h2 id="antoine-loup-dialog-title" className="text-lg text-lime-200">ANTOINE LOUP</h2>
                <p className="mt-1 text-[10px] tracking-[0.16em] text-white/40">BEST PLAYER OF TETRIS IN SWITZERLAND</p>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061008] px-3 py-6 text-white sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(117,255,76,.16), transparent 38%)' }} />
      {autoSettingsOpen && <AutoSettingsDialog controller={controller} />}
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <a href="/games" className="mb-2 block text-[9px] tracking-[0.22em] text-white/35 hover:text-lime-200">← SHKERMIT ARCADE</a>
            <h1 className="text-2xl text-lime-300 sm:text-4xl">SHKERMIT STACKS</h1>
          </div>
          <div className="flex items-center gap-2 text-[9px]">
            {autoButton}
            <button type="button" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Mute Tetris sound' : 'Enable Tetris sound'} className="mr-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[9px] text-white/50 transition hover:bg-white/10 hover:text-white/75">
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <span className={`h-2 w-2 rounded-full ${game.status === 'playing' ? 'animate-pulse bg-lime-300' : 'bg-yellow-300'}`} />
            <span className="text-white/45">
              {game.mode === 'coop'
                ? `POND PAIR · ${playerLabel(coop.playerId || 1)} · ${coop.roomCode}`
                : game.mode === 'duel' ? `SWAMP DUEL · ${playerLabel(coop.playerId || 1)} · ${coop.roomCode}` : 'SOLO RUN'} · LVL {game.level}
            </span>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(320px,660px)_250px] xl:justify-center">
          <aside className="order-2 grid grid-cols-3 gap-3 xl:order-1 xl:grid-cols-1">
            <div className="rounded-xl border border-white/8 bg-white/3.5 p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">SCORE / BEST</p>
              <p className="mt-2 text-xl text-white sm:text-2xl">{(game.mode === 'duel' ? game.playerStats[coop.playerId || 1].score : game.score).toLocaleString()}</p>
              <p className="mt-1 text-[9px] text-yellow-200/65">🏆 {bestScores[game.mode].toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3.5 p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">{game.mode === 'duel' ? 'YOUR / RIVAL LINES' : 'LINES'}</p>
              <p className="mt-2 text-sm text-lime-200">
                {game.mode === 'duel'
                  ? <>{game.playerStats[coop.playerId || 1].lines} <span className="text-white/20">/</span> {game.playerStats[(coop.playerId || 1) === 1 ? 2 : 1].lines}</>
                  : game.lines}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3.5 p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">COMBO</p>
              <p className="mt-2 text-sm text-pink-200">{(game.mode === 'duel' ? game.playerStats[coop.playerId || 1].combo : game.combo) > 0 ? `${(game.mode === 'duel' ? game.playerStats[coop.playerId || 1].combo : game.combo) + 1}×` : '—'}</p>
            </div>
            {game.mode === 'duel' ? (
              <div className="col-span-3 rounded-xl border border-orange-300/15 bg-orange-300/4 p-4 xl:col-span-1">
                <p className="text-[9px] text-orange-200">GARBAGE ATTACKS</p>
                <p className="mt-3 text-[9px] leading-5 text-white/40">2 / 3 / 4 lines → 1 / 2 / 4 rows<br />T-spin single / double / triple → 2 / 4 / 6 rows<br />Back-to-back clears → +1 row</p>
              </div>
            ) : (
              <div className="col-span-3 rounded-xl border border-lime-300/15 bg-lime-300/4 p-4 xl:col-span-1">
                <div className="mb-2 flex justify-between text-[9px]"><span className="text-lime-200">FROG FLUSH</span><span className="text-white/40">{game.meter}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-linear-to-r from-lime-500 to-yellow-200 transition-all" style={{ width: `${game.meter}%` }} /></div>
                <p className="mt-3 text-[9px] leading-4 text-white/35">Fill by clearing lines. Press <span className="text-white">{keyBindings.frogFlush.label}</span> at 100% to wash away two danger rows.</p>
              </div>
            )}
          </aside>

          <section className="order-1 flex flex-col items-center xl:order-2">
            <div className="mb-2 flex w-full items-center justify-between gap-3 text-[9px] text-white/35" style={{ maxWidth: game.mode === 'duel' ? 640 : game.mode === 'coop' ? 560 : 400 }}>
              <span className={game.mode === 'duel' ? 'text-orange-200' : game.mode === 'coop' ? 'text-pink-200' : 'text-lime-200'}>{game.mode === 'duel' ? 'DUEL' : game.mode === 'coop' ? 'CO-OP' : 'SOLO'}</span><span className="text-right">{gameMessage}</span><span />
            </div>
            <div className="relative">
              {game.mode === 'duel' ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {([1, 2] as PlayerId[]).map((player) => (
                    <BoardGrid
                      key={player}
                      cells={renderedBoards[player]}
                      cols={game.cols}
                      width="min(44vw, 300px)"
                      accent={PLAYER_COLORS[player]}
                      label={`${playerLabel(player)}${coop.playerId === player ? ' · YOU' : ' · RIVAL'} · ${game.playerStats[player].score.toLocaleString()} PTS`}
                    />
                  ))}
                </div>
              ) : (
                <BoardGrid
                  cells={renderedBoards[1]}
                  cols={game.cols}
                  width={game.mode === 'coop' ? 'min(92vw, 560px)' : 'min(82vw, 400px)'}
                  accent="#b5ff4a"
                  label=""
                />
              )}
              {(game.status === 'paused' || game.status === 'gameover') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020704]/90 p-8 text-center backdrop-blur-sm">
                  <img src={shkermitImage} alt="Shkermit" className="mb-4 h-24 w-24 object-contain" />
                  <p className="text-[10px] tracking-[0.3em] text-lime-300">{game.status === 'paused' ? 'POND BREAK' : game.mode === 'duel' ? 'DUEL OVER' : 'STACK OVER'}</p>
                  <h2 className="mt-3 text-2xl">{game.status === 'paused' ? 'PAUSED' : game.mode === 'duel' && game.winner ? `${playerLabel(game.winner)} WINS` : `${game.score.toLocaleString()} PTS`}</h2>
                  <div className="mt-6 flex gap-2">
                    {game.status === 'paused' && <button onClick={() => sendCommand('toggle_pause')} className="rounded-lg bg-lime-300 px-4 py-3 text-[10px] text-[#061008]">KEEP STACKING</button>}
                    <button onClick={() => sendCommand('restart')} className="rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-[10px]">RESTART</button>
                  </div>
                  {game.status === 'gameover' && (
                    <button
                      onClick={returnToMenu}
                      className="mt-4 text-[9px] text-white/40 underline"
                    >MAIN MENU</button>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="order-3 space-y-3">
            <div className="grid gap-3">
              {(game.mode !== 'solo' ? [1, 2] as PlayerId[] : [1] as PlayerId[]).map((player) => {
                const isLocalPlayer = game.mode === 'solo' || coop.playerId === player;
                return (
                  <div key={player} className="flex flex-col gap-4 rounded-xl border bg-white/3.5 p-4" style={{ borderColor: `${PLAYER_COLORS[player]}33` }}>
                    <div>
                      <p className="text-[9px]" style={{ color: PLAYER_COLORS[player] }}>{game.mode !== 'solo' ? `${playerLabel(player)}${isLocalPlayer ? ' · YOU' : ''}` : 'YOUR PIECES'}</p>
                      <p className="mt-2 text-[9px] leading-4 text-white/35">
                        {isLocalPlayer
                          ? <>{keyBindings.left.label} {keyBindings.right.label} move<br />{keyBindings.rotate.label} ↻ · {keyBindings.rotate_ccw.label} ↺ · {keyBindings.drop.label} drop</>
                          : <>REMOTE PLAYER<br />USES THEIR OWN KEYS</>}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-center">
                        <p className="mb-2 text-[8px] text-white/40">NEXT</p>
                        <MiniPiece type={game.next[player]} player={player} />
                      </div>
                      <button
                        type="button"
                        onClick={() => sendAction(player, 'hold')}
                        disabled={!isLocalPlayer || game.status !== 'playing' || game.holdUsed?.[player]}
                        aria-label={`Hold piece for ${playerLabel(player)}`}
                        className="rounded-lg border border-white/10 p-2 text-center transition enabled:hover:bg-white/10 disabled:opacity-40"
                      >
                        <p className="mb-2 text-[8px] text-lime-200/70">HOLD{isLocalPlayer ? ` · ${keyBindings.hold.label}` : ''}</p>
                        {game.hold?.[player]
                          ? <MiniPiece type={game.hold[player]!} player={player} label="Held piece" />
                          : <span className="flex h-16 w-16 items-center justify-center text-lg text-white/25">—</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => sendCommand('toggle_pause')} className="flex-1 rounded-lg border border-white/10 bg-white/4 py-3 text-[9px] text-white/50 hover:bg-white/10">{game.status === 'paused' ? 'RESUME' : 'PAUSE'} · {keyBindings.pause.label}</button>
              <button onClick={() => sendCommand('restart')} className="rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-[9px] text-white/50 hover:bg-white/10">↻</button>
              {game.mode !== 'solo' && <button onClick={leaveCoop} className="rounded-lg border border-pink-200/15 bg-pink-300/4 px-3 py-3 text-[9px] text-pink-100/55">LEAVE</button>}
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-3">
          {controllerHelp}
          <div className="rounded-xl border border-lime-300/10 bg-white/2.5 p-3">
            <p className="mb-2 text-center text-[9px]" style={{ color: PLAYER_COLORS[game.mode !== 'solo' ? coop.playerId || 1 : 1] }}>
              {game.mode !== 'solo' ? `${playerLabel(coop.playerId || 1)} TOUCH CONTROLS` : 'TOUCH CONTROLS'}
            </p>
            <ControlPad
              player={game.mode !== 'solo' ? coop.playerId || 1 : 1}
              bindings={keyBindings}
              onAction={sendAction}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
