import { useEffect, useState } from 'react';
import { currentInstallOffer, promptAppInstall, subscribeInstallPrompt, type InstallOffer } from '../lib/installPrompt';

export default function AppInstallPrompt() {
  const [offer, setOffer] = useState<InstallOffer>(() => currentInstallOffer());
  useEffect(() => subscribeInstallPrompt(() => setOffer(currentInstallOffer())), []);
  if (offer === 'hidden') return null;
  return <section className="app-install-prompt" aria-label="앱 설치">
    <strong>앱으로 설치하세요</strong>
    {offer === 'prompt'
      ? <button type="button" className="app-install-button" onClick={() => void promptAppInstall()}>앱 설치</button>
      : <p>{offer === 'ios'
        ? '사파리 공유 단추를 누른 뒤 홈 화면에 추가를 선택하세요.'
        : '브라우저 메뉴에서 가족화투를 설치하거나 홈 화면에 추가하세요.'}</p>}
  </section>;
}
