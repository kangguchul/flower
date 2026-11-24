export const OPPONENT_WAIT_MS = 5_000;
const RELOAD_KEY = 'hwatu.reload-seat';

interface StampStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function sessionStore(): StampStore | null {
  try {
    return window.sessionStorage;
  }
  catch {
    return null;
  }
}

export function navigationType(): string {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return entry?.type ?? 'navigate';
}

export function claimFreshReload(store: StampStore | null = sessionStore(), stamp = String(performance.timeOrigin), type = navigationType()): boolean {
  if (type !== 'reload') return false;
  if (store?.getItem(RELOAD_KEY) === stamp) return false;
  store?.setItem(RELOAD_KEY, stamp);
  return true;
}

export function releaseFreshReload(store: StampStore | null = sessionStore()) {
  store?.removeItem(RELOAD_KEY);
}
