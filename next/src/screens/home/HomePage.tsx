/**
 * Home as a real home page (fix list 2 #14): its own full-screen page, not the app shell with an
 * empty panel. Its own top bar (`HomeTopBar`), the sessions masonry as the main area (with ghost
 * tiles filling the empty space), the app footer at the bottom.
 */
import { Footer } from '~/screens/image/footer/Footer';
import { HomeScreen } from './HomeScreen';
import { HomeTopBar } from './HomeTopBar';
import { useSessionOutputs } from './useSessionOutputs';

export function HomePage() {
  const outputs = useSessionOutputs();
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <HomeTopBar outputs={outputs} />
      <HomeScreen outputs={outputs} />
      <Footer />
    </div>
  );
}
