const VOLUME_STEP = 0.05;
const WHEEL_NOTCH_PIXELS = 100;

export function wheelDeltaToPixels(deltaY: number, deltaMode = 0) {
  if (deltaMode === 1) return deltaY * 40;
  if (deltaMode === 2) return Math.sign(deltaY) * WHEEL_NOTCH_PIXELS;
  return deltaY;
}

export function applyVolumeWheel(volume: number, deltaY: number, pending = 0, deltaMode = 0) {
  const pixels = wheelDeltaToPixels(deltaY, deltaMode);
  if (!pixels) return { volume, pending };
  const nextPending = pending + pixels;
  const steps = Math.trunc(nextPending / WHEEL_NOTCH_PIXELS);
  if (steps === 0) return { volume, pending: nextPending };
  const raised = steps < 0;
  const lowered = steps > 0;
  if ((raised && volume >= 1) || (lowered && volume <= 0)) return { volume, pending: 0 };
  const nextVolume = Math.min(1, Math.max(0, Math.round((volume - steps * VOLUME_STEP) * 100) / 100));
  return { volume: nextVolume, pending: nextPending - steps * WHEEL_NOTCH_PIXELS };
}

export function wheelTargetCanScroll(target: EventTarget | null, deltaY: number) {
  let node = target instanceof Element ? target : null;
  while (node) {
    const style = getComputedStyle(node);
    const scrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
    if (scrollable && node.scrollHeight > node.clientHeight + 1) {
      if (deltaY < 0 && node.scrollTop > 0) return true;
      if (deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
    }
    node = node.parentElement;
  }
  return false;
}
