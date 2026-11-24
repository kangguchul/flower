import { useEffect, useState } from 'react';
import { isPhoneFullscreenWarningScreen, shouldShowFullscreenWarning } from '../lib/fullscreenToggle';

function documentIsFullscreen() {
  const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(document.fullscreenElement || webkitDocument.webkitFullscreenElement);
}

export default function FullscreenWarning() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => {
      const phone = isPhoneFullscreenWarningScreen(query => window.matchMedia(query).matches);
      setVisible(shouldShowFullscreenWarning(documentIsFullscreen(), phone));
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
  if (!visible) return null;
  return <p className="fullscreen-warning" role="alert">
    <strong>더블탭으로 전체화면으로 전환해주세요</strong>
    <span>작은 화면에서는 핸드폰이 자동으로 꺼질 수 있습니다.</span>
  </p>;
}