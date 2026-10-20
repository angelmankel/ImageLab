/**
 * Phone shell (STUB — owned by the Phone shell agent). Rule 11: on the step screen a glass dock
 * (row 1 = steps strip, row 2 = Create · Output · Generate · Library · More); elsewhere no dock,
 * only the BackPill. Tapping the picture opens the fullscreen viewer; swipe = next image.
 */
import { useRoute } from '~/app/routeStore';
import { LibraryPhoneScreen } from '~/screens/library';
import { ModelsPhoneScreen } from '~/screens/models';
import { ComfyPhoneScreen } from '~/screens/comfy';
import { SettingsPhoneScreen } from '~/screens/settings';
import { GlassBar } from '~/ui';

export function PhoneShell() {
  const screen = useRoute((s) => s.screen);
  const go = useRoute((s) => s.go);
  if (screen === 'library') return <LibraryPhoneScreen />;
  if (screen === 'models') return <ModelsPhoneScreen />;
  if (screen === 'comfy') return <ComfyPhoneScreen />;
  if (screen === 'settings') return <SettingsPhoneScreen />;
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
      Phone step screen — being built
      <GlassBar>
        <div style={{ display: 'flex', justifyContent: 'space-around', height: 48, alignItems: 'center', fontWeight: 800, fontSize: 11 }}>
          <button type="button" onClick={() => go('library')} style={{ border: 0, background: 'transparent', color: 'var(--il-fg2)' }}>Library</button>
          <button type="button" onClick={() => go('models')} style={{ border: 0, background: 'transparent', color: 'var(--il-fg2)' }}>Models</button>
          <button type="button" onClick={() => go('comfy')} style={{ border: 0, background: 'transparent', color: 'var(--il-fg2)' }}>ComfyUI</button>
        </div>
      </GlassBar>
    </div>
  );
}
