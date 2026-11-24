import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import FullscreenWarning from './components/FullscreenWarning';
import Loading from './components/Loading';
import { isFullscreenToggleTarget, toggleDocumentFullscreen } from './lib/fullscreenToggle';
import { useScreenWakeLock } from './lib/useScreenWakeLock';
import { loadVisitCount, startVisitPresence } from './lib/visitCount';
import AccessPage from './pages/AccessPage';
import AdminPage from './pages/AdminPage';
import BoardPage from './pages/BoardPage';
import BootstrapPage from './pages/BootstrapPage';
import CreditsPage from './pages/CreditsPage';
import DashboardPage from './pages/DashboardPage';
import EntryPage from './pages/EntryPage';
import GameHubPage from './pages/GameHubPage';
import GamePage from './pages/GamePage';
import GostopGamePage from './pages/GostopGamePage';
import GostopLobbyPage from './pages/GostopLobbyPage';
import LicensePage from './pages/LicensePage';
import LoginPage from './pages/LoginPage';
import PrivacyPage from './pages/PrivacyPage';

function LegacyGameRoute() {
  const location = useLocation();
  return <Navigate to={`/matgo/play${location.search}`} replace />;
}

function MatgoPlayRoute() {
  const location = useLocation();
  return <GamePage key={location.search} />;
}

const OPENING_SPLASH_MS = 1200;

function OpeningSplash({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let splashTimer = 0;
    const showSplashThenContinue = () => {
      if (settled || cancelled) return;
      settled = true;
      splashTimer = window.setTimeout(() => { if (!cancelled) setReady(true); }, OPENING_SPLASH_MS);
    };
    const limitTimer = window.setTimeout(showSplashThenContinue, 2500);
    loadVisitCount().finally(() => {
      window.clearTimeout(limitTimer);
      showSplashThenContinue();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(limitTimer);
      window.clearTimeout(splashTimer);
    };
  }, []);
  if (!ready) return <Loading />;
  return children;
}

export default function App() {
  useScreenWakeLock(true);
  useEffect(() => startVisitPresence(), []);
  useEffect(() => {
    const onDoubleClick = (event: MouseEvent) => {
      if (!isFullscreenToggleTarget(event.target)) return;
      void toggleDocumentFullscreen().catch(() => undefined);
    };
    document.addEventListener('dblclick', onDoubleClick);
    return () => document.removeEventListener('dblclick', onDoubleClick);
  }, []);
  return <>
    <FullscreenWarning />
    <OpeningSplash><Routes>
    <Route path="/" element={<Navigate to="/matgo/play?solo=1" replace />} />
    <Route path="/entry" element={<EntryPage />} />
    <Route path="/bootstrap" element={<BootstrapPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/board" element={<BoardPage />} />
    <Route path="/access" element={<AccessPage />} />
    <Route path="/credits" element={<CreditsPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="/license" element={<LicensePage />} />
    <Route path="/home" element={<GameHubPage />} />
    <Route path="/family" element={<AdminPage />} />
    <Route path="/matgo" element={<DashboardPage />} />
    <Route path="/matgo/play" element={<MatgoPlayRoute />} />
    <Route path="/gostop" element={<GostopLobbyPage />} />
    <Route path="/gostop/play" element={<GostopGamePage />} />
    <Route path="/game" element={<LegacyGameRoute />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></OpeningSplash>
  </>;
}
