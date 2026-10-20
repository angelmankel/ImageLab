/**
 * Rule 6: snippet chips under the prompt, tap to add, tap again to take out. The ones in the prompt
 * first, then the ones used lately, then the rest (`chipOrder`, the main app's rule); "+ more"
 * opens the whole snippet library. Logic from the main store (insert / remove as a layer).
 */
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { LayerKind, Snippet } from '@/lib/types';
import { chipOrder } from '@/lib/workspace';
import { applyPromptPreset } from '@/lib/promptPresets';
import { uid } from '@/lib/storage';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { SnippetsModal } from '@/features/layers/SnippetsModal';
import { Chip } from '~/ui';

const MAX = 16;

export function SnippetRow({ kind }: { kind: LayerKind }) {
  const snippets = useStore((s) => s.snippets);
  const layers = useStore((s) => s.layers);
  const recents = useWorkspace((s) => s.recentSnippetIds);
  const touch = useWorkspace((s) => s.touchSnippet);
  const [all, setAll] = useState(false);

  const inPrompt = useMemo(() => new Set(layers.map((l) => l.originSnippetId).filter((x): x is string => !!x)), [layers]);
  const ordered = useMemo(() => chipOrder(snippets.filter((s) => s.kind === kind || s.layers?.some((l) => l.kind === kind)), inPrompt, recents).slice(0, MAX), [snippets, kind, inPrompt, recents]);

  const toggle = (s: Snippet) => {
    const st = useStore.getState();
    touch(s.id);
    if (s.layers) { st.setPromptLayers(applyPromptPreset(st.layers, s, 'insert', uid)); return; }
    if (inPrompt.has(s.id)) st.removeLayersFromSnippet(s.id); else st.insertSnippetAsLayer(s.id);
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', margin: '4px 2px 8px' }}>{kind === 'negative' ? 'Negative snippets' : 'Snippets'} · tap to add</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ordered.map((s) => <Chip key={s.id} on={inPrompt.has(s.id)} onClick={() => toggle(s)} title={s.layers ? s.layers.map((l) => l.text).join(' · ') : s.text} small>{s.name}</Chip>)}
        <button type="button" onClick={() => setAll(true)} style={{ height: 26, padding: '0 11px', border: '1px dashed #3A3A44', borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ more</button>
      </div>
      <SnippetsModal opened={all} onClose={() => setAll(false)} kind={kind} />
    </div>
  );
}
