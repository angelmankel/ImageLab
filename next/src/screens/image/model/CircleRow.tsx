/**
 * The row of circles (rule 4): one per entry — picture or initials, name under, weight or role
 * badge, dimmed when off / not downloaded / not on the server, ember ring on the selected one —
 * and a dashed green "+ Add" at the end when the kind can grow (`onAdd`). A removable entry has
 * its × on the circle's top-right corner (`onRemove`; Donny 10-20: Remove is part of the bubble,
 * not the card). Scrolls sideways when there are many.
 */
import { IconPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { Thumb } from './Thumb';
import { readModelMeta } from './useModelMeta';
import { fmtWeight, type ModelEntry } from './kindSpecs';
import { metaWithPending } from './pendingLogic';

const CIRCLE = 56;

export function CircleRow({ entries, selectedId, onSelect, onAdd, onRemove, showWeight = true }: {
  entries: ModelEntry[]; selectedId?: string; onSelect: (id: string) => void; onAdd?: () => void; onRemove?: (id: string) => void; showWeight?: boolean;
}) {
  const hashes = useStore((s) => s.modelHashes);
  const civitai = useStore((s) => s.civitaiByHash);
  return (
    <div className="il-scroll-x" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '2px 2px 0', touchAction: 'pan-x pan-y' }}>
      {entries.map((e) => {
        const meta = metaWithPending(readModelMeta(e.name, hashes, civitai), e.pending);
        const selected = e.id === selectedId;
        const state = e.pending ? 'not downloaded' : e.missing ? 'not on server' : undefined;
        const badge = state ?? e.badge ?? (showWeight && !e.isBase && !e.noWeight ? fmtWeight(e.weight) : undefined);
        const dim = !e.on || !!state;
        const label = e.name ? meta.label : 'none';
        const removable = !!onRemove && !e.fixed;
        return (
          <div key={e.id} style={{ position: 'relative', width: 64, flex: 'none' }}>
          <button
            type="button"
            onClick={() => onSelect(e.id)}
            aria-pressed={selected}
            title={e.pending ? `${e.pending.modelName} · not downloaded yet` : e.missing ? `${e.name} · not on this server` : (meta.name ?? label)}
            style={{ width: 64, flex: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: selected ? 'var(--il-fg)' : dim ? 'var(--il-dim)' : 'var(--il-fg2)' }}
          >
            <span style={{ position: 'relative', width: CIRCLE, height: CIRCLE, flex: 'none' }}>
              <Thumb label={e.name ? meta.label : '?'} images={meta.images} size={CIRCLE} round
                style={{ border: `3px solid ${selected ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, opacity: dim ? 0.45 : 1, boxSizing: 'border-box' }} />
              {badge && (
                <span style={{ position: 'absolute', right: state ? -10 : -6, bottom: -4, fontSize: state ? 8 : 10, fontWeight: 800, borderRadius: 999, padding: '2px 6px', whiteSpace: 'nowrap', background: state ? 'var(--il-card-on)' : selected ? 'var(--il-ember)' : 'var(--il-card-on)', color: state ? 'var(--il-muted)' : selected ? 'var(--il-bg)' : 'var(--il-fg)', opacity: e.on || state ? 1 : 0.6 }}>
                  {badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: selected ? 800 : 700, maxWidth: 64, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}{e.on ? '' : ' · off'}
            </span>
          </button>
          {removable && (
            <button type="button" onClick={() => onRemove!(e.id)} aria-label={`Remove ${label}`} title="Remove"
              style={{ position: 'absolute', top: -2, right: 2, width: 20, height: 20, padding: 0, border: '2px solid var(--il-panel)', borderRadius: '50%', background: 'var(--il-err)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <IconX size={11} stroke={3} />
            </button>
          )}
          </div>
        );
      })}
      {onAdd && (
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
      )}
    </div>
  );
}
