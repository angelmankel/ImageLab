import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import App from './App';
import { ThemeProvider } from '@/modules/theme';
// Inter ships with the bundle: pods are not guaranteed to reach Google Fonts.
import '@fontsource-variable/inter';
import './styles/index.css';

// Dev-only side-effect: attaches window.__exerciseCanvasStorage (gated inside the module).
import './lib/idbCanvasStorage';
// Dev-only side-effect: attaches window.__exerciseCanvasLayers (gated inside the module).
import './lib/canvasLayersExercise';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ModalsProvider>
        {/* On a phone the bottom corner belongs to the floating Generate buttons. */}
        <Notifications position={window.matchMedia('(max-width: 767px)').matches ? 'top-center' : 'bottom-right'} limit={3} autoClose={4000} />
        <App />
      </ModalsProvider>
    </ThemeProvider>
  </StrictMode>,
);

// Installable app: register the service worker in built copies only (the dev server has none).
// It sits next to index.html, so its scope is wherever the app is served, e.g. /imagelab/.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[sw] registration failed', err));
  });
}
