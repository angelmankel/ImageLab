/**
 * Home on a phone (fix list 20; fix list 2 #14): the same home page — a top bar with the logo and
 * Mute, the places (History, Models, ComfyUI, Settings) as a sideways-scrolling pill row, the
 * masonry in 2 columns with ghost tiles, the Back pill to the session.
 */
import { useRoute } from '~/app/routeStore';
import { BackPill } from '~/ui';
import { MuteToggle } from '~/ui/MuteToggle';
import { Logo, Wordmark } from '~/screens/image/TopBar';
import { HomeScreen } from './HomeScreen';
import { PlacePills } from './HomeTopBar';

export function HomePhoneScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 12px', paddingTop: 'var(--il-safe-top, 0px)', boxSizing: 'content-box' }}>
        <Logo size={28} />
        <Wordmark size={16} />
        <span style={{ flex: 1 }} />
        <MuteToggle size={40} />
      </div>
      <div className="il-scroll" style={{ flex: 'none', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x', padding: '0 12px 8px', scrollbarWidth: 'none' }}>
        <PlacePills phone />
      </div>
      <HomeScreen phone />
      <BackPill onClick={() => useRoute.getState().go('step')} />
    </div>
  );
}
