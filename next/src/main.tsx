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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark" forceColorScheme="dark" theme={emberTheme}>
      <ModalsProvider>
        <Notifications position={window.matchMedia('(max-width: 767px)').matches ? 'top-center' : 'bottom-right'} limit={3} autoClose={4000} />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
