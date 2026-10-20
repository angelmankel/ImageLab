/**
 * Rule 6: snippet chips under the prompt. Chips never move: one category at a time, in the
 * library's own order, a tap only lights a chip (on = in the prompt). On top, the ones in the
 * prompt as a one-line strip with ×; a row of category tabs (remembered per kind) and "+ New"
 * (an inline form); the chip area is two rows high and "Browse all →" opens the browser.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconArrowRight, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { LayerKind } from '@/lib/types';
import { Chip, Tabs } from '~/ui';
import { categoriesWith, inCategory, inPromptSnippets, ofKind, pickTab, previewText } from './snippets/snippetLogic';
import { addAndInsert, removeFromPrompt, toggleSnippet, useInPrompt } from './snippets/snippetActions';
import { useSnippetsUi } from './snippets/snippetsStore';
import { SnippetForm } from './snippets/SnippetForm';
import { SnippetsBrowser } from './snippets/SnippetsBrowser';

const CHIP = 26;
const GAP = 6;
const ROWS = 2;
const AREA_H = ROWS * CHIP + (ROWS - 1) * GAP;

export function SnippetRow({ kind }: { kind: LayerKind }) {
  const snippets = useStore((s) => s.snippets);
  const categories = useStore((s) => s.snippetCategories);
  const layers = useStore((s) => s.layers);
  const inPrompt = useInPrompt();
  const saved = useSnippetsUi((s) => s.tab[kind]);
  const setTab = useSnippetsUi((s) => s.setTab);
  const [adding, setAdding] = useState(false);
  const [browsing, setBrowsing] = useState(false);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 2px 8px', minHeight: 22 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>{kind === 'negative' ? 'Negative snippets' : 'Snippets'}</span>
        {active.length > 0 && (
          <>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)', flex: 'none', marginLeft: 'auto' }}>In prompt:</span>
            <div className="il-scroll-x" data-no-swipe style={{ display: 'flex', gap: 4, minWidth: 0, touchAction: 'pan-x pan-y' }}>
              {active.map((s) => (
                <button key={s.id} type="button" onClick={() => removeFromPrompt(s.id)} title={`Take "${s.name}" out of the prompt`} aria-label={`Remove ${s.name}`}
                  style={{ height: 22, padding: '0 6px 0 9px', border: '1px solid var(--il-ember-line)', borderRadius: 999, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none' }}>
                  {s.name}<IconX size={11} stroke={2.8} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="il-scroll-x" data-no-swipe style={{ flex: 1, minWidth: 0, touchAction: 'pan-x pan-y' }}>
          {cats.length > 0 && (
            <Tabs items={cats.map((c) => ({ key: c.id, label: c.icon ? `${c.icon} ${c.name}` : c.name }))} value={tab} onChange={(id) => setTab(kind, id)} compact fill={false} />
          )}
        </div>
        <Chip small dashed on={adding} onClick={() => setAdding((v) => !v)} style={{ flex: 'none' }}>+ New</Chip>
      </div>

      {adding && (
        <div style={{ marginTop: 8 }}>
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
        <div ref={areaRef} style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: GAP, maxHeight: AREA_H, overflow: 'hidden', marginTop: 8 }}>
          {chips.map((s) => <Chip key={s.id} small on={inPrompt.has(s.id)} onClick={() => toggleSnippet(s, inPrompt.has(s.id))} title={previewText(s)}>{s.name}</Chip>)}
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--il-dim)', padding: '4px 2px' }}>No {kind === 'negative' ? 'negative ' : ''}snippets yet — tap + New.</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 6, marginRight: 2 }}>
        {hidden > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)' }}>+{hidden} more</span>}
        <button type="button" onClick={() => setBrowsing(true)} style={{ height: 22, padding: 0, border: 0, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          Browse all <IconArrowRight size={12} stroke={2.6} />
        </button>
      </div>

      <SnippetsBrowser opened={browsing} onClose={() => setBrowsing(false)} kind={kind} />
    </div>
  );
}
