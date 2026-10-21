/**
 * The pages m-shell owns in the phone map (mobile pass): Home (the origin) and Settings, plus
 * stand-ins (`fallback: true`) for the places ('library', 'models', 'comfy') until m-browse's land.
 * A real registration always replaces a stand-in. The create flow (session / step / section) is
 * m-create's (`screens/phone/tree/createPages.tsx`).
 */
import { IconPlus, IconSparkles } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { useSessions, displayName } from '~/app/sessionsStore';
import { HomeScreen } from '~/screens/home/HomeScreen';
import { PlacePills } from '~/screens/home/HomeTopBar';
import { Logo, Wordmark } from '~/screens/image/TopBar';
import { FullscreenBtn } from '~/screens/image/topbar/FullscreenBtn';
import { LibraryPhoneScreen } from '~/screens/library';
import { ModelsPhoneScreen } from '~/screens/models';
import { ComfyPhoneScreen } from '~/screens/comfy';
import { usePhoneBand } from './band';
import { registerPhonePage } from './pages';

/* ---------- Home: depth 0, the origin ---------- */

function HomePage() {
  const cur = useSessions((s) => s.sessions[s.currentId]);
  usePhoneBand({
    left: { label: 'New', icon: <IconPlus size={18} stroke={2.6} />, onClick: () => { useSessions.getState().create(); useRoute.getState().go('step'); } },
    right: cur ? { label: displayName(cur.name), icon: <IconSparkles size={17} stroke={2.4} />, onClick: () => useRoute.getState().go('step') } : null,
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box' }}>
        <Logo size={28} />
        <Wordmark size={16} />
        <span style={{ flex: 1 }} />
        <FullscreenBtn />
      </div>
      <div className="il-scroll" style={{ flex: 'none', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x', padding: '0 12px 8px', scrollbarWidth: 'none' }}>
        <PlacePills phone />
      </div>
      <HomeScreen phone />
    </div>
  );
}

registerPhonePage('home', { Component: HomePage, title: () => 'Home', screen: 'home', header: false, pair: false });

/* ---------- Settings (m-shell) ---------- */

import '~/screens/settings/SettingsPages'; // 'settings' → 'settings-category' (siblings = categories) → 'settings-provider'

/* ---------- stand-ins for the places (m-browse registers the real ones) ---------- */

const wrap = (C: () => JSX.Element | null) => () => <div style={{ position: 'absolute', inset: 0 }}><C /></div>;
registerPhonePage('library', { Component: wrap(LibraryPhoneScreen), title: () => 'History', screen: 'library', header: false, fallback: true });
registerPhonePage('models', { Component: wrap(ModelsPhoneScreen), title: () => 'Models', screen: 'models', header: false, fallback: true });
registerPhonePage('comfy', { Component: wrap(ComfyPhoneScreen), title: () => 'ComfyUI', screen: 'comfy', header: false, fallback: true });
