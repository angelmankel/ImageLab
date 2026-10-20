import type { CSSProperties, ReactNode } from 'react';
import { T } from '~/theme/tokens';

/** A card on a panel: card grey, soft border, radius 14, padding 10 (rule 10). */
export function Card({ children, style, onClick, selected }: { children: ReactNode; style?: CSSProperties; onClick?: () => void; selected?: boolean }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        background: 'var(--il-card)', border: `1px solid ${selected ? 'var(--il-ember-line)' : 'var(--il-line-soft)'}`,
        borderRadius: T.radius.lg, padding: T.pad.card, cursor: onClick ? 'pointer' : undefined, ...style,
      }}
    >
      {children}
    </div>
  );
}

/** "STEP 1 · WORKFLOW" style label. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="il-eyebrow" style={style}>{children}</div>;
}

/** A row that lays its children out with a 6px gap. */
export function Row({ children, gap = T.gap.sm, style, wrap }: { children: ReactNode; gap?: number; style?: CSSProperties; wrap?: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : undefined, ...style }}>{children}</div>;
}
