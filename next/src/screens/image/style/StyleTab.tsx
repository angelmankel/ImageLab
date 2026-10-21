/**
 * The Style tab (the step panel's last tab: Prompt · Composition · Model · Parameters · Style;
 * plan agent-handoffs/style-tab-plan.md, mockup fixlist2-mockups/style-tab.html).
 *
 * Donny: "click to add the stuff i want and everything just works". So: the servers strip on top
 * (quiet when all is well), the references as bubbles, and either the type tiles (Add, or no
 * references yet) or the selected reference's card. A tile adds a working reference with the node
 * packs' own defaults; the files (adapter, CLIP vision, FaceID LoRA, InstantID ControlNet) are
 * picked from the model type and the server at queue time. Types the model type cannot use are
 * not shown; types no server can run are shown dimmed with the one thing missing.
 *
 * The references live on the Image step's workflow (`workflow.styleRefs`), so undo, sessions,
 * the history snapshot (metadata) and the step fingerprint (stale ✓ / ↻) all carry them.
 */
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { FACE_METHODS, faceMethodsFor, refMissing, typeFits, methodOf, type StyleRef, type StyleRefType } from '@/lib/styleRefs';
import { setWorkflowUndoable } from '~/app/undoableWorkflow';
import { T } from '~/theme/tokens';
import { useStyleServers } from './useStyleServers';
import { ServerStrip } from './ServerStrip';
import { TypeTiles } from './TypeTiles';
import { RefBubbles, refLabel } from './RefBubbles';
import { RefCard } from './RefCard';
import { addRef, moveRef, removeRef } from './styleRefsEdit';
import { tileStates } from './styleTabLogic';

const NONE: StyleRef[] = [];
const uid = () => `sr-${Math.random().toString(36).slice(2, 9)}`;

export function StyleTab() {
  const { fam, typeName, rows } = useStyleServers();
  const refs = useStore((s) => s.workflow.styleRefs) ?? NONE;
  const cfg = useStore((s) => s.workflow.cfg);
  const infos = useStore((s) => s.serverInfo);
  const servers = useStore((s) => s.servers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const tiles = useMemo(() => tileStates(rows, fam), [rows, fam]);

  const unfit = (r: StyleRef) => !typeFits(r.type, fam) || (r.type === 'face' && !faceMethodsFor(fam).includes(methodOf(r)!));
  const selected = refs.find((r) => r.id === selectedId) ?? refs[refs.length - 1] ?? null;
  const showTiles = adding || !refs.length;

  const add = (type: StyleRefType) => {
    // Face: start on the first method some online server runs (FaceID v2 when it can).
    let method: StyleRef['method'];
    if (type === 'face') {
      const online = servers.filter((s) => s.enabled !== false && infos[s.id]);
      method = FACE_METHODS.filter((m) => faceMethodsFor(fam).includes(m))
        .find((m) => online.some((s) => !refMissing({ type, method: m }, fam, infos[s.id]?.style, { loras: infos[s.id]?.loras, controlnets: infos[s.id]?.controlnets }).length));
    }
    const out = addRef(refs, uid(), type, fam, cfg, method);
    setWorkflowUndoable({ styleRefs: out.refs, ...(out.cfg != null ? { cfg: out.cfg } : {}) }, `Add ${refLabel(out.refs[out.refs.length - 1])} reference`);
    setSelectedId(out.id);
    setAdding(false);
  };

  const remove = (id: string) => {
    const r = refs.find((x) => x.id === id);
    setWorkflowUndoable({ styleRefs: removeRef(refs, id) }, `Remove ${r ? refLabel(r) : ''} reference`.replace('  ', ' '));
    if (selectedId === id) setSelectedId(null);
  };

  if (!fam) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ border: '1px dashed var(--il-line-strong)', borderRadius: T.radius.lg, padding: '18px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>No style references for {typeName || 'this model'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>They work with SD 1.5, SDXL, Pony, Illustrious, NoobAI and Flux models.</span>
        </div>
        {refs.length > 0 && (
          <RefBubbles refs={refs} selectedId={null} onSelect={() => {}} onRemove={remove} onAdd={() => {}} adding={false} unfit={() => true} />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ServerStrip rows={rows} typeName={typeName} fam={fam} />
      {refs.length > 0 && (
        <RefBubbles refs={refs} selectedId={selected?.id ?? null} adding={adding} unfit={unfit}
          onSelect={(id) => { setSelectedId(id); setAdding(false); }} onRemove={remove} onAdd={() => setAdding((a) => !a)}
          onMove={(id, to) => setWorkflowUndoable({ styleRefs: moveRef(refs, id, to) }, 'Reorder references')} />
      )}
      {showTiles
        ? <TypeTiles tiles={tiles} onPick={add} onClose={refs.length ? () => setAdding(false) : undefined} />
        : selected && (unfit(selected)
          ? <div style={{ border: '1px dashed var(--il-line-strong)', borderRadius: T.radius.lg, padding: '14px 12px', fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', textAlign: 'center' }}>
              {refLabel(selected)} is not used with {typeName} models. It comes back when you switch to a model it fits.
            </div>
          : <RefCard key={selected.id} r={selected} refs={refs} fam={fam} />)}
    </div>
  );
}
