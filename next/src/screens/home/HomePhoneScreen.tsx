/** Home on a phone (fix list 20): a top bar with the logo, the same masonry tiles in 2 columns, the Back pill. */
import { useRoute } from '~/app/routeStore';
import { BackPill } from '~/ui';
import { Logo, Wordmark } from '~/screens/image/TopBar';
import { HomeScreen } from './HomeScreen';

export function HomePhoneScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', paddingTop: 'var(--il-safe-top, 0px)', borderBottom: '1px solid var(--il-line)' }}>
        <Logo size={26} />
        <Wordmark size={15} />
      </div>
      <HomeScreen phone />
      <BackPill onClick={() => useRoute.getState().go('step')} />
    </div>
  );
}
