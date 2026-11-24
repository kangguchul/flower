import { useEffect, useRef } from 'react';
import type { AudioSettings } from './audioSettings';
import { applyVolumeWheel, wheelTargetCanScroll } from './volumeWheel';

export function useVolumeWheel(settings: AudioSettings, onChange: (settings: AudioSettings) => void) {
  const settingsRef = useRef(settings);
  const onChangeRef = useRef(onChange);
  settingsRef.current = settings;
  onChangeRef.current = onChange;
  useEffect(() => {
    let pending = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.deltaY === 0) return;
      if (wheelTargetCanScroll(event.target, event.deltaY)) return;
      event.preventDefault();
      const current = settingsRef.current;
      const next = applyVolumeWheel(current.volume, event.deltaY, pending, event.deltaMode);
      pending = next.pending;
      if (next.volume === current.volume) return;
      onChangeRef.current({ ...current, volume: next.volume });
    };
    document.addEventListener('wheel', onWheel, { passive: false });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);
}
