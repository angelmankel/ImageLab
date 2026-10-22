import { startSync } from '~/app/sync';

// Installable app: register the service worker in built copies only (the dev server has none).
// It sits next to index.html, so its scope is /imagelab/next/ — narrower than the main app's, so it wins here.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[sw] registration failed', err));
  });
}

// Cross-device sync must fill localStorage before any store module loads (they read it on import).
startSync().catch((err) => console.warn('[sync] off', err)).finally(() => import('./boot'));
