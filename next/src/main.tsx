import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import './styles/next.css';
import './styles/theme.css';
import { ThemedMantine, ThemeRoot } from '~/theme/ThemeRoot';
import { App } from '~/app/App';
import { getFormFactor } from '~/app/useFormFactor';

// Installable app: register the service worker in built copies only (the dev server has none).
// It sits next to index.html, so its scope is /imagelab/next/ — narrower than the main app's, so it wins here.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[sw] registration failed', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemedMantine>
      <ModalsProvider>
        <Notifications position={getFormFactor().phone ? 'top-center' : 'bottom-right'} limit={3} autoClose={3000} />
        <ThemeRoot app={App} />
      </ModalsProvider>
    </ThemedMantine>
  </StrictMode>,
);
