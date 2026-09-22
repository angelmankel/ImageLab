import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFlash } from '@/hooks/useFlash';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Layer } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';
import {
  ArrowDownIcon, ArrowUpIcon, CheckIcon, CopyIcon, MinusIcon, MoreIcon, PlusIcon, SparkleIcon, StarIcon, TrashIcon,
} from '@/components/ui/icons';
import { tweakPromptFragment } from '@/lib/venice';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';

/**
 * One prompt layer: a text box and a thin row of controls under it.
 *
 *   ⠿ ┌ the prompt text, several lines, growing with its content ┐
 *     └────────────────────────────────────────────────────────────┘
 *     [on]  − 1.00 +                                      ⋯   🗑
 *
 * The text is the whole point, so it comes first and gets the space. There is no title to fill in
 * (a layer's `tag` still exists for the library, it is just not asked for here), every change is
 * saved as it is typed, and delete is one click with an undo from the panel.
 */

function DragDots() {
  return (
    <svg viewBox="0 0 8 12" width="10" height="15" aria-hidden className="shrink-0">
      <g fill="currentColor">
        <circle cx="1.5" cy="1.5" r="1" />
        <circle cx="6.5" cy="1.5" r="1" />
        <circle cx="1.5" cy="6"   r="1" />
        <circle cx="6.5" cy="6"   r="1" />
        <circle cx="1.5" cy="10.5" r="1" />
        <circle cx="6.5" cy="10.5" r="1" />
      </g>
    </svg>
  );
}

const borderByKind = { positive: 'border-l-accent', negative: 'border-l-coral-fg' } as const;

/** How long typing may run ahead of the store. Short enough that nothing is ever lost. */
const COMMIT_MS = 250;

export function LayerCard({ layer, onDelete, canMoveUp, canMoveDown }: {
  layer: Layer;
  /** Removes the layer. The panel owns this so it can offer an undo. */
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const update = useStore(s => s.updateLayer);
  const duplicateLayer = useStore(s => s.duplicateLayer);
  const moveLayer = useStore(s => s.moveLayer);
  const addSnippet = useStore(s => s.addSnippet);
  const venice = useStore(s => s.venice);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layer.id,
    data: { kind: layer.kind },
  });

  // A local draft so typing never waits on the store, committed on a short timer and on blur.
  const [draft, setDraft] = useState(layer.text);
  const [saved, flashSaved] = useFlash(1200);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current !== null) { update(layer.id, { text: pending.current }); pending.current = null; }
  };
  const queue = (text: string) => {
    pending.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, COMMIT_MS);
  };
  // Never drop a keystroke when the card goes away mid-edit (delete, filter, view switch).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []);

  // Outside changes (AI tweak, library, recall) replace the draft unless an edit is in flight.
  useEffect(() => { if (pending.current === null) setDraft(layer.text); }, [layer.text]);

  // The text box grows with its content, so the whole prompt is always readable.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // One-shot focus when a freshly inserted layer asks for it, with the caret after its text:
  // a layer made by typing into the "new prompt" box must carry on from the letter just typed.
  const pendingFocusLayerId = useStore(s => s.pendingFocusLayerId);
  const consumeLayerFocus = useStore(s => s.consumeLayerFocus);
  useEffect(() => {
    if (pendingFocusLayerId !== layer.id) return;
    const id = requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      consumeLayerFocus();
    });
    return () => cancelAnimationFrame(id);
  }, [pendingFocusLayerId, layer.id, consumeLayerFocus]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const saveToLibrary = () => {
    flush();
    addSnippet({
      name: layer.tag.trim() || draft.trim().slice(0, 28) || 'Snippet',
      tag: layer.tag,
      text: draft,
      weight: layer.weight,
      kind: layer.kind,
      categoryId: 'uncategorized',
    });
    flashSaved();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex gap-1 rounded-lg border border-l-[3px] border-border-default bg-bg-card py-2 pl-1 pr-2',
        borderByKind[layer.kind],
        !layer.on && 'bg-bg-card/50',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        className="flex w-5 shrink-0 cursor-grab touch-none items-start justify-center pt-2.5 text-handle hover:text-fg-tertiary active:cursor-grabbing"
      >
        <DragDots />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <textarea
          ref={taRef}
          value={draft}
          spellCheck={false}
          rows={3}
          placeholder={layer.kind === 'positive' ? 'what to draw…' : 'what to avoid…'}
          onChange={e => { setDraft(e.target.value); queue(e.target.value); }}
          onBlur={flush}
          aria-label={`${layer.kind} prompt`}
          className={cn(
            'min-h-[4.75rem] w-full resize-none overflow-hidden rounded-md border border-border-subtle bg-bg-input px-2.5 py-2',
            'text-[13px] leading-relaxed outline-none placeholder:text-fg-dim focus:border-accent',
            layer.on ? 'text-fg-primary' : 'text-fg-muted line-through decoration-fg-dim/40',
          )}
        />

        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={layer.on}
            onCheckedChange={on => update(layer.id, { on })}
            ariaLabel={layer.on ? 'Turn this prompt off' : 'Turn this prompt on'}
          />
          <WeightStepper
            value={layer.weight}
            onChange={v => update(layer.id, { weight: v })}
            accent={layer.kind === 'negative' ? 'coral' : 'accent'}
          />
          <div className="ml-auto flex items-center gap-0.5">
            <OverflowMenu
              layer={layer}
              venice={venice}
              onDuplicate={() => { flush(); duplicateLayer(layer.id); }}
              onMoveUp={canMoveUp ? () => moveLayer(layer.id, -1) : undefined}
              onMoveDown={canMoveDown ? () => moveLayer(layer.id, 1) : undefined}
              onSaveToLibrary={saveToLibrary}
              saved={saved}
              onTweakResult={(text) => update(layer.id, { text })}
            />
            <button
              type="button"
              onClick={() => { flush(); onDelete(); }}
              aria-label="Delete this prompt"
              title="Delete (you can undo)"
              className="flex h-8 w-8 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-status-err/15 hover:text-status-err"
            >
              <TrashIcon size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weight — two buttons and a number. Every step is one click, the number can
// be typed, and nothing needs a steady drag.
// ---------------------------------------------------------------------------

const WEIGHT_STEP = 0.05;
const clampWeight = (v: number) => Math.round(Math.min(2, Math.max(0, v)) * 100) / 100;

function WeightStepper({ value, onChange, accent }: {
  value: number;
  onChange: (v: number) => void;
  accent: 'accent' | 'coral';
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const isOne = Math.abs(value - 1) < 0.005;
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(clampWeight(n));
    setDraft(null);
  };
  const btn = 'flex h-8 w-7 shrink-0 items-center justify-center text-fg-dim transition-colors hover:bg-bg-elev hover:text-fg-secondary disabled:opacity-30';

  return (
    <div
      className="flex shrink-0 items-center overflow-hidden rounded-md border border-border-subtle"
      title="Weight (0 to 2). Shift-click steps by 0.25."
    >
      <button
        type="button"
        aria-label="Lower weight"
        disabled={value <= 0}
        onClick={e => onChange(clampWeight(value - (e.shiftKey ? 0.25 : WEIGHT_STEP)))}
        className={btn}
      >
        <MinusIcon size={11} />
      </button>
      <input
        value={draft ?? value.toFixed(2)}
        inputMode="decimal"
        aria-label="Weight"
        onFocus={e => { setDraft(value.toFixed(2)); e.target.select(); }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = clampWeight(value + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.25 : WEIGHT_STEP));
            onChange(next);
            setDraft(next.toFixed(2));
          }
        }}
        className={cn(
          'h-8 w-10 bg-transparent text-center text-[12px] font-semibold tabular-nums outline-none focus:bg-bg-input',
          isOne ? 'text-fg-dim' : accent === 'coral' ? 'text-coral-fg' : 'text-accent-fg',
        )}
      />
      <button
        type="button"
        aria-label="Raise weight"
        disabled={value >= 2}
        onClick={e => onChange(clampWeight(value + (e.shiftKey ? 0.25 : WEIGHT_STEP)))}
        className={btn}
      >
        <PlusIcon size={11} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overflow menu — Duplicate / Tweak with AI / Save to library / Delete
// ---------------------------------------------------------------------------

function OverflowMenu({
  layer, venice, onDuplicate, onMoveUp, onMoveDown, onSaveToLibrary, saved, onTweakResult,
}: {
  layer: Layer;
  venice: ReturnType<typeof useStore.getState>['venice'];
  onDuplicate: () => void;
  /** Undefined when the layer is already first / last of its kind. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSaveToLibrary: () => void;
  saved: boolean;
  onTweakResult: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const veniceReady = !!venice.apiKey;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        title="More…"
        aria-label="More actions"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-bg-elev hover:text-fg-secondary"
      >
        <MoreIcon size={16} />
      </button>
      {open && btnRef.current && (
        <MenuPopover
          anchor={btnRef.current}
          onClose={() => setOpen(false)}
          items={[
            { label: 'Move up', icon: <ArrowUpIcon size={13} />, onClick: () => onMoveUp?.(), disabled: !onMoveUp },
            { label: 'Move down', icon: <ArrowDownIcon size={13} />, onClick: () => onMoveDown?.(), disabled: !onMoveDown },
            { divider: true },
            { label: 'Duplicate', icon: <CopyIcon size={13} />, onClick: onDuplicate },
            {
              label: 'Tweak with AI…',
              icon: <SparkleIcon size={13} />,
              onClick: () => setTweakOpen(true),
              disabled: !veniceReady,
              disabledTitle: 'Set a Venice API key in Settings → AI',
            },
            {
              label: saved ? 'Saved' : 'Save to library',
              icon: saved ? <CheckIcon size={13} /> : <StarIcon size={13} />,
              onClick: onSaveToLibrary,
            },
          ]}
        />
      )}
      {tweakOpen && (
        <TweakDialog
          layer={layer}
          venice={venice}
          onClose={() => setTweakOpen(false)}
          onApply={onTweakResult}
        />
      )}
    </>
  );
}

type MenuItem =
  | { divider: true }
  | { label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean; disabledTitle?: string; danger?: boolean };

function MenuPopover({ anchor, onClose, items }: {
  anchor: HTMLElement;
  onClose: () => void;
  items: MenuItem[];
}) {
  const r = anchor.getBoundingClientRect();
  const WIDTH = 200;
  const MARGIN = 8;
  const vw = window.innerWidth;
  const left = Math.min(Math.max(MARGIN, r.right - WIDTH), vw - WIDTH - MARGIN);
  const top = r.bottom + 4;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-layer-menu]')) return;
      if (target === anchor || anchor.contains(target!)) return;
      onClose();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDocClick); };
  }, [anchor, onClose]);

  useShortcut('Escape', onClose, { priority: ShortcutPriority.Drawer });

  return createPortal(
    <div
      data-layer-menu
      style={{ left, top, width: WIDTH }}
      className="fixed z-50 flex flex-col rounded-xl border border-border-default bg-bg-elev py-1 shadow-2xl"
    >
      {items.map((it, i) => {
        if ('divider' in it) {
          return <div key={i} className="my-1 h-px bg-border-subtle" />;
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
            disabled={it.disabled}
            title={it.disabled ? it.disabledTitle : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors',
              it.danger
                ? 'text-fg-secondary hover:bg-status-err/15 hover:text-status-err'
                : 'text-fg-secondary hover:bg-bg-card-on',
              it.disabled && 'cursor-not-allowed text-fg-faint hover:bg-transparent hover:text-fg-faint',
            )}
          >
            <span className="text-fg-dim">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Tweak dialog — moved from the standalone LayerTweakButton so the row stays
// uncluttered. Same Venice call, same Enter-to-apply shortcut.
// ---------------------------------------------------------------------------

function TweakDialog({ layer, venice, onClose, onApply }: {
  layer: Layer;
  venice: ReturnType<typeof useStore.getState>['venice'];
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-tweak-dialog]')) return;
      onClose();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDocClick); };
  }, [onClose]);

  useShortcut('Escape', () => { abortRef.current?.abort(); onClose(); }, { priority: ShortcutPriority.Drawer });

  const canRun = instruction.trim().length > 0;
  const run = async () => {
    if (busy || !canRun) return;
    setError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const next = await tweakPromptFragment({
        text: layer.text,
        instruction,
        kind: layer.kind,
        settings: venice,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      const trimmed = next.trim();
      if (!trimmed) { setError('AI returned an empty rewrite — try a different instruction.'); return; }
      onApply(trimmed);
      onClose();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Tweak failed');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div data-tweak-dialog className="flex w-[min(95vw,420px)] flex-col rounded-xl border border-border-default bg-bg-elev shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <SparkleIcon size={13} className="text-accent-fg" />
          <span className="text-[12px] font-semibold uppercase tracking-section text-fg-secondary">Tweak layer</span>
          <span className="ml-auto truncate text-[10.5px] text-fg-muted">{layer.tag.trim() || layer.text.slice(0, 32) || 'untitled'}</span>
        </header>
        <div className="flex flex-col gap-2 p-4">
          <input
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void run(); } }}
            placeholder="make this darker / brighter colors / shorter…"
            className="w-full rounded-md border border-border-default bg-bg-input px-2.5 py-1.5 text-[12.5px] text-fg-secondary outline-none placeholder:text-fg-dim focus:border-accent"
          />
          <p className="text-[10.5px] leading-snug text-fg-muted">
            Rewrites this layer only. Press Enter to apply.
          </p>
          {error && (
            <div className="rounded-md border border-status-err/60 bg-status-err/15 px-2.5 py-1.5 text-[11px] text-status-err">{error}</div>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border-default bg-bg-elev px-3 py-1 text-[11px] font-medium text-fg-tertiary hover:border-border-strong hover:text-fg-secondary disabled:opacity-40"
          >Cancel</button>
          <button
            type="button"
            onClick={run}
            disabled={busy || !canRun}
            className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparkleIcon size={11} />
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
