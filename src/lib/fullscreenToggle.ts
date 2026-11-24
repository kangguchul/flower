const CONTROL_SELECTOR = 'button, a, input, textarea, select, label, [role="slider"]';

export function isFullscreenToggleTarget(target: EventTarget | null): boolean {
  if (!target || !('closest' in target) || typeof target.closest !== 'function') return false;
  return !target.closest(CONTROL_SELECTOR);
}

export function toggleDocumentFullscreen(): Promise<void> {
  if (document.fullscreenElement) return document.exitFullscreen();
  return document.documentElement.requestFullscreen();
}

const PHONE_SCREEN_QUERIES = [
  '(max-width: 720px) and (orientation: portrait)',
  '(max-height: 620px) and (orientation: landscape)'
];

export function isPhoneFullscreenWarningScreen(matches: (query: string) => boolean): boolean {
  return PHONE_SCREEN_QUERIES.some(matches);
}

export function shouldShowFullscreenWarning(fullscreen: boolean, phone: boolean): boolean {
  return phone && !fullscreen;
}
