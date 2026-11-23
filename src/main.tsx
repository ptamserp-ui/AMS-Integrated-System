import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/common/ErrorBoundary';
import InitialLoadingScreen from './components/common/InitialLoadingScreen';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    try {
      const markerKey = 'ams_vite_preload_reload_at';
      const lastReload = Number(sessionStorage.getItem(markerKey) || '0');
      if (!lastReload || Date.now() - lastReload > 15_000) {
        sessionStorage.setItem(markerKey, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* abaikan bila sessionStorage dibatasi */
    }
  });
}

const App = lazy(() => import('./App.tsx'));
const MobileApp = lazy(() => import('./components/mobile/MobileApp.tsx'));
const PublicWebsiteApp = lazy(() => import('./components/modules/website/site/PublicWebsiteApp.tsx'));

const JALUR_SITUS_PUBLIK = /^\/web\/?/;
const JALUR_MOBILE = /^\/mobile\/?/;

const jalur = window.location.pathname;
const Halaman = JALUR_MOBILE.test(jalur) ? (
  <MobileApp />
) : JALUR_SITUS_PUBLIK.test(jalur) ? (
  <PublicWebsiteApp />
) : (
  <App />
);

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary label="aplikasi">
    <Suspense
      fallback={
        <InitialLoadingScreen
          title="MEMUAT APLIKASI AMS"
          message="Menyiapkan modul aplikasi..."
        />
      }
    >
      {Halaman}
    </Suspense>
  </ErrorBoundary>
);
