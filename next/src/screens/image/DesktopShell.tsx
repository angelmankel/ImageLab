/**
 * Desktop shell (rules 1, 2, 9):
 *
 *   ┌ TopBar (56) ──────────────────────────────────────────────────────────┐
 *   │ Rail │ <screen>                                                       │
 *   │ (84) │  step: [StepPanel 404][toolbar 52 / stage][History 300]        │
 *   │      │  library / models / comfy / settings: the screen fills it      │
 *   └──────┴────────────────────────────────────────────────────────────────┘
 *
 * Mounts `AppEffects` (sockets, reconciliation, probes); the phone shell mounts its own.
 */
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useRoute } from '~/app/routeStore';
import { TopBar } from './TopBar';
import { Rail } from './Rail';
import { AppEffects } from './AppEffects';
import { ImageScreen } from './index';
import { LibraryScreen } from '~/screens/library';
import { ModelsScreen } from '~/screens/models';
import { ComfyScreen } from '~/screens/comfy';
import { SettingsScreen } from '~/screens/settings';

export function DesktopShell() {
  const screen = useRoute((s) => s.screen);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <AppEffects />
      <TopBar />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Rail />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
          <ErrorBoundary label={screen}>
            {screen === 'step' && <ImageScreen />}
            {screen === 'library' && <LibraryScreen />}
            {screen === 'models' && <ModelsScreen />}
            {screen === 'comfy' && <ComfyScreen />}
            {screen === 'settings' && <SettingsScreen />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
