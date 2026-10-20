/**
 * Desktop shell (STUB — the Shell + Image step agent replaces this with the real one).
 *
 *   ┌ TopBar (56) ──────────────────────────────────────────────────────────┐
 *   │ Rail │ <screen>                                                       │
 *   │ (84) │  step: [StepPanel 404][toolbar 52 / stage][History 300]        │
 *   │      │  library / models / comfy / settings: the screen fills it      │
 *   └──────┴────────────────────────────────────────────────────────────────┘
 */
import { useRoute } from '~/app/routeStore';
import { T } from '~/theme/tokens';
import { TopBar } from './TopBar';
import { Rail } from './Rail';
import { ImageScreen } from './index';
import { LibraryScreen } from '~/screens/library';
import { ModelsScreen } from '~/screens/models';
import { ComfyScreen } from '~/screens/comfy';
import { SettingsScreen } from '~/screens/settings';

export function DesktopShell() {
  const screen = useRoute((s) => s.screen);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <TopBar />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Rail />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
          {screen === 'step' && <ImageScreen />}
          {screen === 'library' && <LibraryScreen />}
          {screen === 'models' && <ModelsScreen />}
          {screen === 'comfy' && <ComfyScreen />}
          {screen === 'settings' && <SettingsScreen />}
        </div>
      </div>
      <span hidden>{T.size.rail}</span>
    </div>
  );
}
