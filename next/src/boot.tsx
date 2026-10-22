// The app itself. main.tsx imports this only after the cross-device sync has filled localStorage,
// because every persisted zustand store reads localStorage when its module loads.
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
