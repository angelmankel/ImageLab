/**
 * The glass dock (rule 11): everything a thumb needs, at the bottom, over the page (never over the
 * picture: the pages leave room under their content). One translucent blurred card —
 *   row 1  the steps strip
 *   row 2  Create · Output · Generate · Library · More
 * Safe-area aware through `GlassBar`.
 */
import type { ReactNode } from 'react';
import { IconDots, IconFolder, IconPhoto, IconSparkles } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { GlassBar } from '~/ui';
import { GenerateOrb } from './GenerateOrb';
import { StepsStrip } from './StepsStrip';
import { usePhone } from './phoneStore';

/** The height the dock takes over the page, so scroll content can end above it. */
export const DOCK_SPACE = 150;

function DockTab({ label, icon, on, onClick }: { label: string; icon: ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      style={{
        width: 60, padding: 0, border: 0, background: 'transparent', cursor: 'pointer',
        color: on ? 'var(--il-fg)' : 'var(--il-muted)', fontSize: 10, fontWeight: on ? 800 : 700,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function PhoneDock({ onJump }: { onJump: (id: string) => void }) {
  const page = usePhone((s) => s.page);
  const setPage = usePhone((s) => s.setPage);
  const setMoreOpen = usePhone((s) => s.setMoreOpen);
  const go = useRoute((s) => s.go);
  return (
    <GlassBar style={{
      left: 12, right: 12, bottom: 'calc(10px + var(--il-safe-bottom))', borderRadius: 30, padding: '10px 10px 8px', gap: 8,
      background: 'color-mix(in srgb, var(--il-elev) var(--il-glass-pct, 72%), transparent)', boxShadow: '0 10px 30px rgba(0,0,0,.35)',
    }}>
      <StepsStrip onJump={onJump} />
      <div style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 4px' }}>
        <DockTab label="Create" icon={<IconSparkles size={22} stroke={2.2} />} on={page === 'create'} onClick={() => setPage('create')} />
        <DockTab label="Output" icon={<IconPhoto size={22} stroke={2.2} />} on={page === 'output'} onClick={() => setPage('output')} />
        <GenerateOrb />
        <DockTab label="Library" icon={<IconFolder size={22} stroke={2.2} />} onClick={() => go('library')} />
        <DockTab label="More" icon={<IconDots size={22} stroke={2.2} />} onClick={() => setMoreOpen(true)} />
      </div>
    </GlassBar>
  );
}
