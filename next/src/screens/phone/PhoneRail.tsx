/**
 * DEPRECATED (10-21): the phone map's band (`~/phone/nav/Band`) replaces the dock in both orientations.
 * The dock in landscape (mobile pass, m-shell): the same five places as the portrait dock —
 * Create · Output · Generate · Library · More — stacked in a slim column at the right edge, where
 * the thumb is when a phone is held sideways. Its own column of `PhoneTwoPane` (`rail`), so it never
 * covers the picture. The steps strip moves to the top of the side pane (`sideHeader`).
 */
import type { ReactNode } from 'react';
import { IconDots, IconFolder, IconPhoto, IconSparkles } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { haptic } from '~/phone/haptic';
import { GenerateOrb } from './GenerateOrb';
import { usePhone } from './phoneStore';

export const RAIL_WIDTH = 76;

function RailTab({ label, icon, on, onClick }: { label: string; icon: ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }} aria-current={on ? 'page' : undefined}
      style={{
        width: 64, minHeight: 48, padding: '4px 0', border: 0, borderRadius: 14, cursor: 'pointer',
        background: on ? 'var(--il-card)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)',
        fontSize: 10, fontWeight: on ? 800 : 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      }}>
      {icon}
      {label}
    </button>
  );
}

export function PhoneRail() {
  const page = usePhone((s) => s.page);
  const setPage = usePhone((s) => s.setPage);
  const setMoreOpen = usePhone((s) => s.setMoreOpen);
  const go = useRoute((s) => s.go);
  return (
    <nav aria-label="Dock"
      style={{
        width: `calc(${RAIL_WIDTH}px + env(safe-area-inset-right, 0px))`, flex: 'none', boxSizing: 'border-box',
        padding: `calc(6px + env(safe-area-inset-top, 0px)) env(safe-area-inset-right, 0px) calc(6px + var(--il-safe-bottom)) 0`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', gap: 2,
        background: 'var(--il-bg-deep)', borderLeft: '1px solid var(--il-line)',
      }}>
      <RailTab label="Create" icon={<IconSparkles size={21} stroke={2.2} />} on={page === 'create'} onClick={() => setPage('create')} />
      <RailTab label="Output" icon={<IconPhoto size={21} stroke={2.2} />} on={page === 'output'} onClick={() => setPage('output')} />
      <GenerateOrb />
      <RailTab label="Library" icon={<IconFolder size={21} stroke={2.2} />} onClick={() => go('library')} />
      <RailTab label="More" icon={<IconDots size={21} stroke={2.2} />} onClick={() => setMoreOpen(true)} />
    </nav>
  );
}
