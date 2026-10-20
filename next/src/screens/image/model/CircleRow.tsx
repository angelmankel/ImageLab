/**
 * The row of circles (rule 4): one per entry — picture or initials, name under, weight badge,
 * dimmed when off, ember ring on the selected one — and a dashed green "+ Add" at the end.
 * Scrolls sideways when there are many.
 */
import { IconPlus } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { Thumb } from './Thumb';
import { readModelMeta } from './useModelMeta';
import { fmtWeight, type ModelEntry } from './kinds';

const CIRCLE = 56;

export function CircleRow({ entries, selectedId, onSelect, onAdd, showWeight = true }: {
  entries: ModelEntry[]; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void; showWeight?: boolean;
}) {
  const hashes = useStore((s) => s.modelHashes);
  const civitai = useStore((s) => s.civitaiByHash);
  return (
    <div className="il-scroll-x" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '2px 2px 0', touchAction: 'pan-x pan-y' }}>
      {entries.map((e) => {
        const meta = readModelMeta(e.name, hashes, civitai);
        const selected = e.id === selectedId;
        const badge = e.badge ?? (showWeight && !e.isBase ? fmtWeight(e.weight) : undefined);
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelect(e.id)}
            aria-pressed={selected}
            title={meta.name ?? meta.label}
            style={{ width: 64, flex: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: selected ? 'var(--il-fg)' : e.on ? 'var(--il-fg2)' : 'var(--il-dim)' }}
          >
            <span style={{ position: 'relative', width: CIRCLE, height: CIRCLE, flex: 'none' }}>
              <Thumb label={meta.label} images={meta.images} size={CIRCLE} round
                style={{ border: `3px solid ${selected ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, opacity: e.on ? 1 : 0.45, boxSizing: 'border-box' }} />
              {badge && (
                <span style={{ position: 'absolute', right: -6, bottom: -4, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 6px', background: selected ? 'var(--il-ember)' : 'var(--il-card-on)', color: selected ? 'var(--il-bg)' : 'var(--il-fg)', opacity: e.on ? 1 : 0.6 }}>
                  {badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: selected ? 800 : 700, maxWidth: 64, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta.label}{e.on ? '' : ' · off'}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add"
        style={{ width: 64, flex: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--il-ok)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
      >
        <span style={{ width: CIRCLE, height: CIRCLE, borderRadius: '50%', border: '2px dashed var(--il-ok)', background: 'color-mix(in srgb, var(--il-ok) 8%, transparent)', display: 'grid', placeItems: 'center' }}>
          <IconPlus size={18} stroke={2.8} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 800 }}>Add</span>
      </button>
    </div>
  );
}
