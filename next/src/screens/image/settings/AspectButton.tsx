/**
 * One aspect-ratio button (rule 5: "tall buttons with shape icons"): a small rectangle in the
 * ratio's shape, the ratio under it. 56 high, radius 14; ember ring when selected.
 */
import { T } from '~/theme/tokens';

export function AspectButton({ id, w, h, on, onClick, title }: { id: string; w?: number; h?: number; on: boolean; onClick: () => void; title?: string }) {
  const custom = !w || !h;
  const iw = custom ? 18 : Math.round(18 * Math.min(1, w / h));
  const ih = custom ? 18 : Math.round(18 * Math.min(1, h / w));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      style={{
        height: 56, minWidth: 0, borderRadius: T.radius.lg, cursor: 'pointer',
        border: on ? '2px solid var(--il-ember)' : '1px solid var(--il-line-strong)',
        background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-fg2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        fontSize: 11, fontWeight: on ? 800 : 700, padding: 0,
      }}
    >
      {custom
        ? <span aria-hidden style={{ fontSize: 16, lineHeight: '18px', height: 18 }}>⋯</span>
        : <span aria-hidden style={{ width: iw, height: ih, border: '2px solid currentColor', borderRadius: 3, boxSizing: 'border-box' }} />}
      {id === 'custom' ? 'Custom' : id}
    </button>
  );
}
