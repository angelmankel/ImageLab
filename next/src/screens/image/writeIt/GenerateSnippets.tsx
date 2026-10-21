/**
 * Item 47 (AI part): "✦ Generate snippets" for a category. The LLM (`aiChat`, the one AI helper)
 * writes N new snippets (name + prompt text) for the category, guided by an optional hint; they
 * show as a list to check / edit; "Save N" adds the checked ones to the library (Ctrl+Z undoes it).
 * Anyone opens it with `openGenerateSnippets(categoryId)`; `<GenerateSnippetsHost />` is mounted
 * once (PromptTab) and renders the window.
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Modal } from '@mantine/core';
import { IconCheck, IconRefresh, IconSparkles, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { aiChat, aiNotReadyHint, aiReady } from '@/lib/ai';
import { useIsPhone } from '~/app/useIsPhone';
import { addSnippets } from '../snippets/snippetOps';
import { Button, Skeleton, Spinner, Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { dvh } from '~/theme/uiScale';
import { parseSnippetIdeas, snippetGenSystem, snippetGenUser, type SnippetIdea } from './studioLogic';

const useSnippetGen = create<{ categoryId: string | null }>(() => ({ categoryId: null }));

/** Open the "Generate snippets" window for a category (the category menu / manage view). */
export function openGenerateSnippets(categoryId: string): void {
  useSnippetGen.setState({ categoryId });
}

export function GenerateSnippetsHost() {
  const categoryId = useSnippetGen((s) => s.categoryId);
  return <GenerateSnippetsModal categoryId={categoryId} onClose={() => useSnippetGen.setState({ categoryId: null })} />;
}

interface Row extends SnippetIdea { key: string; keep: boolean }

const COUNTS = ['4', '8', '12'] as const;
const field: React.CSSProperties = { width: '100%', border: '1px solid var(--il-line-soft)', borderRadius: 10, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

export function GenerateSnippetsModal({ categoryId, onClose }: { categoryId: string | null; onClose: () => void }) {
  const phone = useIsPhone();
  const ai = useStore((s) => s.ai);
  const cats = useStore((s) => s.snippetCategories);
  const snippets = useStore((s) => s.snippets);
  const cat = cats.find((c) => c.id === categoryId);
  const catName = cat?.name.replace(/^negative\s*[·:\-–—]\s*/i, '') ?? 'Uncategorized';
  const negative = !!categoryId?.startsWith('neg-');
  const [hint, setHint] = useState('');
  const [count, setCount] = useState<(typeof COUNTS)[number]>('8');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const opened = categoryId !== null;

  useEffect(() => {
    if (!opened) { abort.current?.abort(); setBusy(false); setRows([]); setError(null); setHint(''); }
  }, [opened]);

  const ready = aiReady(ai);
  const existing = snippets.filter((s) => s.categoryId === categoryId).map((s) => s.name);

  const write = async (append: boolean) => {
    if (!ready || busy || !categoryId) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true); setError(null);
    try {
      const avoid = [...existing, ...(append ? rows.map((r) => r.name) : [])];
      const raw = await aiChat({
        settings: ai, signal: ctrl.signal, temperature: 0.95, maxTokens: 120 * Number(count) + 200,
        messages: [
          { role: 'system', content: snippetGenSystem(ai.promptStyle) },
          { role: 'user', content: snippetGenUser({ category: `${catName}${negative ? ' (negative prompt: things to keep out of the image)' : ''}`, count: Number(count), hint, existing: avoid }) },
        ],
      });
      if (ctrl.signal.aborted) return;
      const found = parseSnippetIdeas(raw, avoid).slice(0, Number(count));
      if (!found.length) { setError('The AI returned nothing usable — try again or change the hint.'); return; }
      const fresh = found.map((f, i) => ({ ...f, key: `${Date.now()}-${i}`, keep: true }));
      setRows((r) => (append ? [...r, ...fresh] : fresh));
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Generation failed');
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  };

  const kept = rows.filter((r) => r.keep && r.text.trim());
  const save = () => {
    if (!categoryId || !kept.length) return;
    addSnippets(kept.map((r) => ({ name: r.name, text: r.text, kind: negative ? 'negative' : 'positive', categoryId })));
    onClose();
  };
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const size = phone ? 'lg' : 'md';
  const h = phone ? 44 : 36;
  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={680} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }}
      styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)' }, body: { height: phone ? '100%' : undefined } }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: phone ? dvh(100) : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: phone ? '12px 14px' : '14px 18px', borderBottom: '1px solid var(--il-line-soft)' }}>
          <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', flex: 'none' }}><IconSparkles size={17} stroke={2.2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Generate snippets · {cat?.icon ? `${cat.icon} ` : ''}{catName}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>The AI writes new tiles for this category. Keep the ones you like.</div>
          </div>
          <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconX size={16} stroke={2.4} />} tooltip="Close" onClick={onClose} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: phone ? '12px 14px' : '14px 18px', flex: phone ? 1 : undefined, overflowY: phone ? 'auto' : undefined, touchAction: 'pan-y' }} className={phone ? 'il-scroll' : undefined}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: phone ? 'wrap' : 'nowrap' }}>
            <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Hint (optional): moody, for night scenes…" aria-label="Hint for the AI" autoFocus={!phone}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void write(false); } }}
              style={{ ...field, flex: 1, minWidth: phone ? '100%' : 0, height: h, padding: '0 12px', fontSize: 13 }} />
            <div style={{ width: phone ? 150 : 140, flex: 'none' }}>
              <Tabs items={COUNTS.map((c) => ({ key: c, label: c }))} value={count} onChange={setCount} />
            </div>
            <Button tone="primary" size={size} disabled={!ready || busy} onClick={() => void write(false)} style={{ flex: phone ? 1 : 'none' }}
              icon={busy ? <Spinner size={12} color="var(--il-bg)" /> : <IconSparkles size={15} stroke={2.2} />}>{busy ? 'Writing…' : rows.length ? 'Write new' : 'Write'}</Button>
          </div>
          {!ready && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-warn)' }}>{aiNotReadyHint(ai)} to write snippets.</div>}
          {error && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-err)' }}>{error}</div>}

          {!rows.length && !busy && ready && (
            <div style={{ border: '1px dashed var(--il-line-strong)', borderRadius: 14, padding: '22px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--il-dim)' }}>
              {existing.length ? `${existing.length} in ${catName} already — the AI writes different ones.` : `Nothing in ${catName} yet — a good place to start.`}
            </div>
          )}
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 14, background: 'var(--il-card)', opacity: r.keep ? 1 : 0.55 }}>
              <button type="button" aria-pressed={r.keep} aria-label={r.keep ? `Skip ${r.name}` : `Keep ${r.name}`} onClick={() => patch(r.key, { keep: !r.keep })}
                style={{ width: phone ? 40 : 30, height: phone ? 40 : 30, flex: 'none', borderRadius: 9, border: r.keep ? 0 : '1px solid var(--il-line-strong)', background: r.keep ? 'var(--il-ember)' : 'transparent', color: 'var(--il-bg)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                {r.keep && <IconCheck size={16} stroke={3} />}
              </button>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} aria-label="Name"
                  style={{ ...field, border: 0, background: 'transparent', padding: '2px 0', fontSize: 13, fontWeight: 800 }} />
                <input value={r.text} onChange={(e) => patch(r.key, { text: e.target.value })} aria-label="What it puts in the prompt"
                  style={{ ...field, height: phone ? 40 : 32, padding: '0 10px', fontSize: 12, color: 'var(--il-fg2)' }} />
              </div>
            </div>
          ))}
          {busy && <Skeleton h={56} radius={14} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: phone ? '10px 14px calc(14px + var(--il-safe-bottom, 0px))' : '12px 18px 16px', borderTop: rows.length ? '1px solid var(--il-line-soft)' : 0 }}>
          {rows.length > 0 && <Button tone="card" size={size} disabled={busy || !ready} icon={<IconRefresh size={14} stroke={2.4} />} onClick={() => void write(true)} tooltip="Add more ideas">More</Button>}
          <div style={{ flex: 1 }} />
          <Button tone="card" size={size} onClick={onClose}>Cancel</Button>
          <Button tone="primary" size={size} disabled={!kept.length} onClick={save}>{kept.length ? `Save ${kept.length}` : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}
