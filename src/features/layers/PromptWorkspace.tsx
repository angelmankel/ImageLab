import { useState } from 'react';
import { useStore } from '@/lib/store';
import { DEFAULT_CATEGORY_ID, uid } from '@/lib/storage';
import { applyPromptPreset } from '@/lib/promptPresets';
import type { LayerKind, Snippet } from '@/lib/types';
import { ControlSection } from '@/features/controls/ControlSection';
import { PromptStudio } from './PromptStudio';

const button = 'min-h-9 rounded-md border border-border-default px-2.5 text-xs font-medium text-fg-secondary hover:border-accent hover:text-accent-fg disabled:opacity-40';
const input = 'min-h-10 w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-xs text-fg-primary outline-none focus:border-accent';

export function PromptWorkspace() {
  const layers = useStore(s => s.layers);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [filter, setFilter] = useState<LayerKind | 'all'>('all');
  return <ControlSection id="workspace-prompts" title="Prompts" summary={`${layers.filter(l => l.on && l.text.trim()).length} active parts`}
    expandOn={presetsOpen} action={<button type="button" className={button} aria-label="Browse prompt presets" aria-expanded={presetsOpen} onClick={() => { setFilter('all'); setPresetsOpen(!presetsOpen); }}>Presets</button>}>
    {presetsOpen && <PresetBrowser filter={filter} setFilter={setFilter} onClose={() => setPresetsOpen(false)} />}
    <PromptStudio onOpenLibrary={kind => { setFilter(kind); setPresetsOpen(true); }} />
  </ControlSection>;
}

function PresetBrowser({ filter, setFilter, onClose }: {
  filter: LayerKind | 'all'; setFilter: (kind: LayerKind | 'all') => void; onClose: () => void;
}) {
  const presets = useStore(s => s.snippets);
  const categories = useStore(s => s.snippetCategories);
  const layers = useStore(s => s.layers);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; run: () => void } | null>(null);
  const q = query.trim().toLowerCase();
  const visible = presets.filter(p => (filter === 'all' || p.kind === filter || p.layers?.some(l => l.kind === filter))
    && (!category || p.categoryId === category)
    && `${p.name} ${p.tag} ${p.text} ${p.layers?.map(l => l.text).join(' ') || ''}`.toLowerCase().includes(q));
  const apply = (preset: Snippet, mode: 'insert' | 'replace') => {
    const before = useStore.getState().layers;
    useStore.getState().setPromptLayers(applyPromptPreset(before, preset, mode, uid));
    setUndo({ label: `${mode === 'insert' ? 'Inserted' : 'Replaced with'} “${preset.name}”`, run: () => useStore.getState().setPromptLayers(before) });
  };
  const save = () => {
    if (!name.trim() || !layers.some(l => l.text.trim())) return;
    useStore.getState().addSnippet({
      name: name.trim(), text: layers.filter(l => l.kind === 'positive').map(l => l.text).join(', '),
      kind: 'positive', tag: '', weight: 1, categoryId: category || DEFAULT_CATEGORY_ID,
      layers: layers.map(({ kind, text, tag, weight, on }) => ({ kind, text, tag, weight, on })),
    });
    setName(''); setQuery(''); setFilter('all');
  };
  return <div className="mb-3 flex flex-col gap-2 rounded-lg border border-accent/30 bg-bg-panel p-2.5" aria-label="Prompt presets">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-fg-primary">Saved prompts <span className="font-normal text-fg-muted">{presets.length}</span></span><button type="button" className="min-h-8 px-2 text-xs text-fg-muted" onClick={onClose}>Close</button></div>
    <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names or prompt text…" aria-label="Search prompt presets" className={input} />
    <div className="flex gap-2">
      <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label="Preset type" className={input}><option value="all">All prompts</option><option value="positive">Positive</option><option value="negative">Negative</option></select>
      <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Preset category" className={input}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </div>
    <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain">
      {!visible.length && <p className="py-4 text-center text-xs text-fg-muted">{presets.length ? 'No matching presets.' : 'Save your current prompt below to start.'}</p>}
      {visible.map(preset => <div key={preset.id} className="rounded-lg border border-border-subtle bg-bg-elev p-2.5">
        <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-fg-primary">{preset.name}</span><span className="shrink-0 text-[10px] text-fg-muted">{preset.layers ? 'Full prompt' : preset.kind}</span></div>
        <p className="my-2 line-clamp-2 text-xs leading-relaxed text-fg-muted">{preset.layers?.map(l => l.text).join(' · ') || preset.text}</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={button} aria-label={`Insert preset ${preset.name}`} onClick={() => apply(preset, 'insert')}>Insert</button>
          <button type="button" className={button} aria-label={`Replace with preset ${preset.name}`} onClick={() => apply(preset, 'replace')}>{preset.layers ? 'Replace prompt' : `Replace ${preset.kind}`}</button>
          <button type="button" className={button} aria-expanded={editing === preset.id} onClick={() => setEditing(editing === preset.id ? null : preset.id)}>Edit</button>
        </div>
        {editing === preset.id && <div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-2">
          <input className={input} aria-label="Preset name" value={preset.name} onChange={e => useStore.getState().updateSnippet(preset.id, { name: e.target.value })} />
          {preset.layers ? preset.layers.map((part, i) => <label key={i} className="text-xs text-fg-muted">{part.kind}<textarea className={input} rows={3} value={part.text} onChange={e => useStore.getState().updateSnippet(preset.id, { layers: preset.layers!.map((l, j) => j === i ? { ...l, text: e.target.value } : l) })} /></label>) : <textarea aria-label="Preset text" className={input} rows={3} value={preset.text} onChange={e => useStore.getState().updateSnippet(preset.id, { text: e.target.value })} />}
          <button type="button" className="min-h-9 text-left text-xs text-status-err" onClick={() => { useStore.getState().removeSnippet(preset.id); setUndo({ label: `Deleted “${preset.name}”`, run: () => { const { id: _id, ...saved } = preset; useStore.getState().addSnippet(saved); } }); }}>Delete preset</button>
        </div>}
      </div>)}
    </div>
    <form className="flex gap-2 border-t border-border-subtle pt-2" onSubmit={e => { e.preventDefault(); save(); }}>
      <input value={name} onChange={e => setName(e.target.value)} aria-label="New preset name" placeholder="Name this prompt…" className={input} />
      <button type="submit" aria-label="Save current prompt as preset" className={`${button} shrink-0`} disabled={!name.trim() || !layers.some(l => l.text.trim())}>Save current</button>
    </form>
    {undo && <div role="status" className="flex items-center justify-between gap-2 text-xs text-accent-fg"><span className="truncate">{undo.label}</span><button type="button" className="min-h-9 shrink-0 px-2 font-semibold" onClick={() => { undo.run(); setUndo(null); }}>Undo</button></div>}
  </div>;
}
