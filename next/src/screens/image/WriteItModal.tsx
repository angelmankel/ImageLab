/**
 * Item 37: "✦ Write it" is a PROMPT DESIGN STUDIO. A wide two-column modal on desktop (the modal
 * never scrolls; each column scrolls on its own), one full-screen page on a phone.
 *   Left = compose: From an idea / Rework my prompt; the idea box (example chips, Surprise me, "/"
 *   picks a snippet); ingredients = style + snippet tiles the AI weaves in (not pasted raw); style
 *   and length quick picks; how many options (1 / 2 / 3); Write.
 *   Right = Results (option cards: Use this · Again · tweaks · Back) · Recent writes · AI settings
 *   (model, system prompt presets, Creativity, more parameters).
 * "Use this" replaces the positive prompt (Ctrl+Z undoes it) and closes. The negative stays.
 * Every call goes through `aiChat` (the one AI helper); the pure parts are `writeIt/studioLogic`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@mantine/core';
import { IconDice5, IconPlus, IconRefresh, IconSparkles, IconTrash, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { aiNotReadyHint, aiReady } from '@/lib/ai';
import { activeEntry } from '@/lib/aiProviders';
import { paramBody } from '@/lib/aiParams';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import type { Snippet } from '@/lib/types';
import { useIsPhone } from '~/app/useIsPhone';
import { pushUndo } from '~/app/undo';
import { formatWhen } from '~/lib/time';
import { Button, Chip, Spinner, Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { dvh, vw } from '~/theme/uiScale';
import { useTiles } from './prompt/useTiles';
import { tileBackground, tileHue } from './prompt/promptSearch';
import { useWriteIt, type StudioTab } from './writeIt/writeItStore';
import { IngredientPicker, usePickerList } from './writeIt/IngredientPicker';
import { OptionCard } from './writeIt/OptionCard';
import { addOption, freshOptions, patchOption, runOption, sessionNow, setStudioOpen, useStudioOptions } from './writeIt/studioRuns';
import { useSessions } from '~/app/sessionsStore';
import { StudioSettings, activeSystem } from './writeIt/StudioSettings';
import {
  LENGTH_PICKS, STYLE_PICKS, exampleIdeas, studioUserMessage, surpriseIdea, tweakUserMessage, type StudioMode,
} from './writeIt/studioLogic';
import './writeIt/studio.css';

const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--il-muted)' };
const MAX_INGREDIENTS = 8;
const COUNTS = ['1', '2', '3'] as const;

/** "/word" right before the caret → the word (the picker's query); null when there is none. */
function slashAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(?:^|\s)\/([^\s/]*)$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1] };
}

export function WriteItModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const phone = useIsPhone();
  const ai = useStore((s) => s.ai);
  const current = useStore((s) => compileLayers(s.layers, 'positive'));
  const tiles = useTiles();
  const w = useWriteIt();

  const [mode, setMode] = useState<StudioMode>('idea');
  const [idea, setIdea] = useState('');
  const [ingredients, setIngredients] = useState<Snippet[]>([]);
  const sessionId = useSessions((s) => s.currentId) || 'app';
  const options = useStudioOptions(sessionId);
  const [examples, setExamples] = useState<string[]>(() => exampleIdeas(3));
  const [picker, setPicker] = useState<null | 'add' | 'slash'>(null);
  const [pickQuery, setPickQuery] = useState('');
  const [hl, setHl] = useState(0);
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const resultsTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Writes keep running when the studio closes (studioRuns); open = this session's badge clears.
    if (opened) { setExamples(exampleIdeas(phone ? 2 : 3)); setStudioOpen(sessionId); return; }
    setStudioOpen(null);
    setPicker(null);
  }, [opened, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = aiReady(ai);
  const provider = activeEntry(ai).id;
  const busy = options.some((o) => o.busy);
  const canRun = ready && !busy && (mode === 'idea' ? idea.trim().length > 0 : current.trim().length > 0);
  const picked = useMemo(() => new Set(ingredients.map((s) => s.id)), [ingredients]);
  const slashList = usePickerList(tiles.positive, picker === 'slash' ? pickQuery : '');

  // ---- the LLM calls (run in studioRuns, so closing the studio never loses them) ----------
  const runInto = (key: string, user: string) => {
    const p = paramBody(provider, useWriteIt.getState().params[provider] ?? {});
    void runOption(sessionNow(), key, {
      settings: ai, system: activeSystem(ai.promptStyle), user, extra: p.extra,
      temperature: p.temperature ?? (mode === 'idea' ? 0.95 : 0.75),
      maxTokens: p.maxTokens ?? 700,
      idea: mode === 'idea' ? idea.trim() : `Rework${idea.trim() ? `: ${idea.trim()}` : ''}`,
    });
  };

  const ask = (index: number, count: number, others: string[]) => studioUserMessage({
    mode, idea, current, style: w.style, length: w.length, index, count, others,
    ingredients: ingredients.map((s) => ({ name: s.name, text: s.layers ? s.layers.filter((l) => l.kind === 'positive').map((l) => l.text).join(', ') : s.text, category: tiles.categoryNames[s.categoryId] })),
  });

  const writeAll = () => {
    if (!canRun) return;
    const n = w.count;
    const keys = freshOptions(sessionNow(), n);
    useWriteIt.getState().setTab('results');
    keys.forEach((key, i) => runInto(key, ask(i, n, [])));
    if (phone) requestAnimationFrame(() => resultsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const again = (key: string) => {
    const i = options.findIndex((o) => o.key === key);
    const others = options.filter((o) => o.key !== key).map((o) => o.versions[o.versions.length - 1] ?? '').filter(Boolean);
    runInto(key, ask(Math.max(0, i), Math.max(options.length, 1), others));
  };

  const tweak = (key: string, instruction: string) => {
    const o = options.find((x) => x.key === key);
    const text = o?.versions[o.versions.length - 1];
    if (text) runInto(key, tweakUserMessage(text, instruction));
  };

  const use = (text: string) => {
    const st = useStore.getState();
    const before = st.layers;
    st.replaceLayers('positive', [{ tag: '', text }]);
    const after = useStore.getState().layers;
    pushUndo({ label: 'Write it', undo: () => useStore.getState().setPromptLayers(before), redo: () => useStore.getState().setPromptLayers(after) });
    onClose();
  };

  // ---- ingredients + the "/" picker ----------------------------------------------------
  const toggleIngredient = (s: Snippet) => {
    setIngredients((list) => (list.some((x) => x.id === s.id) ? list.filter((x) => x.id !== s.id) : list.length >= MAX_INGREDIENTS ? list : [...list, s]));
  };
  const pickFromSlash = (s: Snippet) => {
    if (slash) {
      const el = box.current;
      const caret = el?.selectionStart ?? idea.length;
      const next = (idea.slice(0, slash.start) + idea.slice(caret)).replace(/\s{2,}/g, ' ');
      setIdea(next);
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(slash.start, slash.start); });
    }
    if (!picked.has(s.id)) toggleIngredient(s);
    setPicker(null); setSlash(null);
  };
  const onIdea = (text: string, caret: number) => {
    setIdea(text);
    const s = slashAt(text, caret);
    setSlash(s);
    if (s) { setPicker('slash'); setPickQuery(s.query); setHl(0); } else if (picker === 'slash') setPicker(null);
  };
  const onIdeaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (picker === 'slash') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(slashList.length - 1, h + 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); setHl((h) => Math.min(slashList.length - 1, h + 1)); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && slashList[hl]) { e.preventDefault(); pickFromSlash(slashList[hl]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPicker(null); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); writeAll(); }
  };

  // ---- layout -------------------------------------------------------------------------------
  const pad = phone ? '12px 14px' : '16px 18px';
  const tab = w.tab;
  const tabs: Array<{ key: StudioTab; label: React.ReactNode }> = [
    { key: 'results', label: options.length ? `Results · ${options.length}` : 'Results' },
    { key: 'recent', label: w.recent.length ? `Recent · ${w.recent.length}` : 'Recent' },
    { key: 'settings', label: phone ? 'AI' : 'AI settings' },
  ];

  const ideaBox = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Tabs<StudioMode> items={[{ key: 'idea', label: 'From an idea' }, { key: 'rework', label: phone ? 'Rework' : 'Rework my prompt', title: current.trim() ? undefined : 'The prompt is empty' }]} value={mode} onChange={setMode} />
      {mode === 'rework' && (
        <div style={{ borderRadius: 14, background: 'var(--il-bg-deep)', padding: '10px 14px', fontSize: 12, lineHeight: 1.5, color: current.trim() ? 'var(--il-fg2)' : 'var(--il-dim)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <div style={{ ...eyebrow, marginBottom: 4 }}>Your prompt now</div>
          {current.trim() || 'The prompt is empty — write an idea instead.'}
        </div>
      )}
      <IngredientPicker
        opened={picker === 'slash'} onClose={() => setPicker(null)} ownSearch={false} highlight={hl}
        tiles={tiles.positive} picked={picked} onToggle={pickFromSlash} query={pickQuery} onQuery={setPickQuery} categoryNames={tiles.categoryNames}
        target={
          <textarea ref={box} data-autofocus className="il-wi-idea" value={idea} rows={phone ? 4 : 4} autoFocus={!phone} aria-label={mode === 'idea' ? 'Your idea' : 'What to change'}
            placeholder={mode === 'idea' ? 'Describe the picture… (type / to add a snippet)' : 'What to change (optional): moodier, add rain, close-up…'}
            onChange={(e) => onIdea(e.target.value, e.target.selectionStart ?? e.target.value.length)} onKeyDown={onIdeaKey}
            onBlur={() => { if (picker === 'slash') setTimeout(() => setPicker((p) => (p === 'slash' ? null : p)), 120); }}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--il-line-soft)', borderRadius: 14, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 14, lineHeight: 1.5, padding: '12px 14px', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
        }
      />
      {mode === 'idea' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip tall={phone} icon={<IconDice5 size={14} stroke={2.2} />} onClick={() => { setIdea(surpriseIdea()); box.current?.focus(); }} title="A random idea">Surprise me</Chip>
          {examples.map((x) => <Chip key={x} tall={phone} onClick={() => { setIdea(x); box.current?.focus(); }} style={{ background: 'transparent', maxWidth: '100%' }}>{x}</Chip>)}
          <Button tone="ghost" size={phone ? 'md' : 'sm'} icon={<IconRefresh size={13} />} tooltip="Other examples" onClick={() => setExamples(exampleIdeas(phone ? 2 : 3))} />
        </div>
      )}
    </div>
  );

  const ingredientsBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={eyebrow}>Ingredients</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-dim)' }}>snippets the AI blends in</span>
      </div>
      {/* "+ Add" comes first so the picker's anchor never moves while chips are added. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <IngredientPicker
          opened={picker === 'add'} onClose={() => { setPicker(null); setPickQuery(''); }} ownSearch highlight={-1}
          tiles={tiles.positive} picked={picked} onToggle={toggleIngredient} query={picker === 'add' ? pickQuery : ''} onQuery={setPickQuery} categoryNames={tiles.categoryNames}
          target={<Chip tall={phone} dashed icon={<IconPlus size={12} stroke={2.6} />} onClick={() => { setPickQuery(''); setPicker(picker === 'add' ? null : 'add'); }} disabled={ingredients.length >= MAX_INGREDIENTS}>Add</Chip>}
        />
        {ingredients.map((s) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: phone ? 40 : 32, padding: '0 2px 0 4px', borderRadius: 10, background: 'var(--il-card)', border: '1px solid var(--il-line-soft)', fontSize: 12, fontWeight: 700, color: 'var(--il-fg)', maxWidth: '100%' }}
            title={s.layers ? s.layers.map((l) => l.text).join(' · ') : s.text}>
            <span aria-hidden style={{ width: phone ? 30 : 24, height: phone ? 30 : 24, borderRadius: 7, flex: 'none', background: tileBackground(tileHue(s)) }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <button type="button" aria-label={`Remove ${s.name}`} onClick={() => toggleIngredient(s)}
              style={{ width: phone ? 36 : 26, height: phone ? 36 : 26, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><IconX size={12} stroke={2.6} /></button>
          </span>
        ))}
      </div>
    </div>
  );

  const picks = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={eyebrow}>Style</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STYLE_PICKS.map((p) => <Chip key={p.id} tall={phone} small={!phone} on={w.style === p.id} onClick={() => w.setStyle(p.id)}>{p.label}</Chip>)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={eyebrow}>Length</span>
        <Tabs items={LENGTH_PICKS.map((p) => ({ key: p.id, label: p.label }))} value={w.length} onChange={w.setLength} compact={!phone} />
      </div>
    </div>
  );

  const writeBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
        {!phone && <span style={eyebrow}>Options</span>}
        <div style={{ width: phone ? 120 : 128 }}>
          <Tabs items={COUNTS.map((c) => ({ key: c, label: c }))} value={String(w.count) as (typeof COUNTS)[number]} onChange={(c) => w.setCount(Number(c))} />
        </div>
      </div>
      <Button tone="primary" size="lg" grow disabled={!canRun} onClick={writeAll} style={{ flex: 1, alignSelf: 'flex-end' }}
        icon={busy ? <Spinner size={14} color="var(--il-bg)" /> : <IconSparkles size={16} stroke={2.2} />}>
        {busy ? 'Writing…' : `Write ${w.count === 1 ? 'a prompt' : `${w.count} prompts`}`}
      </Button>
    </div>
  );

  const resultsPane = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((o, i) => (
        <OptionCard key={o.key} n={i + 1} opt={o} onUse={use} onAgain={() => again(o.key)} onTweak={(t) => tweak(o.key, t)}
          onBack={() => patchOption(sessionId, o.key, (x) => ({ ...x, versions: x.versions.slice(0, -1) }))} />
      ))}
      {options.length > 1 && !busy && (
        <div><Button tone="card" size={phone ? 'lg' : 'sm'} icon={<IconRefresh size={14} stroke={2.4} />} disabled={!canRun} onClick={writeAll}>Write all again</Button></div>
      )}
      {!options.length && (
        <div style={{ border: '1px dashed var(--il-line-strong)', borderRadius: 16, padding: phone ? '22px 16px' : '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }}><IconSparkles size={22} /></span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--il-fg2)' }}>Your prompt options show up here</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', maxWidth: 340 }}>Write 1–3 at once, tweak the one you like, then “Use this”.</span>
        </div>
      )}
    </div>
  );

  const recentPane = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!w.recent.length && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '18px 2px' }}>Every prompt the studio writes is kept here (last 30).</div>}
      {w.recent.map((r) => (
        <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, background: 'var(--il-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--il-dim)' }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.idea || '—'}</span>
            <span style={{ flex: 'none' }}>{formatWhen(r.at)}</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--il-fg2)', wordBreak: 'break-word' }}>{r.prompt}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button tone="primary" size={phone ? 'lg' : 'sm'} onClick={() => use(r.prompt)}>Use this</Button>
            <Button tone="card" size={phone ? 'lg' : 'sm'} onClick={() => { addOption(sessionId, r.prompt); w.setTab('results'); }} tooltip="Tweak this">Tweak</Button>
            <div style={{ flex: 1 }} />
            <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconTrash size={14} />} tooltip="Remove" onClick={() => w.removeRecent(r.id)} />
          </div>
        </div>
      ))}
    </div>
  );

  const right = (
    <>
      <div ref={resultsTop} style={{ scrollMarginTop: 8 }}>
        <Tabs items={tabs} value={tab} onChange={w.setTab} hug />
      </div>
      {tab === 'results' ? resultsPane : tab === 'recent' ? recentPane : <StudioSettings />}
    </>
  );

  const notes = (
    <>
      {!ready && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-warn)' }}>{aiNotReadyHint(ai)} to write prompts.</div>}
    </>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: phone ? '10px 14px' : '14px 18px', borderBottom: '1px solid var(--il-line-soft)', flex: 'none' }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', flex: 'none' }}><IconSparkles size={17} stroke={2.2} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Prompt studio</div>
        {!phone && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>Describe it, add ingredients, pick the one you like. The negative stays.</div>}
      </div>
      {!phone && <div style={{ width: 240 }}><AiModelPicker size="xs" /></div>}
      <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconX size={16} stroke={2.4} />} tooltip="Close" onClick={onClose} />
    </div>
  );

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={`min(1120px, ${vw(94)})`} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }} closeOnEscape={picker === null}
      styles={{
        content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)', height: phone ? dvh(100) : `min(800px, ${dvh(90)})`, maxHeight: phone ? undefined : dvh(90), overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 },
      }}>
      {header}
      {phone ? (
        <>
          <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', padding: pad, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ideaBox}{ingredientsBlock}{picks}{notes}
            {right}
          </div>
          <div style={{ flex: 'none', padding: '10px 14px calc(12px + var(--il-safe-bottom, 0px))', borderTop: '1px solid var(--il-line-soft)', background: 'var(--il-panel)' }}>{writeBar}</div>
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(360px, 440px) minmax(0, 1fr)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--il-line-soft)' }}>
            <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ideaBox}{ingredientsBlock}{picks}{notes}
            </div>
            <div style={{ flex: 'none', padding: '12px 18px 16px', borderTop: '1px solid var(--il-line-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {writeBar}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-dim)', textAlign: 'right' }}>Ctrl+Enter writes</span>
            </div>
          </div>
          <div className="il-scroll" style={{ minHeight: 0, overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {right}
          </div>
        </div>
      )}
    </Modal>
  );
}
