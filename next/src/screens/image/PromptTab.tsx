/**
 * Items 6 + 43 + 7: the prompt section is PINNED (sticky) at the top of the panel's one scroll and
 * can fold to a one-line preview; the tile grid flows under it with no scroll of its own, so a
 * tapped tile shows up in the pinned prompt at once. The box itself is capped (`SmartPromptBox`).
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
import { Button, Chip, CollapseHeader, useSectionOpen } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { usePromptText } from './usePromptText';
import { WriteItModal } from './WriteItModal';
import { GenerateSnippetsHost } from './writeIt/GenerateSnippets';
import { WriteItBadge } from './writeIt/WriteItBadge';
import { StartersModal } from './starters/StartersModal';
import { PromptCard } from './prompt/PromptCard';
import { TileGrid } from './prompt/TileGrid';
import { NegativePills } from './prompt/NegativePills';
import { useTiles } from './prompt/useTiles';
import { useTileEdit, useTileUi } from './prompt/tileStore';
import { SnippetHost } from './snippets/SnippetHost';
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

  const [promptOpen, setPromptOpen] = useSectionOpen('prompt.box');
  const [gridOpen, setGridOpen] = useSectionOpen('prompt.snippets');
  const promptFolded = !promptOpen;
  const gridFolded = !gridOpen;
  const onOnly = useTileUi((s) => s.onOnly);
  const setOnOnly = useTileUi((s) => s.setOnOnly);
  const onCount = negative ? negOn.size : posOn.size;
  const preview = (negative ? neg.text : pos.text).replace(/\s+/g, ' ').trim();

  const size = phone ? 'lg' : 'sm';
  return (
    <>
      <div data-no-swipe style={{
        // Sticky insets count from the scroll container's padding edge: the desktop panel body has 10px
        // of top padding, so -10 puts this block flush under the tabs (no see-through gap). The phone
        // page (CreatePage) has none.
        position: 'sticky', top: phone ? 'env(safe-area-inset-top, 0px)' : -10, zIndex: 6, margin: '-10px -10px 0', padding: '6px 10px 8px',
        background: 'var(--il-panel)', boxShadow: '0 1px 0 var(--il-line-soft), 0 12px 14px -14px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <CollapseHeader open={promptOpen} onToggle={() => setPromptOpen(!promptOpen)}
          label={negative ? 'Negative' : 'Prompt'} tone={negative ? 'color-mix(in srgb, var(--il-err) 75%, white)' : undefined}
          extra={promptFolded ? (
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: preview ? 'var(--il-fg2)' : 'var(--il-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {preview || 'Empty — tap to write'}
            </span>
          ) : undefined} />
        {!promptFolded && <PromptCard
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
            tooltip={aiReady(ai) ? 'Let the AI write the prompt' : 'Set up AI in Settings'}>✦ Write it<WriteItBadge /></Button>
          <Button tone="card" size={size} onClick={() => { pos.flush(); setStarters(true); }} tooltip="Start from a picture">Starters</Button>
        </>}
      />}
      </div>
      <CollapseHeader open={gridOpen} onToggle={() => setGridOpen(!gridOpen)} label={negative ? 'Negative snippets' : 'Styles & snippets'}
        right={!gridFolded && !negative ? (
          <Chip small={!phone} tall={phone} on={onOnly} onClick={() => setOnOnly(!onOnly)} title="Only on">
            On only{onCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '0 6px', borderRadius: 999, background: onOnly ? 'rgba(0,0,0,.2)' : 'var(--il-ember-soft)', color: onOnly ? 'inherit' : 'var(--il-ember-hi)' }}>{onCount}</span>}
          </Chip>
        ) : gridFolded && onCount > 0 ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--il-ember-hi)', paddingRight: 4 }}>{onCount} on</span> : undefined} />
      {!gridFolded && (negative
        ? <NegativePills tiles={tiles} on={negOn} onToggle={toggle} />
        : <TileGrid tiles={tiles} on={posOn} typed={typed} onToggle={toggle} flow onlyOn={onOnly} />)}
      <WriteItModal opened={writing} onClose={() => setWriting(false)} />
      <GenerateSnippetsHost />
      <StartersModal opened={starters} onClose={() => setStarters(false)} />
      <SnippetHost />
    </>
  );
}
