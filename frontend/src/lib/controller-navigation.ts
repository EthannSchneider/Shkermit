export function moveControllerFocus(root: HTMLElement, backwards: boolean) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if (!buttons.length) return;
  const current = buttons.findIndex((button) => button === document.activeElement);
  const index = current < 0
    ? (backwards ? buttons.length - 1 : 0)
    : (current + (backwards ? -1 : 1) + buttons.length) % buttons.length;
  buttons[index].focus({ preventScroll: true });
  buttons[index].scrollIntoView({ block: 'nearest' });
}

export function activateControllerFocus(root: HTMLElement): boolean {
  const target = document.activeElement;
  if (!(target instanceof HTMLButtonElement) || !root.contains(target) || target.disabled) return false;
  target.click();
  return true;
}
