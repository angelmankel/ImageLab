/**
 * Rule 6 + items 12 / 13: the Prompt tab. The prompt card (one smart box; Prompt / Negative tabs;
 * ✦ Write it · Starters · clear), then — positive — the ONE grid of style + snippet tiles, or —
 * negative — the simple category + snippet pills. Tiles and pills write their text INTO the
 * prompt (no separate parts list). The text binds to the main store's prompt layers
 * (`usePromptText`); older stacks of layers are folded into that one text (`foldLayers`, same
 * string the job compiled before), so the job still gets exactly what the box shows.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { aiReady } from '@/lib/ai';
import { Button } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { usePromptText } from './usePromptText';
import { WriteItModal } from './WriteItModal';
import { StartersModal } from './starters/StartersModal';
import { PromptCard } from './prompt/PromptCard';
import { TileGrid } from './prompt/TileGrid';
import { NegativePills } from './prompt/NegativePills';
import { useTiles } from './prompt/useTiles';
import { useTileEdit } from './prompt/tileStore';
import { foldLayers } from './prompt/promptSections';
import { usePromptTiles } from './prompt/usePromptTiles';

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

  const put = (t: Text) => (next: string) => { t.set(next); t.flush(); };
  const { posOn, negOn, typed, toggle } = usePromptTiles({ text: pos.text, put: put(pos) }, { text: neg.text, put: put(neg) });

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
      <StartersModal opened={starters} onClose={() => setStarters(false)} />
    </>
  );
}
