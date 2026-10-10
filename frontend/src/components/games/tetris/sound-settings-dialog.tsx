import { useEffect, useRef } from 'react';
import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from './sound-settings';
import type { TetrisGameController } from './types';

export function SoundSettingsDialog({ controller }: { controller: TetrisGameController }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { soundSettings, updateSoundSettings, soundSettingsSaveError, closeSoundSettings, previewSound } = controller;

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

  const buttonClass = 'rounded-lg border border-white/20 bg-[#0c1c10] px-3 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-lime-300';
  const volumes: { key: keyof Pick<SoundSettings, 'masterVolume' | 'musicVolume' | 'effectsVolume'>; label: string; hint: string }[] = [
    { key: 'masterVolume', label: 'Master volume', hint: 'Adjust all Tetris audio together.' },
    { key: 'musicVolume', label: 'Music volume', hint: 'Menu and game music.' },
    { key: 'effectsVolume', label: 'Sound effects volume', hint: 'Piece placement and line clears.' },
  ];

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); closeSoundSettings(); }}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSoundSettings();
      }}
      aria-labelledby="sound-settings-title"
      aria-describedby="sound-settings-description"
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-lime-300/25 bg-[#061008] p-5 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="sound-settings-title" className="text-xl text-lime-200">Sound options</h2>
        <button type="button" onClick={closeSoundSettings} className={buttonClass} autoFocus>Done</button>
      </div>
      <p id="sound-settings-description" className="mt-3 font-sans text-sm leading-6 text-white/55">Adjust music and effects separately. Changes apply immediately and save on this device.</p>

      <div className="mt-6 space-y-6 font-sans">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/15 bg-white/5 p-4">
          <div>
            <p id="sound-mute-label" className="font-semibold">Mute all sound</p>
            <p className="mt-1 text-xs text-white/55">Keep your volume settings while muted.</p>
          </div>
          <button type="button" role="switch" aria-checked={soundSettings.muted} aria-labelledby="sound-mute-label" onClick={() => updateSoundSettings({ ...soundSettings, muted: !soundSettings.muted })} className={`${buttonClass} min-w-20 ${soundSettings.muted ? 'border-yellow-200/50 text-yellow-200' : 'border-lime-300/40 text-lime-200'}`}>{soundSettings.muted ? 'Muted' : 'Unmuted'}</button>
        </div>

        {volumes.map(({ key, label, hint }) => (
          <div key={key}>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`sound-${key}`} className="font-semibold">{label}</label>
              <output htmlFor={`sound-${key}`} className="text-sm text-lime-200">{soundSettings[key]}%</output>
            </div>
            <input id={`sound-${key}`} type="range" min={0} max={100} step={1} value={soundSettings[key]} aria-describedby={`sound-${key}-hint`} onChange={(event) => updateSoundSettings({ ...soundSettings, [key]: Number(event.target.value) })} className="mt-3 w-full accent-lime-300" />
            <p id={`sound-${key}-hint`} className="mt-1 text-xs text-white/50">{hint}</p>
          </div>
        ))}

        {soundSettingsSaveError && <p role="alert" className="text-sm text-yellow-200">{soundSettingsSaveError}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={previewSound} disabled={soundSettings.muted || soundSettings.masterVolume === 0 || soundSettings.effectsVolume === 0} className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`}>Test sound effect</button>
          <button type="button" onClick={() => updateSoundSettings({ ...DEFAULT_SOUND_SETTINGS })} className={buttonClass}>Reset volumes</button>
        </div>
      </div>
    </dialog>
  );
}
