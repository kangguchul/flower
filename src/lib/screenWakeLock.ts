export interface ScreenWakeSentinel {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
  removeEventListener?(type: 'release', listener: () => void): void;
}

export interface ScreenWakeLock {
  request(type: 'screen'): Promise<ScreenWakeSentinel>;
}

export async function syncScreenWakeLock(
  active: boolean,
  current: ScreenWakeSentinel | null,
  wakeLock: ScreenWakeLock | null
): Promise<ScreenWakeSentinel | null> {
  if (!active) {
    await current?.release().catch(() => undefined);
    return null;
  }
  if ((current && current.released !== true) || !wakeLock) return current;
  try {
    return await wakeLock.request('screen');
  } catch {
    return null;
  }
}

export function screenWakeLockFromNavigator(): ScreenWakeLock | null {
  const candidate = navigator as Navigator & { wakeLock?: ScreenWakeLock };
  return candidate.wakeLock ?? null;
}
