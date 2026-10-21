import type { ReactNode } from 'react';
import { btnRadius } from '~/theme/tokens';

/**
 * The evenly spaced tab row (Prompt · Model · Settings · Input; Checkpoint · LoRAs · Embeds ·
 * ControlNet; All · Images · Videos · ★). Underline-free: the active tab is a filled pill on a
 * dark track. `compact` = 28 high for filter rows.
 */
export function Tabs<K extends string>({ items, value, onChange, compact, fill = true, itemPad = 12, hug = false, h }: {
  items: Array<{ key: K; label: ReactNode; title?: string }>; value: K; onChange: (k: K) => void; compact?: boolean; fill?: boolean;
  /** Side padding of each tab (default 12). */
  itemPad?: number;
  /** With `fill`: tabs share the row by their content (flex auto) instead of evenly. */
  hug?: boolean;
  /** Tab height (default 32, compact 26; the phone's 40 for touch). */
  h?: number;
}) {
  const height = h ?? (compact ? 26 : 32);
  return (
    <div role="tablist" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: `calc(${btnRadius(height)} + 3px)`, background: 'var(--il-bg-deep)', width: fill ? '100%' : undefined }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            role="tab"
            type="button"
            aria-selected={on}
            title={it.title}
            onClick={() => onChange(it.key)}
            style={{
              // A label may be icon + text: Tailwind's preflight makes the <svg> a block, so lay them out in one centred row.
              flex: fill ? (hug ? '1 1 auto' : 1) : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0,
              height, padding: `0 ${itemPad}px`, border: 0, borderRadius: btnRadius(height),
              background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)',
              fontWeight: 800, fontSize: compact ? 11 : 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
