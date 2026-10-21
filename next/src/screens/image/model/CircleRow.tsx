/**
 * The row of circles (rule 4): one per entry — picture or initials, name under, weight or role
 * badge, dimmed when off / not downloaded / not on the server, ember ring on the selected one —
 * and a dashed green "+ Add" at the end when the kind can grow (`onAdd`). A removable entry has
 * its × on the circle's top-right corner (`onRemove`; Donny 10-20: Remove is part of the bubble,
 * not the card). Scrolls sideways when there are many. The picture follows "Model preview starts
 * on" (`ModelThumb`; a hover loads "Most popular").
 *
 * The badge sits centred under the circle and never wider than it (fix list item 40: a long
 * "Checkpoint" badge was cut off on the left); raw node names ("Load Checkpoint") are hidden
 * (`displayBadge`). `linked` (item 40): a small link mark on entries that follow step 1.
 *
 * A tap on a bubble = "Change" for that slot (fix list 2, added item: `onChange`, the picker on
 * that kind swapping that entry; the entry is selected too, so its card shows). Hover / keyboard
 * focus says so: the picture dims under a ⇄ "Change" veil and the ring brightens (bubble.css).
 * The red × removes on its own and never opens Change.
 */
import { IconArrowsExchange, IconLink, IconPlus, IconX } from '@tabler/icons-react';
import './bubble.css';
import { useStore } from '@/lib/store';
import { ModelThumb } from './ModelThumb';
import { readModelMeta } from './useModelMeta';
import { fmtWeight, type ModelEntry, type ModelKind } from './kindSpecs';
import { displayBadge } from './followLogic';
import { metaWithPending } from './pendingLogic';

const CIRCLE = 56;

export function CircleRow({ entries, selectedId, onSelect, onChange, onAdd, onRemove, showWeight = true, linked, kind = 'other' }: {
  entries: ModelEntry[]; selectedId?: string; onSelect: (id: string) => void;
  /** A tap on a bubble opens Change for that entry (after selecting it). Absent: a tap only selects. */
  onChange?: (id: string) => void;
  onAdd?: () => void; onRemove?: (id: string) => void; showWeight?: boolean;
  /** Entries that follow step 1 (item 40); absent = no link marks. */
  linked?: ReadonlySet<string>;
  /** The kind, to tell a raw node name ("Load Checkpoint") from a real title. */
  kind?: ModelKind;
}) {
  const hashes = useStore((s) => s.modelHashes);
  const civitai = useStore((s) => s.civitaiByHash);
  return (
    <div className="il-scroll-x" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 4px 0', touchAction: 'pan-x pan-y' }}>
      {entries.map((e, index) => {
        const meta = metaWithPending(readModelMeta(e.name, hashes, civitai), e.pending);
        const selected = e.id === selectedId;
        const state = e.pending ? 'not downloaded' : e.missing ? 'not on server' : undefined;
        const badge = state ?? displayBadge(e.badge, kind, index, entries.length) ?? (showWeight && !e.isBase && !e.noWeight ? fmtWeight(e.weight) : undefined);
        const dim = !e.on || !!state;
        const label = e.name ? meta.label : 'none';
        const removable = !!onRemove && !e.fixed;
        return (
          <div key={e.id} style={{ position: 'relative', width: 64, flex: 'none' }}>
          <button
            type="button"
            className="ilm-bubble"
            onClick={() => { onSelect(e.id); onChange?.(e.id); }}
            aria-pressed={selected}
            aria-label={onChange ? `Change ${meta.name ?? label}` : (meta.name ?? label)}
            title={e.pending ? `${e.pending.modelName} · not downloaded yet` : e.missing ? `${e.name} · not on this server` : onChange ? `${meta.name ?? label} · tap to change` : (meta.name ?? label)}
            style={{ width: 64, flex: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: selected ? 'var(--il-fg)' : dim ? 'var(--il-dim)' : 'var(--il-fg2)' }}
          >
            <span style={{ position: 'relative', width: CIRCLE, height: CIRCLE, flex: 'none' }}>
              <span className="ilm-bubble-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', display: 'block' }}>
                <ModelThumb label={e.name ? meta.label : '?'} meta={meta} size={CIRCLE} round
                  style={{ border: `3px solid ${selected ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, opacity: dim ? 0.45 : 1, boxSizing: 'border-box' }} />
              </span>
              {onChange && (
                <span aria-hidden className="ilm-bubble-veil" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,10,12,.58)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, pointerEvents: 'none' }}>
                  <IconArrowsExchange size={16} stroke={2.6} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.3px' }}>Change</span>
                </span>
              )}
              {badge && (
                <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -6, maxWidth: 64, boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: state ? 8 : 10, fontWeight: 800, borderRadius: 999, padding: '2px 6px', whiteSpace: 'nowrap', background: state ? 'var(--il-card-on)' : selected ? 'var(--il-ember)' : 'var(--il-card-on)', color: state ? 'var(--il-muted)' : selected ? 'var(--il-bg)' : 'var(--il-fg)', opacity: e.on || state ? 1 : 0.6 }}>
                  {badge}
                </span>
              )}
              {linked?.has(e.id) && (
                <span title="Same as step 1" style={{ position: 'absolute', left: -3, top: -3, width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--il-ember)', color: 'var(--il-bg)', border: '2px solid var(--il-panel)' }}>
                  <IconLink size={11} stroke={3} />
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: selected ? 800 : 700, maxWidth: 64, marginTop: badge ? 4 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}{e.on ? '' : ' · off'}
            </span>
          </button>
          {removable && (
            <button type="button" onClick={(ev) => { ev.stopPropagation(); onRemove!(e.id); }} aria-label={`Remove ${label}`} title="Remove"
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
