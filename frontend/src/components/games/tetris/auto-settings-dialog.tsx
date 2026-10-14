import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { DEFAULT_AUTO_SETTINGS, type AutoPlayStyle } from './auto-settings';
import type { TetrisGameController } from './types';

export function AutoSettingsDialog({ controller }: { controller: TetrisGameController }) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { game, autoEnabled, toggleAuto, autoSettings, updateAutoSettings, autoSettingsSaveError, closeAutoSettings } = controller;
  const maxSpeed = game.mode === 'solo' ? 20 : 10;
  const speed = Math.min(maxSpeed, autoSettings.actionsPerSecond);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const controlClass = 'rounded-lg border border-white/20 bg-[#0c1c10] px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-lime-300';

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        closeAutoSettings();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeAutoSettings();
      }}
      aria-labelledby="auto-settings-title"
      aria-describedby="auto-settings-description"
      className="mobile-dialog fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-lime-300/25 bg-[#061008] p-5 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] tracking-[0.2em] text-lime-300/65">{t("AUTO")}</p>
          <h2 id="auto-settings-title" className="mt-2 text-xl text-lime-200">{t("Autopilot settings")}</h2>
        </div>
        <button type="button" onClick={closeAutoSettings} className={controlClass} autoFocus>{t("Done")}</button>
      </div>
      <p id="auto-settings-description" className="mt-3 font-sans text-sm leading-6 text-white/55">{t("Changes apply immediately and save on this device. Autopilot controls your own piece.")}</p>

      <div className="mt-6 space-y-5 font-sans">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-lime-300/20 bg-lime-300/5 p-4">
          <div>
            <p id="auto-enabled-label" className="font-semibold">{t("Autopilot")}</p>
            <p className="mt-1 text-xs text-white/55" role="status">{autoEnabled ? game.status === 'paused' ? t("On · waiting for the game to resume") : t("On · playing automatically") : game.status === 'gameover' ? t("Off · enable to start a new run") : t("Off · you control the pieces")}</p>
          </div>
          <button type="button" role="switch" aria-checked={autoEnabled} aria-labelledby="auto-enabled-label" onClick={toggleAuto} className={`min-w-18 rounded-lg border px-4 py-2 font-semibold ${autoEnabled ? 'border-lime-300 bg-lime-300 text-[#061008]' : 'border-white/25 bg-white/5 text-white/60'}`}>{autoEnabled ? t("ON") : t("OFF")}</button>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="auto-speed" className="font-semibold">{t("Speed")}</label>
            <output htmlFor="auto-speed" className="text-sm text-lime-200">{t("actionsPerSecond", { count: speed })}</output>
          </div>
          <input id="auto-speed" type="range" min={1} max={maxSpeed} step={1} value={speed} onChange={(event) => updateAutoSettings({ ...autoSettings, actionsPerSecond: Number(event.target.value) })} className="mt-3 w-full accent-lime-300" />
          <div className="flex justify-between text-xs text-white/40"><span>{t("Slow")}</span><span>{t("Fast")}</span></div>
          <p className="mt-2 text-xs leading-5 text-white/50">{game.mode === 'solo' ? t("Adjust how quickly the bot moves, rotates, and drops. Game gravity stays the same.") : t("Online games support up to 10 actions per second. Game gravity stays the same.")}</p>
        </div>

        <div>
          <label htmlFor="auto-style" className="font-semibold">{t("Play style")}</label>
          <select id="auto-style" value={autoSettings.playStyle} onChange={(event) => updateAutoSettings({ ...autoSettings, playStyle: event.target.value as AutoPlayStyle })} className={`mt-2 w-full ${controlClass}`}>
            <option value="balanced">{t("Balanced")}</option>
            <option value="safe">{t("Safe")}</option>
            <option value="aggressive">{t("Aggressive")}</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-white/50">{autoSettings.playStyle === 'safe' ? t("Prioritize a low, tidy stack and avoid holes.") : autoSettings.playStyle === 'aggressive' ? t("Prioritize line clears and accept more stack risk.") : t("Balance line clears, stack height, and avoiding holes.")}</p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
          <input type="checkbox" checked={autoSettings.lookAhead} onChange={(event) => updateAutoSettings({ ...autoSettings, lookAhead: event.target.checked })} className="mt-1 h-4 w-4 accent-lime-300" />
          <span><span className="block font-semibold">{t("Plan for the next piece")}</span><span className="mt-1 block text-xs leading-5 text-white/50">{t("Consider the preview piece when choosing a placement.")}</span></span>
        </label>

        <label className={`flex items-start gap-3 rounded-xl border border-white/10 p-4 ${game.mode === 'duel' ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={autoSettings.autoFlush} disabled={game.mode === 'duel'} onChange={(event) => updateAutoSettings({ ...autoSettings, autoFlush: event.target.checked })} className="mt-1 h-4 w-4 accent-lime-300" />
          <span><span className="block font-semibold">{t("Automatic Frog Flush")}</span><span className="mt-1 block text-xs leading-5 text-white/50">{game.mode === 'duel' ? t("Frog Flush is available in solo and co-op.") : t("Use Frog Flush at full charge whenever there are rows to clear. Works with autopilot on or off.")}</span></span>
        </label>

        {autoSettingsSaveError && <p role="alert" className="text-sm text-yellow-200">{t(autoSettingsSaveError)}</p>}
        <button type="button" onClick={() => updateAutoSettings({ ...DEFAULT_AUTO_SETTINGS })} className={controlClass}>{t("Reset settings")}</button>
      </div>
    </dialog>
  );
}
