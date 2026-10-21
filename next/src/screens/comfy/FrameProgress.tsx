/**
 * FIXLIST-2 #51: with "Hide menus" on, ComfyUI's own progress UI is hidden — so a slim chip at
 * the top of the ComfyUI frame says what runs on this server ("KSampler · 12/20 · 60% · 2 queued",
 * ✕ to stop it) with a thin bar along the frame's top edge. A prompt queued inside ComfyUI is
 * followed through ./comfyJobs (its frame events); one of ours through the bus (`useComfyHost`).
 * The chip sits over ComfyUI's node canvas (not over any picture of ours) and takes no clicks
 * outside itself.
 */
import { IconX } from '@tabler/icons-react';
import { useComfyFrame } from './comfyFrame';
import { cancelComfyRow, useComfyJobs } from './comfyJobs';
import { chipText, comfyRowId, graphNodeName, type ForeignLive } from './comfyJobsLogic';
import { cancelRow } from './queueActions';
import type { ComfyHostState } from './useComfyHost';

export function FrameProgress({ host, live }: { host: string | null; live: Pick<ComfyHostState, 'rows' | 'live'> }) {
  const hideMenus = useComfyFrame((s) => s.hideMenus);
  const foreign = useComfyJobs((s) => (host ? s.hosts[host] : undefined));
  if (!hideMenus || !host) return null;

  const queued = live.rows.filter((r) => r.state === 'pending').length;
  let node = '';
  let lv: ForeignLive | null = null;
  let stop: (() => void) | null = null;
  const theirs = foreign?.items.find((i) => i.state === 'running');
  if (theirs) {
    lv = foreign?.live?.promptId === theirs.promptId ? foreign.live : null;
    node = graphNodeName(theirs.graph, lv?.node ?? null);
    stop = () => void cancelComfyRow(comfyRowId(host, theirs.promptId));
  } else {
    const ours = live.rows.find((r) => r.state === 'running');
    if (!ours) return null;
    lv = live.live?.promptId === ours.id ? live.live : null;
    node = graphNodeName(ours.graph, lv?.node ?? null);
    stop = () => void cancelRow(host, ours).catch(() => { /* the next poll shows the truth */ });
  }
  const pct = lv && lv.max > 0 ? Math.round((lv.value / lv.max) * 100) : null;
  const text = chipText(node, lv, queued);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none', zIndex: 2 }}>
      <div aria-hidden style={{ height: 2, background: 'var(--il-line)', overflow: 'hidden' }}>
        {pct != null
          ? <div style={{ height: '100%', width: `${pct}%`, background: 'var(--il-ember)', transition: 'width calc(.25s * var(--il-motion, 1)) linear' }} />
          : <div className="il-sweep" style={{ height: '100%', width: '30%', background: 'var(--il-ember)' }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <div role="status" aria-live="polite"
          style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, maxWidth: 'min(520px, 90%)', padding: '0 4px 0 12px', borderRadius: 999,
            background: 'var(--il-panel)', boxShadow: 'var(--il-shadow-md, 0 4px 16px rgba(0,0,0,.4)), inset 0 0 0 1px var(--il-ember-line, var(--il-line-strong))', fontSize: 12, fontWeight: 700, color: 'var(--il-fg)' }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--il-ember)', flex: 'none' }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>{text}</span>
          <button type="button" onClick={stop ?? undefined} aria-label="Stop this prompt" title="Stop this prompt"
            style={{ width: 24, height: 24, flex: 'none', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
            <IconX size={13} stroke={2.6} />
          </button>
        </div>
      </div>
    </div>
  );
}
