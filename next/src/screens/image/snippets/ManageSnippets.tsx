/**
 * Item 42: Manage snippets + categories, one wide modal (phone: one pane at a time, ‹ back).
 * LEFT the categories: drag ⋮⋮ to reorder, count, right-click for the category menu, + New.
 * RIGHT the picked category: emoji (popover grid or any text), name, colour swatches, ✦ Generate
 * snippets (writeit's helper, when present), Merge into…, Delete (snippets → Uncategorized), + Snippet;
 * its snippets as rows — tick to multi-select (Shift = a range; the header box = all / none; then
 * Move to… · Duplicate · Delete), drag rows onto a category on the left to move them (desktop; on a
 * phone: Move to…), click to edit, ⋯ /
 * right-click = the tile menu. A search box looks through every category. All changes are one app
 * undo step each (`snippetOps`), no toasts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Popover } from '@mantine/core';
import { IconArrowLeft, IconCheck, IconCopy, IconDots, IconGripVertical, IconMinus, IconPlus, IconSearch, IconSparkles, IconTrash, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { Snippet, SnippetCategory } from '@/lib/types';
import { menuProps, openMenu } from '~/app/contextMenu';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, SearchSelect } from '~/ui';
import { T } from '~/theme/tokens';
import { dvh, vh } from '~/theme/uiScale';
import { categoryHue, isModelSpecific, tileBackground, tileHue } from '../prompt/promptSearch';
import { useTileEdit } from '../prompt/tileStore';
import { CATEGORY_EMOJI, CATEGORY_HUES, categoryKind, countByCategory, targetOptions, UNCATEGORIZED, type CatKind } from './snippetModel';
import { addCategory, deleteCategory, deleteSnippets, duplicateSnippets, mergeCategory, moveSnippets, reorderCategory, updateCategory } from './snippetOps';
import { previewText, searchSnippets } from './snippetLogic';
import { dragSet, headerState, selectRange, toggleAll, toggleOne } from './selectionLogic';
import { generateSnippetsFor } from './generateBridge';

const EMPTY: never[] = [];
const cleanName = (c: SnippetCategory) => c.name.replace(/^negative\s*[·:\-–—]\s*/i, '');

export function ManageSnippets() {
  const manage = useTileEdit((s) => s.manage);
  const close = () => useTileEdit.setState({ manage: null });
  return <ManageModal key={manage === null ? 'closed' : 'open'} opened={manage !== null} start={manage ?? ''} onClose={close} />;
}

function ManageModal({ opened, start, onClose }: { opened: boolean; start: string; onClose: () => void }) {
  const phone = useIsPhone();
  const allSnippets = useStore((s) => s.snippets);
  const allCats = useStore((s) => s.snippetCategories);
  const cats = useMemo(() => allCats.filter((c) => !isModelSpecific({ id: '', categoryId: c.id })), [allCats]);
  const snippets = useMemo(() => allSnippets.filter((s) => !isModelSpecific(s)), [allSnippets]);
  const counts = useMemo(() => countByCategory(snippets, cats), [snippets, cats]);
  const [catId, setCatId] = useState(start && cats.some((c) => c.id === start) ? start : (cats[0]?.id ?? UNCATEGORIZED));
  const [pane, setPane] = useState<'cats' | 'snips'>(start ? 'snips' : 'cats');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // Snippet rows dragged onto a category (desktop): the ids carried and the category hovered.
  const [snipDrag, setSnipDrag] = useState<string[] | null>(null);
  const [dropCat, setDropCat] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  useEffect(() => { if (cat && cat.id !== catId) setCatId(cat.id); }, [cat, catId]);
  useEffect(() => { setPicked(new Set()); }, [catId, query]);

  const known = useMemo(() => new Set(cats.map((c) => c.id)), [cats]);
  const rows = useMemo(() => {
    if (query.trim()) return searchSnippets(snippets, query);
    return cat ? snippets.filter((s) => (known.has(s.categoryId) ? s.categoryId : UNCATEGORIZED) === cat.id) : EMPTY;
  }, [query, snippets, cat, known]);
  const catLabel = (c: SnippetCategory) => `${c.icon ? `${c.icon} ` : ''}${cleanName(c)}`;
  const [pendingMerge, setPendingMerge] = useState<string | null>(null);
  useEffect(() => { setPendingMerge(null); }, [catId]);
  const catKind: CatKind = cat ? categoryKind(cat, snippets) : 'any';
  // Merge targets: never itself; this kind first, the other kind as its own group (asks first).
  const mergeOptions = useMemo(() => (cat ? targetOptions(cats, snippets, catKind, cat.id, true, catLabel) : []), [cats, snippets, catKind, cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickedKind: CatKind = useMemo(() => {
    const ks = new Set(snippets.filter((s) => picked.has(s.id)).map((s) => s.kind));
    return ks.size === 1 ? (ks.has('negative') ? 'negative' : 'positive') : 'any';
  }, [snippets, picked]);
  const moveOptions = useMemo(() => targetOptions(cats, snippets, pickedKind, query ? null : (cat?.id ?? null), true, catLabel), [cats, snippets, pickedKind, query, cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const tryMerge = (into: string) => {
    const k = categoryKind(cats.find((c) => c.id === into) ?? { id: into }, snippets);
    if (catKind !== 'any' && k !== 'any' && k !== catKind) { setPendingMerge(into); return; }
    doMerge(into);
  };
  const doMerge = (into: string) => { if (!cat) return; setPendingMerge(null); mergeCategory(cat.id, into); setCatId(into); };
  const isUncat = cat?.id === UNCATEGORIZED;
  const gen = cat ? generateSnippetsFor(cat.id) : null;
  const sz = phone ? 'lg' : 'sm';

  const order = useMemo(() => rows.map((s) => s.id), [rows]);
  /** Tick a row; with Shift, the range from the last row ticked without Shift. */
  const pick = (id: string, shift: boolean) => {
    setPicked((p) => (shift ? selectRange(p, order, anchor.current, id) : toggleOne(p, id)));
    if (!shift) anchor.current = id;
  };
  const head = headerState(picked, order);
  const startSnipDrag = (e: React.DragEvent, id: string) => {
    const ids = dragSet(picked, order, id);
    setSnipDrag(ids);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-il-snippets', ids.join(','));
    e.dataTransfer.setData('text/plain', ids.length === 1 ? (snippets.find((s) => s.id === id)?.name ?? '') : `${ids.length} snippets`);
    // The drag badge: "N snippets" (or the one name).
    const badge = document.createElement('div');
    badge.textContent = ids.length === 1 ? (snippets.find((s) => s.id === id)?.name ?? '1 snippet') : `${ids.length} snippets`;
    Object.assign(badge.style, { position: 'fixed', top: '-1000px', left: '0', padding: '4px 12px', borderRadius: '999px', font: '800 12px Manrope, system-ui, sans-serif',
      background: 'var(--il-ember)', color: 'var(--il-bg)', whiteSpace: 'nowrap' });
    document.body.appendChild(badge);
    e.dataTransfer.setDragImage(badge, -10, -10);
    setTimeout(() => badge.remove(), 0);
  };
  const endSnipDrag = () => { setSnipDrag(null); setDropCat(null); };
  const pickCat = (id: string) => { setCatId(id); setQuery(''); setPane('snips'); };
  const newCat = () => { const id = addCategory('New category'); pickCat(id); };

  const catList = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 8px' }}>
        <b style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Categories</b>
        <Button tone="card" size={sz} icon={<IconPlus size={13} stroke={2.6} />} onClick={newCat}>New</Button>
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, touchAction: 'pan-y' }}>
        {cats.map((c, i) => {
          const on = !query && c.id === cat?.id;
          const fixed = c.id === UNCATEGORIZED;
          return (
            <div key={c.id} role="button" tabIndex={0} onClick={() => pickCat(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') pickCat(c.id); }}
              draggable={!fixed && !phone}
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }}
              onDragOver={(e) => {
                if (snipDrag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropCat !== c.id) setDropCat(c.id); return; }
                if (dragFrom === null) return; e.preventDefault(); setDragOver(i);
              }}
              onDragLeave={() => { if (snipDrag && dropCat === c.id) setDropCat(null); }}
              onDrop={(e) => {
                e.preventDefault();
                if (snipDrag) {
                  const moving = snipDrag.filter((id) => snippets.find((x) => x.id === id)?.categoryId !== c.id);
                  if (moving.length) { moveSnippets(moving, c.id); setPicked(new Set()); }
                  endSnipDrag(); return;
                }
                if (dragFrom !== null && dragFrom !== i) reorderCategory(dragFrom, i); setDragFrom(null); setDragOver(null);
              }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
              {...menuProps('snippet-category', c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, minHeight: phone ? 44 : 36, padding: '0 8px', borderRadius: 10, cursor: 'pointer',
                background: snipDrag && dropCat === c.id ? 'var(--il-ember-soft)' : on ? 'var(--il-card-on)' : 'transparent',
                outline: snipDrag && dropCat === c.id ? '1.5px solid var(--il-ember)' : 'none', outlineOffset: -1.5,
                color: fixed ? 'var(--il-muted)' : 'var(--il-fg)', fontSize: 12, fontWeight: 700,
                opacity: dragFrom === i ? 0.4 : 1,
                boxShadow: dragOver === i && dragFrom !== null && dragFrom !== i ? `inset 0 ${dragFrom < i ? -2 : 2}px 0 var(--il-ember)` : undefined,
              }}>
              {!phone && <IconGripVertical size={13} stroke={2} style={{ flex: 'none', color: 'var(--il-dim)', visibility: fixed ? 'hidden' : 'visible', cursor: 'grab' }} />}
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: `hsl(${categoryHue(c.id)} 55% 55%)` }} />
              <span style={{ flex: 'none', width: 18, textAlign: 'center' }}>{c.icon ?? ''}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanName(c)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)', fontVariantNumeric: 'tabular-nums' }}>{counts.get(c.id) ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const header = cat && !query && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <EmojiButton value={cat.icon ?? ''} disabled={isUncat} onPick={(icon) => updateCategory(cat.id, { icon: icon || undefined })} size={phone ? 44 : 36} />
        <input key={cat.id} aria-label="Category name" defaultValue={cleanName(cat)} readOnly={isUncat}
          onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== cleanName(cat)) updateCategory(cat.id, { name: v }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = cleanName(cat); e.currentTarget.blur(); e.stopPropagation(); } }}
          style={{ flex: 1, minWidth: 0, height: phone ? 44 : 36, borderRadius: 10, border: '1px solid var(--il-line-soft)', background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 14, fontWeight: 800, padding: '0 10px', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div role="radiogroup" aria-label="Category colour" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATEGORY_HUES.map((h) => {
          const on = categoryHue(cat.id) === h;
          return (
            <button key={h} type="button" role="radio" aria-checked={on} aria-label={`Colour ${h}`} onClick={() => updateCategory(cat.id, { hue: h })}
              style={{ width: phone ? 30 : 22, height: phone ? 30 : 22, borderRadius: '50%', border: 0, cursor: 'pointer', background: `hsl(${h} 55% 55%)`, display: 'grid', placeItems: 'center',
                outline: on ? '2px solid var(--il-fg)' : 'none', outlineOffset: 2, color: 'rgba(0,0,0,.6)' }}>
              {on && <IconCheck size={12} stroke={3.2} />}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {gen && <Button tone="card" size={sz} icon={<IconSparkles size={13} />} style={{ color: 'var(--il-ember-hi)' }} onClick={gen}>Generate snippets</Button>}
        {!isUncat && (
          <div style={{ width: phone ? 170 : 150 }}>
            <SearchSelect label="Merge into" value={null} placeholder="Merge into…" size={sz} options={mergeOptions} searchable={false}
              dropdownWidth={260} maxDropdownHeight={380} onChange={tryMerge} />
          </div>
        )}
        {!isUncat && <Button tone="ghost" size={sz} icon={<IconTrash size={13} />} style={{ color: 'var(--il-err)' }} tooltip="Delete category"
          onClick={() => { deleteCategory(cat.id); setCatId(UNCATEGORIZED); }}>Delete</Button>}
        <div style={{ flex: 1 }} />
        <Button tone="primary" size={sz} icon={<IconPlus size={13} stroke={2.6} />} onClick={() => useTileEdit.getState().edit(cat.id.startsWith('neg-') ? 'new-neg' : 'new', '', cat.id)}>Snippet</Button>
      </div>
    </div>
  );

  const into = pendingMerge ? cats.find((c) => c.id === pendingMerge) : undefined;
  const mergeAsk = cat && into && (
    <div role="alertdialog" aria-label="Merge across kinds" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, background: 'color-mix(in srgb, var(--il-warn, var(--il-ember)) 12%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 180, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>
        {catLabel(cat)} is a {catKind === 'negative' ? 'negative' : 'prompt'} category, {catLabel(into)} is {catKind === 'negative' ? 'a prompt' : 'a negative'} one. Merge anyway?
      </span>
      <Button tone="card" size={sz} onClick={() => setPendingMerge(null)}>Cancel</Button>
      <Button tone="primary" size={sz} onClick={() => doMerge(into.id)}>Merge</Button>
    </div>
  );

  // The list header: tri-state "select all" + count; the bulk actions when anything is ticked.
  const bulk = order.length > 0 && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: phone ? 48 : 36, padding: '2px 6px', borderRadius: 10,
      background: picked.size ? 'color-mix(in srgb, var(--il-ember) 13%, transparent)' : 'transparent' }}>
      <button type="button" role="checkbox" aria-checked={head === 'all' ? true : head === 'some' ? 'mixed' : false} aria-label={head === 'all' ? 'Select none' : 'Select all'}
        onClick={() => { setPicked((p) => toggleAll(p, order)); anchor.current = null; }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: phone ? 44 : 30, border: 0, background: 'transparent', color: 'var(--il-fg2)', padding: '0 4px 0 5px', cursor: 'pointer', font: 'inherit' }}>
        <CheckBox state={head} />
        <span style={{ fontSize: 12, fontWeight: 800, color: picked.size ? 'var(--il-ember-hi)' : 'var(--il-muted)' }}>
          {picked.size ? `${picked.size} selected` : 'Select all'}
        </span>
      </button>
      {picked.size > 0 && head !== 'all' && <Button tone="ghost" size={sz} onClick={() => setPicked((p) => new Set([...p, ...order]))}>All</Button>}
      {picked.size > 0 && <Button tone="ghost" size={sz} onClick={() => setPicked(new Set())}>None</Button>}
      <div style={{ flex: 1 }} />
      {picked.size > 0 && <>
        <div style={{ width: phone ? 150 : 140 }}>
          <SearchSelect label="Move to" value={null} placeholder="Move to…" size={sz} options={moveOptions} searchable={false} dropdownWidth={260} maxDropdownHeight={380}
            position="bottom-end" onChange={(to) => { moveSnippets(picked, to); setPicked(new Set()); }} />
        </div>
        <Button tone="card" size={sz} icon={<IconCopy size={13} />} onClick={() => { duplicateSnippets(picked); setPicked(new Set()); }}>Duplicate</Button>
        <Button tone="ghost" size={sz} icon={<IconTrash size={13} />} style={{ color: 'var(--il-err)' }} onClick={() => { deleteSnippets(picked); setPicked(new Set()); }}>Delete</Button>
      </>}
      {!picked.size && !phone && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-dim)', paddingRight: 4 }}>Drag rows onto a category to move them</span>}
    </div>
  );

  const list = (
    <div className="il-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, touchAction: 'pan-y', marginTop: 4 }}>
      {rows.length === 0 && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '14px 4px' }}>{query ? 'No snippet matches.' : 'No snippets here yet — + Snippet.'}</div>}
      {rows.map((s) => (
        <SnipRow key={s.id} s={s} picked={picked.has(s.id)} onPick={(shift) => pick(s.id, shift)} catName={query ? cats.find((c) => c.id === s.categoryId) : undefined} phone={phone}
          dragging={!!snipDrag && snipDrag.includes(s.id)} onDragStart={(e) => startSnipDrag(e, s.id)} onDragEnd={endSnipDrag} />
      ))}
    </div>
  );

  const search = (
    <label style={{ height: phone ? 44 : 34, borderRadius: 10, background: 'var(--il-bg-deep)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 0 10px', flex: 'none' }}>
      <IconSearch size={14} stroke={2.4} style={{ color: 'var(--il-dim)', flex: 'none' }} />
      <input value={query} onChange={(e) => { setQuery(e.target.value); if (phone && e.target.value) setPane('snips'); }} placeholder="Search every snippet" aria-label="Search every snippet"
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
      {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ width: 24, height: 24, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={12} stroke={2.6} /></button>}
    </label>
  );

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={940} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }}
      styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)', overflow: 'hidden' } }}>
      <div data-no-swipe style={{ display: 'flex', flexDirection: 'column', height: phone ? dvh(100) : `min(640px, ${vh(88)})`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: phone ? '10px 12px' : '14px 16px 10px', borderBottom: '1px solid var(--il-line-soft)', flex: 'none' }}>
          {phone && pane === 'snips' && <Button tone="ghost" size="lg" icon={<IconArrowLeft size={16} />} aria-label="Categories" onClick={() => { setPane('cats'); setQuery(''); }} />}
          <div style={{ fontSize: 16, fontWeight: 800, flex: 'none' }}>Snippets</div>
          <div style={{ flex: 1, minWidth: 0 }}>{(!phone || pane === 'cats' || query) && search}</div>
          <Button tone="ghost" size={sz} icon={<IconX size={15} />} aria-label="Close" onClick={onClose} />
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {(!phone || pane === 'cats') && (
            <div style={{ width: phone ? '100%' : 260, flex: 'none', borderRight: phone ? 0 : '1px solid var(--il-line-soft)', padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{catList}</div>
          )}
          {(!phone || pane === 'snips') && (
            <div style={{ flex: 1, minWidth: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              {query ? <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-muted)' }}>{rows.length} found</div> : header}
              {!query && mergeAsk}
              {bulk}
              {list}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CheckBox({ state }: { state: 'none' | 'some' | 'all' }) {
  const on = state !== 'none';
  return (
    <span aria-hidden style={{ width: 18, height: 18, flex: 'none', borderRadius: 5, border: `1.5px solid ${on ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, background: on ? 'var(--il-ember)' : 'transparent', display: 'grid', placeItems: 'center', color: 'var(--il-bg)' }}>
      {state === 'all' && <IconCheck size={12} stroke={3.2} />}
      {state === 'some' && <IconMinus size={12} stroke={3.2} />}
    </span>
  );
}

function SnipRow({ s, picked, onPick, catName, phone, dragging, onDragStart, onDragEnd }: {
  s: Snippet; picked: boolean; onPick: (shift: boolean) => void; catName?: SnippetCategory; phone: boolean;
  dragging: boolean; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void;
}) {
  const open = () => useTileEdit.getState().edit(s.id);
  return (
    <div {...menuProps('style-tile', s)} draggable={!phone} onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: phone ? 56 : 46, padding: '4px 6px', borderRadius: 10, opacity: dragging ? 0.45 : 1,
        background: picked ? 'color-mix(in srgb, var(--il-ember) 8%, transparent)' : 'transparent', cursor: phone ? undefined : 'grab' }}
      className="il-snip-row">
      <button type="button" role="checkbox" aria-checked={picked} aria-label={`Select ${s.name}`} onClick={(e) => onPick(e.shiftKey)}
        style={{ width: phone ? 40 : 28, height: phone ? 40 : 28, flex: 'none', border: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
        <CheckBox state={picked ? 'all' : 'none'} />
      </button>
      <div role="button" tabIndex={0} title="Edit" onClick={(e) => (e.shiftKey ? onPick(true) : open())}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'transparent', color: 'var(--il-fg)', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 9, flex: 'none', background: s.image ? `center / cover no-repeat url("${s.image}")` : tileBackground(tileHue(s)) }} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <b style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.name}{s.kind === 'negative' && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--il-err)', marginLeft: 6 }}>negative</span>}
            {catName && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-dim)', marginLeft: 6 }}>{catName.icon ?? ''} {cleanName(catName)}</span>}
          </b>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{previewText(s)}</span>
        </span>
      </div>
      <button type="button" aria-label="More" onClick={(e) => openMenu('style-tile', s, e.currentTarget)}
        style={{ width: phone ? 40 : 28, height: phone ? 40 : 28, flex: 'none', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <IconDots size={15} />
      </button>
    </div>
  );
}

function EmojiButton({ value, onPick, disabled, size }: { value: string; onPick: (v: string) => void; disabled?: boolean; size: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  return (
    <Popover opened={open && !disabled} onChange={setOpen} position="bottom-start" withinPortal zIndex={T.z.popover} shadow="md" radius={12}>
      <Popover.Target>
        <button type="button" aria-label="Category icon" disabled={disabled} onClick={() => setOpen((o) => !o)}
          style={{ width: size, height: size, flex: 'none', borderRadius: 10, border: '1px solid var(--il-line-soft)', background: 'var(--il-card)', fontSize: 18, cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
          {value || '＋'}
        </button>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-elev)', border: '1px solid var(--il-line-strong)', padding: 8, width: 236 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {CATEGORY_EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => { onPick(e); setOpen(false); }}
              style={{ height: 34, border: 0, borderRadius: 8, background: e === value ? 'var(--il-card-on)' : 'transparent', fontSize: 18, cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type one" aria-label="Icon text" maxLength={4}
            onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) { onPick(typed.trim()); setOpen(false); setTyped(''); } }}
            style={{ flex: 1, minWidth: 0, height: 30, borderRadius: 8, border: '1px solid var(--il-line-soft)', background: 'var(--il-bg-deep)', color: 'var(--il-fg)', padding: '0 8px', fontFamily: 'inherit', outline: 'none' }} />
          {value && <Button tone="ghost" size="sm" onClick={() => { onPick(''); setOpen(false); }}>None</Button>}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
