/**
 * Rule 6: snippet chips under the prompt. Chips never move: one category at a time, in the
 * library's own order, a tap only lights a chip (on = in the prompt). Header: the name, then
 * "Browse all" (with how many did not fit) and a + for the inline new-snippet form. Under it the
 * ones in the prompt as a one-line strip with ×, then the category pills (plain text, the active
 * one filled like the history filters; a negative category drops its "Negative ·" prefix), then
 * the chip area, two rows high.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { LayerKind } from '@/lib/types';
import { Chip, useWheelSideways } from '~/ui';
import { categoriesWith, inCategory, inPromptSnippets, ofKind, pickTab, previewText } from './snippets/snippetLogic';
import { addAndInsert, removeFromPrompt, toggleSnippet, useInPrompt } from './snippets/snippetActions';
import { useSnippetsUi } from './snippets/snippetsStore';
import { SnippetForm } from './snippets/SnippetForm';
import { SnippetsBrowser } from './snippets/SnippetsBrowser';

const CHIP = 26;
const GAP = 6;
const ROWS = 2;
const AREA_H = ROWS * CHIP + (ROWS - 1) * GAP;

/** "Negative · Quality" → "Quality" under Negative snippets: the heading already says it. */
const catLabel = (name: string, kind: LayerKind) => (kind === 'negative' ? name.replace(/^negative\s*[·:\-–—]\s*/i, '') : name);

export function SnippetRow({ kind }: { kind: LayerKind }) {
  const snippets = useStore((s) => s.snippets);
  const categories = useStore((s) => s.snippetCategories);
  const layers = useStore((s) => s.layers);
  const inPrompt = useInPrompt();
  const saved = useSnippetsUi((s) => s.tab[kind]);
  const setTab = useSnippetsUi((s) => s.setTab);
  const [adding, setAdding] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const wheelRef = useWheelSideways<HTMLDivElement>();

  const mine = useMemo(() => ofKind(snippets, kind), [snippets, kind]);
  const cats = useMemo(() => categoriesWith(categories, mine), [categories, mine]);
  const tab = pickTab(saved, cats);
  const chips = useMemo(() => inCategory(mine, categories, tab), [mine, categories, tab]);
  const active = useMemo(() => inPromptSnippets(mine, layers), [mine, layers]);

  // How many chips fell past the second row (the "+N more" hint).
  const areaRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(0);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const count = () => setHidden(Array.from(el.children).filter((c) => (c as HTMLElement).offsetTop >= ROWS * (CHIP + GAP)).length);
    count();
    const ro = new ResizeObserver(count);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chips]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 2px 8px', minHeight: 26 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', flex: 1 }}>{kind === 'negative' ? 'Negative snippets' : 'Snippets'}</span>
        <button type="button" onClick={() => setBrowsing(true)} style={{ height: 26, padding: '0 4px', border: 0, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 800, cursor: 'pointer', flex: 'none' }}>
          Browse all{hidden > 0 ? ` · ${hidden} more` : ''}
        </button>
        <button type="button" onClick={() => setAdding((v) => !v)} aria-pressed={adding} aria-label="New snippet" title="New snippet"
          style={{ width: 26, height: 26, border: 0, borderRadius: '50%', background: adding ? 'var(--il-ember-soft)' : 'var(--il-card-on)', color: adding ? 'var(--il-ember-hi)' : 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
          <IconPlus size={14} stroke={2.6} />
        </button>
      </div>

      {active.length > 0 && (
        <div className="il-scroll-x" data-no-swipe style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, touchAction: 'pan-x pan-y' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)', flex: 'none', marginRight: 2 }}>In prompt</span>
          {active.map((s) => (
            <button key={s.id} type="button" onClick={() => removeFromPrompt(s.id)} title={`Take "${s.name}" out of the prompt`} aria-label={`Remove ${s.name}`}
              style={{ height: 22, padding: '0 6px 0 9px', border: '1px solid var(--il-ember-line)', borderRadius: 999, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none' }}>
              {s.name}<IconX size={11} stroke={2.8} />
            </button>
          ))}
        </div>
      )}

      {cats.length > 1 && (
        <div ref={wheelRef} role="tablist" aria-label="Snippet categories" className="il-scroll-x" data-no-swipe style={{ display: 'flex', gap: 4, touchAction: 'pan-x pan-y', marginBottom: 8 }}>
          {cats.map((c) => {
            const on = c.id === tab;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(kind, c.id)}
                style={{ height: 26, padding: '0 10px', border: 0, borderRadius: 999, background: on ? 'var(--il-fg)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-muted)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none' }}>
                {catLabel(c.name, kind)}
              </button>
            );
          })}
        </div>
      )}

      {adding && (
        <div style={{ marginBottom: 8 }}>
          <SnippetForm
            categories={categories}
            defaultCategory={categories.some((c) => c.id === tab) ? tab : (categories[0]?.id ?? 'uncategorized')}
            onCancel={() => setAdding(false)}
            onSave={(v) => { addAndInsert({ ...v, kind }); setTab(kind, v.categoryId); setAdding(false); }}
            saveLabel="Save & add"
          />
        </div>
      )}

      {chips.length > 0 ? (
        <div ref={areaRef} style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: GAP, maxHeight: AREA_H, overflow: 'hidden' }}>
          {chips.map((s) => <Chip key={s.id} small on={inPrompt.has(s.id)} onClick={() => toggleSnippet(s, inPrompt.has(s.id))} title={previewText(s)}>{s.name}</Chip>)}
        </div>
      ) : (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-dim)', padding: '4px 2px' }}>No {kind === 'negative' ? 'negative ' : ''}snippets yet — tap +.</div>
      )}

      <SnippetsBrowser opened={browsing} onClose={() => setBrowsing(false)} kind={kind} />
    </div>
  );
}
