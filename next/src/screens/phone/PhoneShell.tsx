/**
 * The phone shell (rule 11). The step screen is a sideways pager of the steps, each with a Create
 * and an Output page, under the glass dock (steps strip + Create · Output · Generate · Library ·
 * More). Library, Models, ComfyUI and Settings render their own `<Name>PhoneScreen` full screen
 * with no dock (each shows the lone "‹ Back" pill). The root effects (connection, jobs) run on
 * every screen.
 */
import { useRoute } from '~/app/routeStore';
import { LibraryPhoneScreen } from '~/screens/library';
import { ModelsPhoneScreen } from '~/screens/models';
import { ComfyPhoneScreen } from '~/screens/comfy';
import { SettingsPhoneScreen } from '~/screens/settings';
import { AppEffects } from './imageBridge';
import { PhoneStepScreen } from './PhoneStepScreen';

function Screen() {
  const screen = useRoute((s) => s.screen);
  if (screen === 'library') return <LibraryPhoneScreen />;
  if (screen === 'models') return <ModelsPhoneScreen />;
  if (screen === 'comfy') return <ComfyPhoneScreen />;
  if (screen === 'settings') return <SettingsPhoneScreen />;
  return <PhoneStepScreen />;
}

export function PhoneShell() {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: 'var(--il-bg)', overscrollBehavior: 'none' }}>
      <AppEffects />
      <Screen />
    </div>
  );
}
