import { useEffect, useEffectEvent, useRef } from 'react';
import type { ControllerStatus, GamepadInputControl } from '../../lib/gamepad';
import { CONTROLLER_ACTIONS, CONTROLLER_INPUT_LABELS, controllerBindingLabel } from '../../lib/controller-bindings';
import type { ControllerSettingsState } from '../../hooks/use-controller-bindings';

type ControllerSettingsProps = {
  settings: ControllerSettingsState;
  status: ControllerStatus;
  onOpen?: () => void;
};

export function ControllerSettings({ settings, status, onOpen }: ControllerSettingsProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { settingsOpen, capturing, close, setCapturing } = settings;
  const actions = CONTROLLER_ACTIONS[settings.game];
  const handleSettingsKey = useEffectEvent((event: KeyboardEvent) => {
    // Keep game keyboard handlers from running while the settings are open.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (capturing) setCapturing(null);
      else close();
    }
    if (event.key === 'Tab') {
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)') ?? []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  useEffect(() => {
    if (!settingsOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => handleSettingsKey(event);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previousFocus?.focus();
    };
  }, [settingsOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => { onOpen?.(); settings.open(); }}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        className="mt-3 rounded-lg border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
      >Customize controls</button>
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="controller-settings-title"
            aria-describedby="controller-settings-description"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/25 bg-slate-950 p-5 text-sm text-white shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="controller-settings-title" className="text-xl font-bold">Customize controller controls</h2>
              <button type="button" onClick={close} className="rounded-lg border border-white/25 px-3 py-2 hover:bg-white/10">Done</button>
            </div>
            <p id="controller-settings-description" className="mt-3 text-white/65">
              Choose an input or select “Press to bind” and use your controller. Controls save for this game on this device. If an input is already used, the two actions swap.
            </p>
            <div className="mt-5 space-y-3">
              {actions.map(({ control, label }) => (
                <div key={control} className="rounded-xl border border-white/15 bg-white/5 p-3">
                  <label htmlFor={`controller-binding-${control}`} className="font-bold">{label}</label>
                  <p className="mt-1 text-xs text-white/60">{controllerBindingLabel(settings.bindings, control)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      id={`controller-binding-${control}`}
                      value={settings.bindings[control].length === 1 ? settings.bindings[control][0] : 'combined'}
                      onChange={(event) => settings.rebind(control, event.target.value as GamepadInputControl)}
                      className="min-w-0 flex-1 rounded-lg border border-white/25 bg-slate-900 px-2 py-2"
                    >
                      {settings.bindings[control].length > 1 && <option value="combined" disabled>{controllerBindingLabel(settings.bindings, control)}</option>}
                      {(Object.entries(CONTROLLER_INPUT_LABELS) as [GamepadInputControl, string][]).map(([input, name]) => (
                        <option key={input} value={input}>{name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={status.state !== 'connected'}
                      aria-label={`Press a controller input to bind ${label}`}
                      aria-pressed={capturing === control}
                      onClick={() => setCapturing(capturing === control ? null : control)}
                      className={`rounded-lg border px-3 py-2 disabled:opacity-40 ${capturing === control ? 'border-yellow-300 bg-yellow-300/20 text-yellow-200' : 'border-white/25 hover:bg-white/10'}`}
                    >{capturing === control ? 'Cancel binding' : 'Press to bind'}</button>
                  </div>
                </div>
              ))}
            </div>
            <div role="status" className="mt-4 text-yellow-200">
              {capturing
                ? `Release all inputs, then press a button or move a stick for ${actions.find((action) => action.control === capturing)?.label}. Escape cancels.`
                : status.state === 'connected' ? 'Changes save automatically. Close this panel and release held inputs before playing.' : 'Connect a controller to use press-to-bind. You can also choose inputs from the lists.'}
            </div>
            {settings.saveError && <p role="alert" className="mt-3 text-red-300">{settings.saveError}</p>}
            <button type="button" onClick={settings.reset} className="mt-5 rounded-lg border border-white/25 px-3 py-2 hover:bg-white/10">Reset controller defaults</button>
          </div>
        </div>
      )}
    </>
  );
}
