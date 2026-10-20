import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import './styles/next.css';
import { emberTheme } from '~/theme/mantineTheme';
import { App } from '~/app/App';

// Installable app: register the service worker in built copies only (the dev server has none).
// It sits next to index.html, so its scope is /imagelab/next/ — narrower than the main app's, so it wins here.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[sw] registration failed', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark" forceColorScheme="dark" theme={emberTheme}>
      <ModalsProvider>
        <Notifications position={window.matchMedia('(max-width: 767px)').matches ? 'top-center' : 'bottom-right'} limit={3} autoClose={3000} />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
