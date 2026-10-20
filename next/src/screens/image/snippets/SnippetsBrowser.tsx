/**
 * Rule 6: "Browse all →" — the whole snippet library for one prompt kind, in the next look. One
 * big window (≈ 94vw × 92vh, like ModelsModal) on the desktop, full screen with a top Back on the
 * phone. Search on top; categories down the left (desktop) or as a sideways tab row (phone), each
 * with its count and how many are in the prompt; tiles for the snippets (tap = toggle, edit and
 * delete with Undo per tile); add a snippet; add or rename a category. Logic is the main store's.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { Modal } from '@mantine/core';
import { IconChevronLeft, IconPencil, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { LayerKind, SnippetCategory } from '@/lib/types';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { Chip } from '~/ui';
import { UNCATEGORIZED, categoriesWith, categoryCounts, inCategory, ofKind, searchSnippets } from './snippetLogic';
import { addAndInsert, deleteWithUndo, toggleSnippet, useInPrompt } from './snippetActions';
import { SnippetForm } from './SnippetForm';
import { SnippetTile } from './SnippetTile';

const ALL = '__all__';
type CatEdit = { mode: 'add' } | { mode: 'rename'; id: string } | null;

const inputStyle: CSSProperties = {
  flex: 1, minWidth: 0, height: 34, border: '1px solid var(--il-line-soft)', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)',
  fontSize: 12, fontWeight: 600, padding: '0 12px 0 32px', outline: 'none', fontFamily: 'inherit',
};

export function SnippetsBrowser({ opened, onClose, kind }: { opened: boolean; onClose: () => void; kind: LayerKind }) {
  const phone = useIsPhone();
  const heading = kind === 'negative' ? 'Negative snippets' : 'Snippets';
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      fullScreen={phone}
      centered
      size={phone ? undefined : '94vw'}
      zIndex={T.z.modal}
      radius={phone ? 0 : T.radius.xl}
      padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }}
      transitionProps={{ transition: 'pop', duration: 160 }}
      styles={{
        content: { background: 'var(--il-bg)', border: phone ? 0 : '1px solid var(--il-line-soft)', height: phone ? '100dvh' : '92vh', maxHeight: phone ? '100dvh' : '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' },
      }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {phone ? (
          <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderBottom: '1px solid var(--il-line)' }}>
            <button type="button" onClick={onClose} aria-label="Back" style={{ height: 40, padding: '0 12px 0 6px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <IconChevronLeft size={18} stroke={2.6} />Back
            </button>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{heading}</span>
            <span style={{ width: 76 }} />
          </div>
        ) : (
          <div style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 16px', borderBottom: '1px solid var(--il-line)' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{heading}</span>
            <span className="il-eyebrow">· tap to put in the prompt, tap again to take out</span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={16} stroke={2.4} /></button>
          </div>
        )}
        {opened && <Browser kind={kind} phone={phone} />}
      </div>
    </Modal>
  );
}

/** The window's body: state lives here so it resets each time the window opens. */
function Browser({ kind, phone }: { kind: LayerKind; phone: boolean }) {
  const snippets = useStore((s) => s.snippets);
  const categories = useStore((s) => s.snippetCategories);
  const inPrompt = useInPrompt();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>(ALL);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [catEdit, setCatEdit] = useState<CatEdit>(null);

  const mine = useMemo(() => ofKind(snippets, kind), [snippets, kind]);
  const counts = useMemo(() => categoryCounts(mine, categories, inPrompt), [mine, categories, inPrompt]);
  const shown = useMemo(() => searchSnippets(cat === ALL ? mine : inCategory(mine, categories, cat), query), [mine, categories, cat, query]);
  const current = cat === ALL ? null : categories.find((c) => c.id === cat) ?? null;
  // Categories with snippets of this kind, plus the picked one even while it is still empty (just made).
  const listed = useMemo(() => { const l = categoriesWith(categories, mine); return current && !l.includes(current) ? [...l, current] : l; }, [categories, mine, current]);
  const defaultCategory = current?.id ?? categories.find((c) => c.id === UNCATEGORIZED)?.id ?? categories[0]?.id ?? UNCATEGORIZED;
  const allOn = useMemo(() => mine.filter((s) => inPrompt.has(s.id)).length, [mine, inPrompt]);

  const pickCat = (id: string) => { setCat(id); setEditing(null); setCatEdit(null); };
  const saveCat = (name: string) => {
    const st = useStore.getState();
    if (catEdit?.mode === 'add') { const id = st.addSnippetCategory(name); setCat(id); }
    else if (catEdit?.mode === 'rename') st.updateSnippetCategory(catEdit.id, { name });
    setCatEdit(null);
  };

  const catRow = (c: SnippetCategory | null) => {
    const n = c ? counts.get(c.id) : { total: mine.length, on: allOn };
    return { id: c?.id ?? ALL, label: c ? (c.icon ? `${c.icon} ${c.name}` : c.name) : 'All', total: n?.total ?? 0, on: n?.on ?? 0 };
  };
  const rows = [catRow(null), ...listed.map(catRow)];

  const catEditor = catEdit && (
    <CategoryInput key={catEdit.mode === 'rename' ? catEdit.id : 'add'} initial={catEdit.mode === 'rename' ? current?.name ?? '' : ''}
      placeholder={catEdit.mode === 'add' ? 'New category' : 'Category name'} onSave={saveCat} onCancel={() => setCatEdit(null)} />
  );

  const tiles = (
    <div className="il-scroll" data-no-swipe style={{ flex: 1, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', padding: phone ? '0 12px 24px' : '0 16px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${phone ? 150 : 210}px, 1fr))`, gap: 8 }}>
        {adding && (
          <div style={{ gridColumn: '1 / -1' }}>
            <SnippetForm categories={categories} defaultCategory={defaultCategory} saveLabel="Save & add" onCancel={() => setAdding(false)}
              onSave={(v) => { addAndInsert({ ...v, kind }); setAdding(false); }} />
          </div>
        )}
        {shown.map((s) => editing === s.id ? (
          <div key={s.id} style={{ gridColumn: '1 / -1' }}>
            <SnippetForm initial={s} categories={categories} defaultCategory={s.categoryId} onCancel={() => setEditing(null)}
              onSave={(v) => { useStore.getState().updateSnippet(s.id, v); setEditing(null); }} />
          </div>
        ) : (
          <SnippetTile key={s.id} snippet={s} on={inPrompt.has(s.id)} phone={phone} onToggle={() => toggleSnippet(s, inPrompt.has(s.id))}
            onEdit={() => { setAdding(false); setEditing(s.id); }} onDelete={() => deleteWithUndo(s)} />
        ))}
        {!shown.length && !adding && (
          <div style={{ gridColumn: '1 / -1', padding: '28px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-dim)' }}>
            {query.trim() ? 'Nothing matches.' : 'Nothing here yet — add one.'}
          </div>
        )}
      </div>
    </div>
  );

  const searchRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: phone ? '10px 12px 8px' : '12px 16px 10px', flex: 'none' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
        <IconSearch size={14} stroke={2.4} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--il-muted)', pointerEvents: 'none' }} />
        <input aria-label="Search snippets" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search snippets" style={inputStyle} />
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ position: 'absolute', right: 6, top: 6, width: 22, height: 22, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={12} stroke={2.6} /></button>}
      </div>
      <Chip dashed on={adding} icon={<IconPlus size={13} stroke={2.6} />} onClick={() => { setEditing(null); setAdding((v) => !v); }} style={{ flex: 'none' }}>New snippet</Chip>
    </div>
  );

  if (phone) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {searchRow}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 8px', flex: 'none' }}>
          <div className="il-scroll-x" data-no-swipe style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, touchAction: 'pan-x pan-y' }}>
            {rows.map((r) => <Chip key={r.id} small on={r.id === cat} onClick={() => pickCat(r.id)} style={{ flex: 'none' }}>{r.label}<Count on={r.on} total={r.total} /></Chip>)}
            <Chip small dashed onClick={() => setCatEdit({ mode: 'add' })} style={{ flex: 'none' }}>+ Category</Chip>
          </div>
          {current && <IconOnly label={`Rename ${current.name}`} onClick={() => setCatEdit({ mode: 'rename', id: current.id })} />}
        </div>
        {catEditor && <div style={{ padding: '0 12px 8px' }}>{catEditor}</div>}
        {tiles}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ width: 220, flex: 'none', borderRight: '1px solid var(--il-line)', display: 'flex', flexDirection: 'column', background: 'var(--il-panel)' }}>
        <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((r) => {
            const on = r.id === cat;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button type="button" onClick={() => pickCat(r.id)} aria-pressed={on}
                  style={{ flex: 1, minWidth: 0, height: 34, padding: '0 10px', border: 0, borderRadius: 10, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-fg2)', fontSize: 12, fontWeight: 800 }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                  <Count on={r.on} total={r.total} />
                </button>
                {on && r.id !== ALL && <IconOnly label={`Rename ${r.label}`} onClick={() => setCatEdit({ mode: 'rename', id: r.id })} />}
              </div>
            );
          })}
          {catEdit?.mode === 'rename' && catEditor}
        </div>
        <div style={{ flex: 'none', padding: 8, borderTop: '1px solid var(--il-line)' }}>
          {catEdit?.mode === 'add' ? catEditor : <Chip dashed icon={<IconPlus size={13} stroke={2.6} />} onClick={() => setCatEdit({ mode: 'add' })} style={{ width: '100%', justifyContent: 'center' }}>New category</Chip>}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {searchRow}
        {tiles}
      </div>
    </div>
  );
}

/** "3 · 1 on": the category's size and how many of its snippets are in the prompt. */
function Count({ on, total }: { on: number; total: number }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color: on ? 'var(--il-ember-hi)' : 'var(--il-dim)', flex: 'none' }}>
      {total}{on > 0 ? ` · ${on} on` : ''}
    </span>
  );
}

function IconOnly({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      style={{ width: 28, height: 28, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
      <IconPencil size={13} stroke={2.2} />
    </button>
  );
}

/** One-line name box for adding or renaming a category: Enter saves, Escape cancels. */
function CategoryInput({ initial, placeholder, onSave, onCancel }: { initial: string; placeholder: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  return (
    <div data-no-swipe style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input autoFocus aria-label={placeholder} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && ok) onSave(name.trim()); if (e.key === 'Escape') onCancel(); }}
        style={{ ...inputStyle, height: 30, padding: '0 10px' }} />
      <button type="button" onClick={() => ok && onSave(name.trim())} disabled={!ok} style={{ height: 28, padding: '0 10px', border: 0, borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontSize: 11, fontWeight: 800, cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.45 }}>Save</button>
      <button type="button" aria-label="Cancel" onClick={onCancel} style={{ width: 28, height: 28, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={13} stroke={2.6} /></button>
    </div>
  );
}
