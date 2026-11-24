import { useEffect, useState } from 'react';
import { isPhoneFullscreenWarningScreen, shouldShowFullscreenWarning } from '../lib/fullscreenToggle';

function documentIsFullscreen() {
  const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(document.fullscreenElement || webkitDocument.webkitFullscreenElement);
}

const WARNING_VISIBLE_MS = 10_000;

export default function FullscreenWarning() {
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const update = () => {
      const phone = isPhoneFullscreenWarningScreen(query => window.matchMedia(query).matches);
      const next = shouldShowFullscreenWarning(documentIsFullscreen(), phone);
      setEligible(next);
      if (!next) setDismissed(false);
    };
    update();
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  useEffect(() => {
    if (!eligible || dismissed) return;
    const timer = window.setTimeout(() => setDismissed(true), WARNING_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, dismissed]);
  if (!eligible || dismissed) return null;
  return <p className="fullscreen-warning" role="alert">
    <strong>더블탭으로 전체화면으로 전환해주세요</strong>
    <span>작은 화면에서는 핸드폰이 자동으로 꺼질 수 있습니다.</span>
  </p>;
}