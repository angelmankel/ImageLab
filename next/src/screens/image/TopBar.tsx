/** Rule 9: ember logo + "ImageLab", session name ▾, status pill, "Queue 2 · ↓ 1". Nothing else. */
import { IconFolder, IconListDetails, IconArrowDown } from '@tabler/icons-react';
import { Pill, Count, Dot } from '~/ui';
import { T } from '~/theme/tokens';

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: 'var(--il-ember)', display: 'grid', placeItems: 'center', flex: 'none' }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none"><path d="M12 2.5c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2 .8-3.4 1.8-4.6.3 1.6 1.2 2.6 2.4 2.6 1.6 0 2.3-1.8 1.3-4.5C11.6 5.2 11.6 3.8 12 2.5z" fill="#141416" /><circle cx="12" cy="14.5" r="2.2" fill="#FFF1E6" /></svg>
    </div>
  );
}

export function TopBar() {
  return (
    <div style={{ height: T.size.topBar, flex: 'none', display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: '0 16px', borderBottom: '1px solid var(--il-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: T.gap.sm }}>
        <Logo />
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.4px' }}>Image<span style={{ color: 'var(--il-ember)' }}>Lab</span></span>
      </div>
      <Pill onClick={() => {}} style={{ marginLeft: 8, color: 'var(--il-fg)', fontSize: 13 }}>
        <IconFolder size={15} color="var(--il-muted)" />Session<span style={{ color: 'var(--il-muted)' }}>▾</span>
      </Pill>
      <div style={{ flex: 1 }} />
      <Pill><Dot />This pod</Pill>
      <Pill onClick={() => {}} title="Queue">
        <IconListDetails size={16} />Queue <Count n={0} /><span style={{ color: 'var(--il-muted)' }}>·</span><IconArrowDown size={14} />0
      </Pill>
    </div>
  );
}
