/**
 * Item 13: the smart prompt box. ONE text in ComfyUI syntax (so what ComfyUI gets is what you
 * see) in a transparent <textarea>, over a backdrop that paints the hidden data layer read from
 * that text (`promptSections`): each part tinted — a snippet / style tile in its tile colour, a
 * weight > 1 warm, < 1 cool, the `( :1.2)` syntax dimmed. The part under the caret is outlined and
 * shown in the section bar (name, − weight +, save as tile, remove). Ctrl+↑/↓ = ±0.1 (Shift ±0.05),
 * at 1.0 the brackets go. "/" opens the snippet picker: suggested first, fuzzy, ↑↓ Enter, Esc.
 * Edits go through `insertText` so the browser's own Undo (Ctrl+Z) keeps working.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { IconMinus, IconPlus, IconStar, IconX } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { Tip, useScrollIntoView } from '~/ui';
import { pushUndo } from '~/app/undo';
import { PartHandles, type PartDrag } from './PartHandles';
import {
  applyEdit, formatWeight, movePart, nudgeWeight, partAt, promptParts, replaceSlash, setPartWeight, removeRange, slashQuery, snippetTextFor,
  type Edit, type Part,
} from './promptSections';
import { fuzzy, relatedTiles, searchTiles, tileBackground, tileHue, type TileSnippet } from './promptSearch';
import './smartPrompt.css';

/** Items 6 / 43: the box grows to this share of the window (between the two px bounds), then scrolls inside. */
const MAX_H = 320;
const MAX_SHARE = 0.24;
const MIN_CAP = 110;
const capFor = (large: boolean) => Math.round(Math.max(MIN_CAP, Math.min(large ? 260 : MAX_H, window.innerHeight * MAX_SHARE)));
const PICK_MAX = 40;

export interface SmartPromptBoxProps {
  value: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  kind: 'positive' | 'negative';
  /** The tiles this box knows (already free of model-specific entries). */
  snippets: TileSnippet[];
  categoryNames: Record<string, string>;
  placeholder?: string;
  minRows?: number;
  large?: boolean;
  /** "☆ Save as a tile" for a plain text part. */
  onSaveAsSnippet?: (text: string) => void;
  ariaLabel?: string;
}

/** The typed text: every part no tile put there (what Auto and the suggestions read). */
export function typedText(text: string, parts: Part[]): string {
  return parts.filter((p) => !p.snippetId).map((p) => text.slice(p.innerStart, p.innerEnd)).join(', ');
}

function Highlight({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return <>{Array.from(text).map((ch, i) => (set.has(i) ? <mark key={i}>{ch}</mark> : ch))}</>;
}

function Backdrop({ text, parts, active, byId, drag }: { text: string; parts: Part[]; active: Part | null; byId: Map<string, TileSnippet>; drag: PartDrag | null }) {
  const out: ReactNode[] = [];
  let at = 0;
  parts.forEach((p, i) => {
    if (p.start > at) out.push(<span key={`s${i}`} className="il-sp-sep">{text.slice(at, p.start)}</span>);
    const snip = p.snippetId ? byId.get(p.snippetId) : undefined;
    const cls = ['il-sp-part'];
    if (snip) cls.push('il-sp-snip');
    if (p.weight > 1.001) cls.push('il-sp-up'); else if (p.weight < 0.999) cls.push('il-sp-dn');
    if (active && active.start === p.start && active.end === p.end && !drag) cls.push('il-sp-on');
    if (drag && drag.from === i) cls.push('il-sp-lift');
    if (drag && drag.mode === 'swap' && drag.to === i) cls.push('il-sp-drop');
    const style = snip ? ({ '--h': tileHue(snip) } as React.CSSProperties) : undefined;
    const post = text.slice(p.innerEnd, p.end);
    out.push(
      <span key={`p${i}`} data-pi={i} className={cls.join(' ')} style={style}>
        {p.innerStart > p.start && <span className="il-sp-syn">{text.slice(p.start, p.innerStart)}</span>}
        {text.slice(p.innerStart, p.innerEnd)}
        {post && post.split(/(-?\d*\.?\d+)/).map((bit, k) => (bit ? <span key={k} className={/\d/.test(bit) ? 'il-sp-num' : 'il-sp-syn'}>{bit}</span> : null))}
      </span>,
    );
    at = p.end;
  });
  if (at < text.length) out.push(<span key="tail" className="il-sp-sep">{text.slice(at)}</span>);
  out.push(' ');
  return <>{out}</>;
}

const barBtn = (phone: boolean): React.CSSProperties => ({
  width: phone ? 38 : 28, height: phone ? 38 : 28, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-fg2)',
  display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none',
});
const keep = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

export function SmartPromptBox({ value, onChange, onBlur, kind, snippets, categoryNames, placeholder, minRows = 4, large = false, onSaveAsSnippet, ariaLabel }: SmartPromptBoxProps) {
  const phone = useIsPhone();
  const ta = useRef<HTMLTextAreaElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<PartDrag | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Item 40: the selection is stored WITH the text it was read from; a selection read from another
  // text is never used (that was the stale "two flycatchers" frame), so the part bar can only show
  // a part of the current text.
  const [selRead, setSelRead] = useState<{ a: number; b: number; v: string }>({ a: value.length, b: value.length, v: value });
  const setSel = ([a, b]: [number, number], v?: string) => setSelRead({ a, b, v: v ?? ta.current?.value ?? value });
  const selOk = selRead.v === value;
  const sel: [number, number] = selOk ? [selRead.a, selRead.b] : [-1, -1];
  const [focusedRaw, setFocused] = useState(false);
  const focused = focusedRaw && selOk;
  const pointerFocus = useRef(false);
  const [hl, setHl] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const pendingSel = useRef<[number, number] | null>(null);

  const byId = useMemo(() => new Map(snippets.map((s) => [s.id, s])), [snippets]);
  const parts = useMemo(() => promptParts(value, snippets, kind), [value, snippets, kind]);
  const active = focused && sel[0] === sel[1] ? partAt(parts, sel[0]) : focused ? parts.find((p) => sel[0] >= p.start && sel[1] <= p.end) ?? null : null;

  // The "/" picker.
  const slash = focused && sel[0] === sel[1] ? slashQuery(value, sel[0]) : null;
  const pickOpen = !!slash && dismissed !== slash.start;
  // ↑ / ↓ keep the highlighted snippet in view (item 39): scrolls the list only, never the panel.
  const pickRef = useRef<HTMLDivElement>(null);
  useScrollIntoView(pickRef, pickOpen ? hl : -1, { enabled: pickOpen });
  const options = useMemo(() => {
    if (!slash) return [] as Array<{ s: TileSnippet; suggested: boolean }>;
    const usable = snippets.filter((s) => snippetTextFor(s, kind));
    if (slash.query.trim()) return searchTiles(usable, slash.query).slice(0, PICK_MAX).map((s) => ({ s, suggested: false }));
    const typed = typedText(value, parts);
    const sug = relatedTiles(usable, typed, categoryNames).tiles.slice(0, 5);
    const ids = new Set(sug.map((s) => s.id));
    return [...sug.map((s) => ({ s, suggested: true })), ...usable.filter((s) => !ids.has(s.id)).slice(0, PICK_MAX).map((s) => ({ s, suggested: false }))];
  }, [slash?.query, slash?.start, snippets, kind, value, parts, categoryNames]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setHl(0); }, [slash?.query, slash?.start]);
  useEffect(() => { if (!slash) setDismissed(null); }, [slash]);

  // Grow with the text up to MAX_H, then scroll (backdrop follows).
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(capFor(large), el.scrollHeight)}px`;
    if (back.current) back.current.scrollTop = el.scrollTop;
    if (pendingSel.current) {
      const [a, b] = pendingSel.current;
      pendingSel.current = null;
      if (document.activeElement === el) el.setSelectionRange(a, b);
      setSel([a, b], value);
    } else if (document.activeElement === el && selRead.v !== value) setSel([el.selectionStart, el.selectionEnd], value);
  }, [value, large]); // eslint-disable-line react-hooks/exhaustive-deps

  const readSel = () => { const el = ta.current; if (el) setSel([el.selectionStart, el.selectionEnd], el.value); };
  /** Read the caret before the next paint (the browser moves it after mousedown / keydown handlers). */
  const readSoon = () => requestAnimationFrame(() => {
    const el = ta.current;
    if (!el) return;
    flushSync(() => { setFocused(document.activeElement === el); readSel(); });
    pointerFocus.current = false;
  });
  // Any other caret move (drag-select, IME, programmatic) — read it too.
  useEffect(() => {
    const on = () => { if (ta.current && document.activeElement === ta.current) readSel(); };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Apply an edit: through the browser (keeps Ctrl+Z) when the box has focus, else directly. */
  const apply = (e: Edit) => {
    const el = ta.current;
    if (el && document.activeElement === el) {
      el.setSelectionRange(e.start, e.end);
      const ok = e.insert ? document.execCommand('insertText', false, e.insert) : e.start === e.end || document.execCommand('delete');
      if (ok && el.value === applyEdit(value, e)) {
        el.setSelectionRange(e.selStart, e.selEnd);
        setSel([e.selStart, e.selEnd], el.value);
        return;
      }
    }
    pendingSel.current = [e.selStart, e.selEnd];
    onChange(applyEdit(value, e));
  };

  /**
   * An edit made from outside the keyboard (drag, ×): through the browser when the box has focus
   * (so its own Ctrl+Z works), and on the app's undo stack too — guarded, so an entry whose text
   * has moved on since does nothing.
   */
  const applyUndoable = (e: Edit, label: string) => {
    const before = valueRef.current;
    const after = applyEdit(before, e);
    apply(e);
    pushUndo({
      label,
      undo: () => { if (valueRef.current === after) onChange(before); },
      redo: () => { if (valueRef.current === before) onChange(after); },
    });
  };
  const movePartTo = (from: number, to: number, mode: 'swap' | 'move') => {
    const ed = movePart(value, parts, from, to, mode);
    if (!ed) return;
    ta.current?.focus({ preventScroll: true });
    applyUndoable(ed, 'Move prompt part');
  };

  const pick = (s: TileSnippet) => {
    if (!slash) return;
    apply(replaceSlash(value, slash.start, sel[0], snippetTextFor(s, kind)));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    readSoon();
    if (pickOpen && options.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => (h + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => (h - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[Math.min(hl, options.length - 1)].s); return; }
    }
    if (pickOpen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(slash!.start); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && active) {
      e.preventDefault();
      const i = parts.indexOf(active);
      const j = i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (i >= 0 && j >= 0 && j < parts.length) movePartTo(i, j, 'swap');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const el = e.currentTarget;
      const step = (e.shiftKey ? 0.05 : 0.1) * (e.key === 'ArrowUp' ? 1 : -1);
      const ed = nudgeWeight(value, parts, el.selectionStart, el.selectionEnd, step);
      if (ed) apply(ed);
    }
  };

  const activeSnip = active?.snippetId ? byId.get(active.snippetId) : undefined;
  const weightOf = active ? active.weight : 1;
  const bump = (d: number) => { if (active) apply(setPartWeight(value, active, weightOf + d)); };
  const dotColor = activeSnip ? `hsl(${tileHue(activeSnip)} 55% 55%)` : weightOf > 1.001 ? 'var(--sp-accent)' : weightOf < 0.999 ? 'var(--il-info)' : 'var(--il-fg2)';

  return (
    <div className={`il-sp${kind === 'negative' ? ' is-neg' : ''}${large ? ' is-large' : ''}`}>
      <div ref={wrap} className="il-sp-wrap">
        <div ref={back} className="il-sp-back" aria-hidden><Backdrop text={value} parts={parts} active={active} byId={byId} drag={drag} /></div>
        <textarea
          ref={ta}
          className="il-sp-ta"
          aria-label={ariaLabel ?? (kind === 'negative' ? 'Negative prompt' : 'Prompt')}
          rows={minRows}
          value={value}
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setSel([e.target.selectionStart, e.target.selectionEnd], e.target.value); }}
          onSelect={readSel}
          onKeyUp={readSel}
          onMouseUp={readSel}
          onMouseDown={() => { pointerFocus.current = true; readSoon(); }}
          onFocus={() => { if (pointerFocus.current) return; setFocused(true); readSel(); }}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onScroll={(e) => { if (back.current) back.current.scrollTop = e.currentTarget.scrollTop; }}
          onKeyDown={onKeyDown}
          style={{ minHeight: minRows * (large ? 16 : 15) * 1.55 }}
        />
        <PartHandles wrap={wrap} back={back} ta={ta} parts={parts} value={value} off={pickOpen}
          caretPart={focused && active ? parts.indexOf(active) : -1}
          isSnippet={(p) => !!p.snippetId && byId.has(p.snippetId)}
          drag={drag} setDrag={setDrag}
          onMove={movePartTo}
          onRemove={(p) => applyUndoable(removeRange(value, p.start, p.end), 'Take out snippet')}
          onPick={(p) => { const el = ta.current; if (!el) return; el.focus({ preventScroll: true }); el.setSelectionRange(p.innerStart, p.innerEnd); setFocused(true); setSel([p.innerStart, p.innerEnd], el.value); }} />
        {pickOpen && (
          <div ref={pickRef} className="il-sp-pick il-scroll" role="listbox" aria-label="Snippets" onMouseDown={keep} style={{ top: 'calc(100% + 6px)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '4px 8px 6px' }}>
              {slash!.query ? <>Snippets matching <b style={{ color: 'var(--il-fg)' }}>{slash!.query}</b></> : 'Snippets'}{!phone && ' · ↑↓ Enter · Esc'}
            </div>
            {options.length === 0 && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '8px 8px 10px' }}>Nothing matches — keep typing, or Esc.</div>}
            {options.map(({ s, suggested }, i) => {
              const first = i === 0 || options[i - 1].suggested !== suggested;
              const nm = slash!.query ? fuzzy(slash!.query, s.name) : null;
              return (
                <div key={s.id}>
                  {first && !slash!.query && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--il-dim)', padding: '6px 8px 4px' }}>{suggested ? 'Suggested' : 'All'}</div>}
                  <button type="button" role="option" aria-selected={i === hl} className={`il-sp-opt${i === hl ? ' is-hl' : ''}`} onMouseEnter={() => setHl(i)} onClick={() => pick(s)}>
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', background: tileBackground(tileHue(s)) }} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <b style={{ fontSize: 12, fontWeight: 800 }}>{nm ? <Highlight text={s.name} hits={nm.hits} /> : s.name}</b>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{snippetTextFor(s, kind)}</span>
                    </span>
                    {categoryNames[s.categoryId] && <span className="il-sp-cat">{categoryNames[s.categoryId]}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The section bar: one fixed-height row, so the layout never jumps. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: phone ? 44 : 34, marginTop: 8, padding: active ? '0 4px 0 10px' : '0 2px', borderRadius: 10,
        background: active ? (kind === 'negative' ? 'color-mix(in srgb, var(--il-err) 12%, var(--il-elev))' : 'var(--il-elev)') : 'transparent' }}>
        {active ? (
          <>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, flex: 'none', background: dotColor }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeSnip ? activeSnip.name : value.slice(active.innerStart, active.innerEnd)}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}> · {activeSnip ? (categoryNames[activeSnip.categoryId] ?? 'tile') : 'text'}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, background: 'var(--il-card-on)', flex: 'none' }}>
              <Tip label="Weaker" keys="Ctrl ↓"><button type="button" aria-label="Weaker" onMouseDown={keep} onClick={() => bump(-0.1)} style={barBtn(phone)}><IconMinus size={13} stroke={2.6} /></button></Tip>
              <span style={{ minWidth: 32, textAlign: 'center', fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: Math.abs(weightOf - 1) < 0.001 ? 'var(--il-fg2)' : 'var(--sp-accent-hi)' }}>{formatWeight(weightOf)}</span>
              <Tip label="Stronger" keys="Ctrl ↑"><button type="button" aria-label="Stronger" onMouseDown={keep} onClick={() => bump(0.1)} style={barBtn(phone)}><IconPlus size={13} stroke={2.6} /></button></Tip>
            </span>
            {!activeSnip && onSaveAsSnippet && (
              <Tip label="Save as a tile"><button type="button" aria-label="Save as a tile" onMouseDown={keep} onClick={() => onSaveAsSnippet(value.slice(active.innerStart, active.innerEnd))} style={{ ...barBtn(phone), color: 'var(--il-muted)' }}><IconStar size={14} stroke={2.2} /></button></Tip>
            )}
            <Tip label="Take it out"><button type="button" aria-label="Take this part out" onMouseDown={keep} onClick={() => applyUndoable(removeRange(value, active.start, active.end), 'Take out prompt part')} style={{ ...barBtn(phone), color: 'var(--il-muted)' }}><IconX size={14} stroke={2.4} /></button></Tip>
          </>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontWeight: 700, color: 'var(--il-dim)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span><Kbd>/</Kbd> {kind === 'negative' ? 'negative snippets' : 'snippets'}</span>
            {phone ? <span>tap a part to set its strength</span> : <><span><Kbd>Ctrl</Kbd> <Kbd>↑</Kbd><Kbd>↓</Kbd> strength</span><span>click a part to edit it</span></>}
          </span>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd style={{ font: 'inherit', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 5, background: 'var(--il-card-on)', color: 'var(--il-fg2)' }}>{children}</kbd>;
}
