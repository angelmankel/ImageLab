/**
 * Items 13 + 12: the smart prompt box's hidden data layer, read from the text itself. The prompt
 * is ONE string in ComfyUI syntax (what ComfyUI gets is what you see); this module reads it into
 * parts — comma sections, `(text:1.2)` weights, runs of text that are a snippet / style tile —
 * and makes the edits the box needs (set a part's weight, Ctrl+↑/↓, insert / remove a snippet,
 * the "/" picker's query). Pure: no store, no React, tested in node (`tests/smartPrompt.test.cjs`).
 */

/** One top-level comma section, trimmed. `inner*` = the text inside a weight group (or the whole). */
export interface Section {
  start: number; end: number;
  innerStart: number; innerEnd: number;
  /** 1 = plain. A bare `(x)` is ComfyUI's 1.1. */
  weight: number;
  /** Written as `(x:n)` or `(x)`: the brackets are syntax, not text. */
  grouped: boolean;
}

/** A clickable part of the prompt: one section, or a run of sections that is a snippet. */
export interface Part extends Section {
  snippetId?: string;
  /** Index range in the section list (inclusive). */
  from: number; to: number;
}

export interface SnippetLike { id: string; text: string; layers?: Array<{ kind: string; text: string }>; kind: string }

const WS = /\s/;
const EPS = 0.001;
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 3;

/** "1.2", "0.85", "1.25" — two decimals at most, no trailing zeros, at least one decimal. */
export function formatWeight(w: number): string {
  const r = Math.round(w * 100) / 100;
  const s = r.toFixed(2).replace(/0$/, '');
  return s;
}

const round2 = (w: number) => Math.round(w * 100) / 100;
const clampW = (w: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, round2(w)));

/** Index of the `)` closing the `(` at `open`, honouring `\(` escapes; -1 when unbalanced. */
function closeOf(text: string, open: number, limit: number): number {
  let depth = 0;
  for (let i = open; i < limit; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** The weight-group reading of [start, end): `(inner:n)` or `(inner)`, else plain. */
function readGroup(text: string, start: number, end: number): Pick<Section, 'innerStart' | 'innerEnd' | 'weight' | 'grouped'> {
  const plain = { innerStart: start, innerEnd: end, weight: 1, grouped: false };
  if (text[start] !== '(' || text[end - 1] !== ')' || closeOf(text, start, end) !== end - 1) return plain;
  const body = text.slice(start + 1, end - 1);
  const m = /:\s*(-?\d*\.?\d+)\s*$/.exec(body);
  // The colon must be at depth 0 inside the group.
  if (m) {
    const colon = start + 1 + m.index;
    let depth = 0;
    for (let i = start + 1; i < colon; i++) {
      const c = text[i];
      if (c === '\\') { i++; continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
    }
    if (depth === 0) {
      let is = start + 1; let ie = colon;
      while (is < ie && WS.test(text[is])) is++;
      while (ie > is && WS.test(text[ie - 1])) ie--;
      return { innerStart: is, innerEnd: ie, weight: Number(m[1]), grouped: true };
    }
  }
  let is = start + 1; let ie = end - 1;
  while (is < ie && WS.test(text[is])) is++;
  while (ie > is && WS.test(text[ie - 1])) ie--;
  return { innerStart: is, innerEnd: ie, weight: 1.1, grouped: true };
}

/** Top-level sections (split on `,` and newlines outside brackets), trimmed, empty ones dropped. */
export function parseSections(text: string): Section[] {
  const out: Section[] = [];
  let depth = 0;
  let segStart = 0;
  const push = (a: number, b: number) => {
    while (a < b && WS.test(text[a])) a++;
    while (b > a && WS.test(text[b - 1])) b--;
    if (b > a) out.push({ start: a, end: b, ...readGroup(text, a, b) });
  };
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (i === text.length) { push(segStart, i); break; }
    if (c === '\\') { i++; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if ((c === ',' || c === '\n') && depth === 0) { push(segStart, i); segStart = i + 1; }
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** A text's atoms: its top-level comma parts, normalised (weights kept as written). */
export function atomsOf(text: string): string[] {
  return parseSections(text).map((s) => norm(text.slice(s.start, s.end)));
}

/** What a snippet writes into a prompt of `kind` ('' when it has nothing for that kind). */
export function snippetTextFor(s: SnippetLike, kind: string): string {
  if (s.layers) return s.layers.filter((l) => l.kind === kind).map((l) => l.text.trim()).filter(Boolean).join(', ');
  return s.kind === kind ? s.text.trim() : '';
}

/**
 * The prompt's parts: snippet runs (longest snippet first, left to right) and the other sections
 * one by one. A snippet matches either as a run of plain sections equal to its atoms, or as ONE
 * weight group whose inside is exactly its text (`(golden hour, warm light:1.2)`).
 */
export function promptParts(text: string, snippets: SnippetLike[], kind: string): Part[] {
  const secs = parseSections(text);
  const atoms = secs.map((s) => norm(text.slice(s.start, s.end)));
  const innerAtoms = secs.map((s) => (s.grouped ? atomsOf(text.slice(s.innerStart, s.innerEnd)) : null));
  const cands = snippets
    .map((s) => ({ id: s.id, atoms: atomsOf(snippetTextFor(s, kind)) }))
    .filter((c) => c.atoms.length > 0)
    .sort((a, b) => b.atoms.length - a.atoms.length);
  const parts: Part[] = [];
  for (let i = 0; i < secs.length; i++) {
    let hit: Part | null = null;
    for (const c of cands) {
      const inner = innerAtoms[i];
      if (inner && inner.length === c.atoms.length && inner.every((a, k) => a === c.atoms[k])) {
        hit = { ...secs[i], snippetId: c.id, from: i, to: i };
        break;
      }
      const n = c.atoms.length;
      if (i + n > secs.length) continue;
      let ok = true;
      for (let k = 0; k < n; k++) if (secs[i + k].grouped || atoms[i + k] !== c.atoms[k]) { ok = false; break; }
      if (ok) {
        const last = secs[i + n - 1];
        hit = { start: secs[i].start, end: last.end, innerStart: secs[i].start, innerEnd: last.end, weight: 1, grouped: false, snippetId: c.id, from: i, to: i + n - 1 };
        break;
      }
    }
    if (hit) { parts.push(hit); i = hit.to; } else parts.push({ ...secs[i], from: i, to: i });
  }
  return parts;
}

/** The part the caret / selection start is in (edges count), or null. */
export function partAt(parts: Part[], pos: number): Part | null {
  return parts.find((p) => pos >= p.start && pos <= p.end) ?? null;
}

/** Snippet id → its part (the first one), for "is this tile on" and its weight. */
export function partsBySnippet(parts: Part[]): Map<string, Part> {
  const m = new Map<string, Part>();
  for (const p of parts) if (p.snippetId && !m.has(p.snippetId)) m.set(p.snippetId, p);
  return m;
}

/** An edit: replace [start, end) with `insert`; then the selection to show. */
export interface Edit { start: number; end: number; insert: string; selStart: number; selEnd: number }

export function applyEdit(text: string, e: Edit): string {
  return text.slice(0, e.start) + e.insert + text.slice(e.end);
}

/** Rewrite a part at weight `w` (1 → plain text again). Selection = the part's inside afterwards. */
export function setPartWeight(text: string, part: Pick<Section, 'start' | 'end' | 'innerStart' | 'innerEnd'>, w: number): Edit {
  const inner = text.slice(part.innerStart, part.innerEnd);
  const nw = clampW(w);
  if (Math.abs(nw - 1) < EPS) return { start: part.start, end: part.end, insert: inner, selStart: part.start, selEnd: part.start + inner.length };
  const insert = `(${inner}:${formatWeight(nw)})`;
  return { start: part.start, end: part.end, insert, selStart: part.start + 1, selEnd: part.start + 1 + inner.length };
}

/**
 * Ctrl+↑ / Ctrl+↓, ComfyUI style. A selection that is a part (or exactly its inside) or a caret in
 * a part changes that part's weight; any other selection is wrapped on its own `(sel:1.1)`.
 */
export function nudgeWeight(text: string, parts: Part[], selStart: number, selEnd: number, delta: number): Edit | null {
  if (selStart !== selEnd) {
    const p = parts.find((x) => (selStart === x.start && selEnd === x.end) || (selStart === x.innerStart && selEnd === x.innerEnd));
    if (p) return setPartWeight(text, p, p.weight + delta);
    let a = selStart; let b = selEnd;
    while (a < b && /[\s,]/.test(text[a])) a++;
    while (b > a && /[\s,]/.test(text[b - 1])) b--;
    if (b <= a) return null;
    return setPartWeight(text, { start: a, end: b, innerStart: a, innerEnd: b }, 1 + delta);
  }
  const p = partAt(parts, selStart);
  return p ? setPartWeight(text, p, p.weight + delta) : null;
}

/** Remove [start, end) with one neighbouring separator, so no ", ," is left behind. */
export function removeRange(text: string, start: number, end: number): Edit {
  let a = start; let b = end;
  const after = /^[ \t]*,[ \t]*/.exec(text.slice(b));
  if (after) b += after[0].length;
  else {
    const before = /[ \t]*,[ \t]*$/.exec(text.slice(0, a));
    if (before) a -= before[0].length;
    else { while (b < text.length && /[ \t]/.test(text[b])) b++; }
  }
  return { start: a, end: b, insert: '', selStart: a, selEnd: a };
}

/** Append `piece` as its own section at the end (", " joins it). */
export function appendPiece(text: string, piece: string): Edit {
  const trimmed = text.replace(/[\s,]+$/, '');
  const insert = trimmed ? `, ${piece}` : piece;
  return { start: trimmed.length, end: text.length, insert, selStart: trimmed.length + insert.length, selEnd: trimmed.length + insert.length };
}

/** The "/" query being typed at the caret, or null. The slash starts the text or follows space / , / (. */
export function slashQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|[\s,(])\/([^,\n/()]{0,32})$/.exec(before);
  if (!m) return null;
  const start = caret - m[2].length - 1;
  return { start, query: m[2] };
}

/** Put `piece` where the "/query" was, as its own comma section. */
export function replaceSlash(text: string, start: number, caret: number, piece: string): Edit {
  let a = start;
  while (a > 0 && /[ \t]/.test(text[a - 1])) a--;
  const prev = a > 0 ? text[a - 1] : '';
  const lead = !prev || prev === '\n' || prev === '(' ? '' : prev === ',' ? ' ' : ', ';
  const rest = text.slice(caret);
  const nextCh = rest.replace(/^[ \t]+/, '')[0] ?? '';
  const trail = !nextCh || nextCh === ',' || nextCh === ')' || nextCh === '\n' ? '' : ', ';
  const insert = lead + piece + trail;
  let b = caret;
  if (trail) while (b < text.length && /[ \t]/.test(text[b])) b++;
  const end = a + lead.length + piece.length;
  return { start: a, end: b, insert, selStart: end, selEnd: end };
}

/** How many sections a prompt has (the Negative tab's count). */
export function sectionCount(text: string): number {
  return parseSections(text).length;
}

/**
 * The old layer stack folded into one text per kind (the box shows one text): the ON layers of a
 * kind are written, with their weights, into the first layer of that kind; the rest go (an off
 * layer is never shown or sent in this UI). Returns null when each kind is already one plain layer.
 */
export function foldLayers<L extends { id: string; kind: string; on: boolean; text: string; weight: number; originSnippetId?: string }>(layers: L[]): L[] | null {
  let changed = false;
  let out = layers;
  for (const kind of ['positive', 'negative']) {
    const all = out.filter((l) => l.kind === kind);
    if (!all.length) continue;
    if (all.length === 1 && all[0].on && Math.abs(all[0].weight - 1) < EPS && !all[0].originSnippetId) continue;
    const text = all.filter((l) => l.on && l.text.trim()).map((l) => {
      const t = l.text.trim();
      return Math.abs(l.weight - 1) < EPS ? t : `(${t}:${formatWeight(l.weight)})`;
    }).join(', ');
    const keep = all[0];
    const drop = new Set(all.slice(1).map((l) => l.id));
    out = out.filter((l) => !drop.has(l.id)).map((l) => (l.id === keep.id ? { ...l, text, on: true, weight: 1, originSnippetId: undefined } : l));
    changed = true;
  }
  return changed ? out : null;
}
