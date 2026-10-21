import type { CSSProperties, ReactNode } from 'react';
import { T, btnRadius } from '~/theme/tokens';
import { useNavFrame } from '~/phone/nav/frameFlag';

/**
 * The phone's glass surfaces (rule 11). `GlassBar` sits at the bottom edge above the safe area;
 * `BackPill` is the lone centred "‹ Back" on screens that cannot generate.
 */
export function GlassBar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="il-glass"
      style={{
        position: 'fixed', left: 8, right: 8, bottom: `calc(8px + var(--il-safe-bottom))`, zIndex: T.z.dock,
        borderRadius: 22, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, ...style,
      }}
    >
      {children}
    </div>
  );
}

export function BackPill({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  // The phone's nav frame has its own way out (pull the card down, the band's "‹ parent").
  if (useNavFrame((s) => s.on)) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="il-glass"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: `calc(12px + var(--il-safe-bottom))`, zIndex: T.z.dock,
        height: 44, padding: '0 20px', borderRadius: btnRadius(44), color: 'var(--il-fg)', fontWeight: 800, fontSize: 14, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>‹</span>{label}
    </button>
  );
}
