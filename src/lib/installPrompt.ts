export type InstallOffer = 'hidden' | 'prompt' | 'ios' | 'manual';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

export function rememberInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as InstallPromptEvent;
  notify();
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isInstalledApp() {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(standaloneMedia || iosStandalone);
}

export function currentInstallOffer(): InstallOffer {
  if (isInstalledApp()) return 'hidden';
  if (deferredPrompt) return 'prompt';
  if (typeof navigator === 'undefined') return 'manual';
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios';
  return 'manual';
}

export async function promptAppInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable' as const;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  notify();
  return choice.outcome;
}
