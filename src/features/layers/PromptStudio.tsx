import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Layer, LayerKind } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useCollapsed } from '@/hooks/useCollapsed';
import { compileLayers } from '@/lib/prompt';
import { cn } from '@/lib/cn';
import {
  CheckIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon, CopyIcon,
  SearchIcon, SparkleIcon,
} from '@/components/ui/icons';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { LayerCard } from './LayerCard';
import { PromptGeneratorButton } from './PromptGeneratorButton';

/** Search only earns its space once there is a lot to search. */
const SEARCH_AT = 8;
/** How long "Deleted · Undo" stays up. */
const UNDO_MS = 8000;

/**
 * The Prompt tab: positive layers, negative layers, and what they compile to.
 *
 * Two plain sections, each ending in its own Add and Library, so adding to the negative list is
 * never "switch a filter, then press a button at the top". Every card is open and editable in
 * place (see LayerCard). Delete comes with an undo, because on a trackpad a stray click is cheap
 * and a lost prompt is not.
 */
export function PromptStudio({ onOpenLibrary }: { onOpenLibrary: (kind: LayerKind) => void }) {
  const layers = useStore(s => s.layers);
  const addLayer = useStore(s => s.addLayer);
  const removeLayer = useStore(s => s.removeLayer);
  const restoreLayer = useStore(s => s.restoreLayer);
  const requestLayerFocus = useStore(s => s.requestLayerFocus);

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const positive = useMemo(() => layers.filter(l => l.kind === 'positive'), [layers]);
  const negative = useMemo(() => layers.filter(l => l.kind === 'negative'), [layers]);
  const matches = (l: { tag: string; text: string }) =>
    !q || l.tag.toLowerCase().includes(q) || l.text.toLowerCase().includes(q);

  // The last delete, kept long enough to take back.
  const [removed, setRemoved] = useState<{ layer: Layer; index: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const id = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [removed]);
  const onDelete = (layer: Layer) => {
    const index = useStore.getState().layers.findIndex(l => l.id === layer.id);
    // Read the layer from the store, not the prop: the card flushed its last keystrokes into it.
    const latest = useStore.getState().layers[index] ?? layer;
    removeLayer(layer.id);
    setRemoved({ layer: latest, index });
  };

  // No title: a prompt is its text. The store's default tag is for the library, not asked for here.
  const add = (kind: LayerKind, text: string) => {
    const id = addLayer(kind, { tag: '', text });
    requestLayerFocus(id);
    return id;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <PromptGeneratorButton />
        {layers.length >= SEARCH_AT && (
          <div className="relative ml-auto min-w-0 flex-1">
            <SearchIcon size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter layers"
              aria-label="Filter layers"
              className="h-8 w-full rounded-md border border-border-default bg-bg-input pl-7 pr-7 text-[12px] text-fg-secondary placeholder:text-fg-dim outline-none focus:border-accent"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear filter"
                className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-fg-dim hover:text-fg-secondary"
              >
                <CloseIcon size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      <KindSection
        kind="positive"
        label="Positive"
        layers={positive}
        visible={positive.filter(matches)}
        query={q}
        onCreate={text => add('positive', text)}
        onOpenLibrary={() => onOpenLibrary('positive')}
        onDelete={onDelete}
      />
      <KindSection
        kind="negative"
        label="Negative"
        layers={negative}
        visible={negative.filter(matches)}
        query={q}
        onCreate={text => add('negative', text)}
        onOpenLibrary={() => onOpenLibrary('negative')}
        onDelete={onDelete}
      />

      <FinalPromptHeader />

      {removed && (
        <div
          role="status"
          className="sticky bottom-2 z-20 flex items-center gap-3 rounded-lg border border-border-default bg-bg-elev px-3 py-2 text-[12px] text-fg-secondary shadow-xl"
        >
          <span className="min-w-0 flex-1 truncate">
            Deleted “<span className="font-semibold">{removed.layer.text.trim().slice(0, 32) || 'empty prompt'}</span>”
          </span>
          <button
            type="button"
            onClick={() => { restoreLayer(removed.layer, removed.index); setRemoved(null); }}
            className="shrink-0 rounded-md px-2 py-1 font-semibold text-accent-fg hover:bg-accent-soft"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}



// ---------------------------------------------------------------------------
// The empty box at the end of each list. Typing into it IS adding a prompt:
// the first keystroke turns it into a real layer and the caret moves there.
// ---------------------------------------------------------------------------

function NewPrompt({ kind, onCreate }: { kind: LayerKind; onCreate: (text: string) => string }) {
  const updateLayer = useStore(s => s.updateLayer);
  // Keys typed before the caret has moved to the new card still belong to that one layer; without
  // this, fast typing would make a second layer from the second keystroke.
  const [value, setValue] = useState('');
  const created = useRef<string | null>(null);
  return (
    <textarea
      value={value}
      rows={2}
      spellCheck={false}
      onChange={e => {
        const text = e.target.value;
        setValue(text);
        if (!text) return;
        if (created.current) updateLayer(created.current, { text });
        else created.current = onCreate(text);
      }}
      // Focus moves to the new card: this box is empty and ready for the next one.
      onBlur={() => { setValue(''); created.current = null; }}
      aria-label={`New ${kind} prompt`}
      placeholder={kind === 'positive' ? '+ Type a new prompt…' : '+ Type a new negative prompt…'}
      className={cn(
        'min-h-[3.25rem] w-full resize-none rounded-lg border border-dashed bg-transparent px-3 py-2 text-[13px] leading-relaxed outline-none',
        'placeholder:text-fg-muted focus:bg-bg-input',
        kind === 'negative' ? 'border-coral-fg/40 focus:border-coral-fg' : 'border-accent/40 focus:border-accent',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// One kind's layers: heading, sortable cards, and its own Add / Library.
// ---------------------------------------------------------------------------

function KindSection({
  kind, label, layers, visible, query, onCreate, onOpenLibrary, onDelete,
}: {
  kind: LayerKind;
  label: string;
  layers: Layer[];
  visible: Layer[];
  query: string;
  onCreate: (text: string) => string;
  onOpenLibrary: () => void;
  onDelete: (layer: Layer) => void;
}) {
  const reorderLayers = useStore(s => s.reorderLayers);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const toId = e.over ? String(e.over.id) : null;
    if (toId) reorderLayers(kind, String(e.active.id), toId);
  };

  const on = layers.filter(l => l.on).length;
  const hidden = layers.length - visible.length;

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline gap-2 px-0.5">
        <h3 className={cn(
          'text-[11px] font-semibold uppercase tracking-section',
          kind === 'negative' ? 'text-coral-fg' : 'text-accent-fg',
        )}>
          {label}
        </h3>
        <span className="text-[11px] text-fg-dim tabular-nums">
          {layers.length === 0 ? 'none' : on === layers.length ? `${on}` : `${on} of ${layers.length} on`}
        </span>
        {hidden > 0 && <span className="text-[11px] text-fg-dim">· {hidden} filtered out</span>}
      </header>

      {layers.length > 0 && visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-default px-3 py-3 text-center text-[12px] italic text-fg-muted">
          No {kind} layers match “{query}”.
        </p>
      )}

      {visible.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={layers.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {visible.map(l => (
                <LayerCard
                  key={l.id}
                  layer={l}
                  onDelete={() => onDelete(l)}
                  canMoveUp={layers[0]?.id !== l.id}
                  canMoveDown={layers[layers.length - 1]?.id !== l.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <NewPrompt kind={kind} onCreate={onCreate} />
      <button
        type="button"
        onClick={onOpenLibrary}
        title={`Add ${kind} prompts from saved presets`}
        className="self-start rounded-md px-1.5 py-1 text-[11.5px] text-fg-muted transition-colors hover:bg-bg-elev hover:text-fg-secondary"
      >
        Browse presets
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final prompt header — collapsible, with positive/negative tab switcher and
// a single textarea body driven by the selected tab. Replaces the always-
// visible two-textarea stack that ate vertical space.
// ---------------------------------------------------------------------------

function FinalPromptHeader() {
  const layers = useStore(s => s.layers);
  const positive = useMemo(() => compileLayers(layers, 'positive'), [layers]);
  const negative = useMemo(() => compileLayers(layers, 'negative'), [layers]);

  const [collapsed, toggleCollapsed] = useCollapsed('promptStudio.finalPrompt', true);
  const [tab, setTab] = useState<'positive' | 'negative'>('positive');

  const text = tab === 'positive' ? positive : negative;
  const placeholder = tab === 'positive' ? '(no enabled positive layers)' : '(no enabled negative layers)';
  const { copy, isCopied } = useCopyToClipboard(1100);
  const copied = isCopied();

  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-bg-card/40">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 px-2.5 py-2 text-left"
      >
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-fg-muted">
          {collapsed ? <ChevronRightIcon size={11} /> : <ChevronDownIcon size={11} />}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-section text-fg-dim">Final prompt</span>
        <span className="text-[10px] text-fg-faint">compiled · read-only</span>
        {collapsed && (
          <span className="ml-auto flex items-center gap-1.5 text-[10.5px] text-fg-muted">
            <SparkleIcon size={11} className="text-accent-fg" />
            {positive ? positive.split(',').length : 0} pos · {negative ? negative.split(',').length : 0} neg
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border-default bg-bg-input p-0.5">
              {(['positive', 'negative'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    'rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tag transition-colors',
                    tab === t
                      ? (t === 'negative' ? 'bg-coral-bg text-coral-fg' : 'bg-accent text-white')
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { if (text) void copy(text); }}
              disabled={!text}
              className="ml-auto flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-fg-dim transition-colors hover:bg-bg-elev hover:text-fg-secondary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-dim"
            >
              {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className={cn(
            'max-h-[160px] overflow-auto whitespace-pre-wrap rounded-md border border-border-default bg-bg-input px-3 py-2 font-mono text-[11px] leading-relaxed',
            tab === 'negative' ? 'text-coral-fg' : 'text-accent-fg',
            !text && 'italic text-fg-dim',
          )}>
            {text || placeholder}
          </pre>
        </div>
      )}
    </section>
  );
}
