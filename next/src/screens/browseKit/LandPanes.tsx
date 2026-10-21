/**
 * Mobile pass (m-browse): the two panes of a browse screen on a phone in LANDSCAPE — the History
 * page, Models, the model viewer, Starters, ComfyUI. Not the portrait column stretched: a picture /
 * list pane and a details / controls pane side by side, each scrolling on its own, the notch side
 * padded (safe-area left / right). `split` = the first pane's share of the width.
 *
 *   ┌ first (split) ───────────┬ second (rest) ──────┐
 *   │                          │                     │
 *   └──────────────────────────┴─────────────────────┘
 *
 * `LandBack` is the landscape "‹ Back": a pill in a pane's top row (the portrait centred glass
 * pill would sit over both panes).
 */
import type { CSSProperties, ReactNode } from 'react';
import { IconChevronLeft } from '@tabler/icons-react';

export function LandPanes({ first, second, split = 0.56, firstStyle, secondStyle }: {
  first: ReactNode; second: ReactNode; split?: number; firstStyle?: CSSProperties; secondStyle?: CSSProperties;
}) {
  return (
    <div style={{
      height: '100%', display: 'flex', background: 'var(--il-bg)', overflow: 'hidden',
      paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)',
    }}>
      <section style={{ flex: `0 0 ${Math.round(split * 1000) / 10}%`, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', ...firstStyle }}>{first}</section>
      <section style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--il-line)', background: 'var(--il-panel)', ...secondStyle }}>{second}</section>
    </div>
  );
}

export function LandBack({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ height: 40, padding: '0 12px 0 6px', border: 0, borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 'none' }}>
      <IconChevronLeft size={18} stroke={2.6} />{label}
    </button>
  );
}
