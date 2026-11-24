import { describe, expect, it } from 'vitest';
import { currentInstallOffer, promptAppInstall, rememberInstallPrompt } from '../lib/installPrompt';

describe('게임머니를 잃었을 때의 앱 설치', () => {
  it('설치 가능한 브라우저에서는 설치 창을 띄울 준비를 한다', async () => {
    let prompted = false;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => { prompted = true; },
      userChoice: Promise.resolve({ outcome: 'accepted' })
    });
    rememberInstallPrompt(event);
    expect(event.defaultPrevented).toBe(true);
    expect(currentInstallOffer()).toBe('prompt');
    expect(await promptAppInstall()).toBe('accepted');
    expect(prompted).toBe(true);
    expect(currentInstallOffer()).not.toBe('prompt');
  });
});
