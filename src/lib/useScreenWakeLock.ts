import { useEffect } from 'react';
import { screenWakeLockFromNavigator, type ScreenWakeSentinel } from './screenWakeLock';
import { WAKE_VIDEO_SRC } from './wakeVideoSrc';

function wakeVideo(): HTMLVideoElement | null {
  if (typeof document === 'undefined') return null;
  const existing = document.querySelector<HTMLVideoElement>('video[data-screen-wake]');
  if (existing) return existing;
  const video = document.createElement('video');
  video.dataset.screenWake = 'true';
  video.src = WAKE_VIDEO_SRC;
  video.loop = true;
  video.playsInline = true;
  video.muted = true;
  video.defaultMuted = true;
  video.controls = false;
  video.preload = 'auto';
  video.disableRemotePlayback = true;
  video.disablePictureInPicture = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  Object.assign(video.style, {
    position: 'fixed',
    top: 'auto',
    right: 'auto',
    bottom: '0',
    left: '0',
    width: '1px',
    height: '1px',
    margin: '0',
    opacity: '0',
    zIndex: '-1',
    pointerEvents: 'none',
    transform: 'translateY(100%)'
  });
  const stayInline = () => {
    const player = video as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean; webkitExitFullscreen?: () => void };
    if (player.webkitDisplayingFullscreen) player.webkitExitFullscreen?.();
    if (document.fullscreenElement === video) void document.exitFullscreen().catch(() => undefined);
  };
  video.addEventListener('webkitbeginfullscreen', stayInline);
  video.addEventListener('enterpictureinpicture', () => { void document.exitPictureInPicture?.().catch(() => undefined); });
  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 0.5) video.currentTime = Math.random() * 0.4;
  });
  document.body.appendChild(video);
  return video;
}

function playWakeVideo() {
  const video = wakeVideo();
  if (!video) return;
  if (video.paused) void video.play().catch(() => undefined);
}

function pauseWakeVideo() {
  document.querySelector<HTMLVideoElement>('video[data-screen-wake]')?.pause();
}

function userMayHoldScreen() {
  const activation = navigator.userActivation;
  if (!activation) return true;
  return activation.isActive || activation.hasBeenActive;
}

export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof document === 'undefined') return;
    let sentinel: ScreenWakeSentinel | null = null;
    let cancelled = false;
    let releasing = false;
    let lastRequest = 0;
    const held = () => sentinel !== null && sentinel.released !== true;
    const adopt = (next: ScreenWakeSentinel) => {
      if (cancelled || document.visibilityState !== 'visible') {
        void next.release().catch(() => undefined);
        return;
      }
      if (sentinel === next) return;
      const previous = sentinel;
      sentinel = next;
      next.addEventListener?.('release', onReleased);
      if (previous && previous !== next && previous.released !== true) {
        releasing = true;
        previous.removeEventListener?.('release', onReleased);
        void previous.release().catch(() => undefined).finally(() => { releasing = false; });
      }
    };
    const requestLock = (fromGesture: boolean) => {
      const wakeLock = screenWakeLockFromNavigator();
      if (!wakeLock || cancelled || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!fromGesture && now - lastRequest < 800) return;
      lastRequest = now;
      void wakeLock.request('screen').then(adopt).catch(() => undefined);
    };
    const onReleased = () => {
      sentinel = null;
      if (releasing || cancelled || document.visibilityState !== 'visible') return;
      if (userMayHoldScreen()) requestLock(false);
    };
    const holdFromGesture = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      playWakeVideo();
      if (!held()) requestLock(true);
    };
    const retry = () => {
      if (cancelled || document.visibilityState !== 'visible' || !userMayHoldScreen()) return;
      if (!held()) requestLock(false);
    };
    const drop = () => {
      const current = sentinel;
      sentinel = null;
      releasing = true;
      pauseWakeVideo();
      current?.removeEventListener?.('release', onReleased);
      void current?.release().catch(() => undefined).finally(() => { releasing = false; });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') retry();
      else drop();
    };
    document.addEventListener('click', holdFromGesture, true);
    document.addEventListener('touchend', holdFromGesture, true);
    document.addEventListener('fullscreenchange', retry);
    const timer = window.setInterval(retry, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('click', holdFromGesture, true);
      document.removeEventListener('touchend', holdFromGesture, true);
      document.removeEventListener('fullscreenchange', retry);
      document.removeEventListener('visibilitychange', onVisibility);
      drop();
    };
  }, [active]);
}
