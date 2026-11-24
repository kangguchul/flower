import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { rememberInstallPrompt } from './lib/installPrompt';
import './styles/app.css';
import './styles/gameHub.css';
import './styles/gameStatistics.css';
import './styles/gostopRoom.css';
import './styles/game.css';
import './styles/fiveGoCelebration.css';

window.addEventListener('beforeinstallprompt', rememberInstallPrompt);

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void Promise.all([
      navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
        registrations.map(registration => registration.unregister())
      )),
      'caches' in window
        ? caches.keys().then(keys => Promise.all(
          keys.filter(key => key.startsWith('nsj-hwatu-shell-')).map(key => caches.delete(key))
        ))
        : Promise.resolve([])
    ]).catch(() => undefined);
  });
} else if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js?v=9', { updateViaCache: 'none' })
      .catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>
);
