import type { ReactNode } from 'react';

/**
 * The evenly spaced tab row (Prompt · Model · Settings · Input; Checkpoint · LoRAs · Embeds ·
 * ControlNet; All · Images · Videos · ★). Underline-free: the active tab is a filled pill on a
 * dark track. `compact` = 28 high for filter rows.
 */
export function Tabs<K extends string>({ items, value, onChange, compact, fill = true }: {
  items: Array<{ key: K; label: ReactNode; title?: string }>; value: K; onChange: (k: K) => void; compact?: boolean; fill?: boolean;
}) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--il-bg-deep)', width: fill ? '100%' : undefined }}>
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
              flex: fill ? 1 : 'none', height: compact ? 26 : 32, padding: '0 12px', border: 0, borderRadius: 999,
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
