import type { ControllerStatus } from '../../lib/gamepad';
import { CONTROLLER_ACTIONS, controllerBindingLabel } from '../../lib/controller-bindings';
import type { ControllerSettingsState } from '../../hooks/use-controller-bindings';
import { ControllerSettings } from './controller-settings';

export function ControllerHelp({ status, settings, onOpen }: { status: ControllerStatus; settings: ControllerSettingsState; onOpen?: () => void }) {
  return (
    <div className="my-4 rounded-xl border border-white/15 bg-white/5 p-4 text-sm leading-6 text-white/70">
      <p role="status" className="font-bold text-white/90">
        {status.state === 'connected' && `🎮 Connected: ${status.name}`}
        {status.state === 'waiting' && '🎮 Connect a controller and press a button to enable it.'}
        {status.state === 'unsupported' && '🎮 This controller has no standard layout in this browser. Try another controller or browser.'}
        {status.state === 'unavailable' && '🎮 Controller access is unavailable in this browser.'}
      </p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {CONTROLLER_ACTIONS[settings.game].map(({ control, label }) => (
          <div key={control}>
            <dt className="inline text-white/90">{label}: </dt>
            <dd className="inline">{controllerBindingLabel(settings.bindings, control)}</dd>
          </div>
        ))}
      </dl>
      <ControllerSettings settings={settings} status={status} onOpen={onOpen} />
    </div>
  );
}
