/**
 * Rule 6 + items 12 / 13: the Prompt tab. The prompt card (one smart box; Prompt / Negative tabs;
 * ✦ Write it · Starters · clear), then — positive — the ONE grid of style + snippet tiles, or —
 * negative — the simple category + snippet pills. Tiles and pills write their text INTO the
 * prompt (no separate parts list). The text binds to the main store's prompt layers
 * (`usePromptText`); older stacks of layers are folded into that one text (`foldLayers`, same
 * string the job compiled before), so the job still gets exactly what the box shows.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { aiReady } from '@/lib/ai';
import type { Snippet } from '@/lib/types';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { Button } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { usePromptText } from './usePromptText';
import { WriteItModal } from './WriteItModal';
import { LibraryModal } from './LibraryModal';
import { PromptCard } from './prompt/PromptCard';
import { TileGrid } from './prompt/TileGrid';
import { NegativePills } from './prompt/NegativePills';
import { useTiles } from './prompt/useTiles';
import { useTileEdit } from './prompt/tileStore';
import { appendPiece, applyEdit, foldLayers, partsBySnippet, promptParts, removeRange, snippetTextFor } from './prompt/promptSections';
import { typedText } from './prompt/SmartPromptBox';

type Text = ReturnType<typeof usePromptText>;

/** Keep the store at one text per kind while the tab is open (other screens may add layers). */
function useFoldedLayers(pos: Text, neg: Text) {
  const layers = useStore((s) => s.layers);
  useEffect(() => {
    if (!foldLayers(layers)) return;
    pos.flush(); neg.flush();
    const st = useStore.getState();
    const f = foldLayers(st.layers);
    if (f) st.setPromptLayers(f);
  }, [layers]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function PromptTab({ large = false }: { large?: boolean }) {
  const phone = useIsPhone();
  const pos = usePromptText('positive');
  const neg = usePromptText('negative');
  useFoldedLayers(pos, neg);
  const ai = useStore((s) => s.ai);
  const tiles = useTiles();
  const negative = useTileEdit((s) => s.negative);
  const setNegative = useTileEdit((s) => s.setNegative);
  const [writing, setWriting] = useState(false);
  const [starters, setStarters] = useState(false);

  const posParts = useMemo(() => promptParts(pos.text, tiles.positive, 'positive'), [pos.text, tiles.positive]);
  const negParts = useMemo(() => promptParts(neg.text, tiles.negative, 'negative'), [neg.text, tiles.negative]);
  const posOn = useMemo(() => partsBySnippet(posParts), [posParts]);
  const negOn = useMemo(() => partsBySnippet(negParts), [negParts]);
  const typed = useMemo(() => typedText(pos.text, posParts), [pos.text, posParts]);

  const put = (t: Text, next: string) => { t.set(next); t.flush(); };
  /** A tile / pill tap: its text goes in (each kind it has) or comes out. */
  const toggle = (s: Snippet) => {
    useWorkspace.getState().touchSnippet(s.id);
    const p = posOn.get(s.id);
    const n = negOn.get(s.id);
    if (p || n) {
      if (p) put(pos, applyEdit(pos.text, removeRange(pos.text, p.start, p.end)));
      if (n) put(neg, applyEdit(neg.text, removeRange(neg.text, n.start, n.end)));
      return;
    }
    const pt = snippetTextFor(s, 'positive');
    const nt = snippetTextFor(s, 'negative');
    if (pt) put(pos, applyEdit(pos.text, appendPiece(pos.text, pt)));
    if (nt) put(neg, applyEdit(neg.text, appendPiece(neg.text, nt)));
  };

  const size = phone ? 'lg' : 'sm';
  return (
    <>
      <PromptCard
        positive={{ value: pos.text, onChange: pos.set, onBlur: pos.flush }}
        negative={{ value: neg.text, onChange: neg.set, onBlur: neg.flush }}
        negativeMode={negative}
        onMode={setNegative}
        tiles={tiles}
        large={large}
        onClear={(isNeg) => (isNeg ? neg.clear() : pos.clear())}
        onSaveAsSnippet={(text) => useTileEdit.getState().edit('new', text)}
        tools={<>
          <Button tone="card" size={size} style={{ color: 'var(--il-ember-hi)' }} onClick={() => { pos.flush(); setWriting(true); }}
            tooltip={aiReady(ai) ? 'Let the AI write the prompt' : 'Set up the AI helper in Settings to write prompts'}>✦ Write it</Button>
          <Button tone="card" size={size} onClick={() => { pos.flush(); setStarters(true); }} tooltip="Start from a picture someone made">Starters</Button>
        </>}
      />
      {negative
        ? <NegativePills tiles={tiles} on={negOn} onToggle={toggle} />
        : <TileGrid tiles={tiles} on={posOn} typed={typed} onToggle={toggle} />}
      <WriteItModal opened={writing} onClose={() => setWriting(false)} />
      <LibraryModal opened={starters} onClose={() => setStarters(false)} />
    </>
  );
}
