/**
 * The pieces both Studio shells are built from: the workflow picker, the knob list, and the image
 * area. Keeping them here means the phone and the desktop show the same thing arranged
 * differently, rather than being two implementations that drift apart.
 */
import { useEffect, useRef, useState } from 'react';
import type { SavedWorkflow } from '@/lib/comfy';
import { useCanvasStore } from '@/lib/canvasStore';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { FullscreenImage } from '@/components/FullscreenImage';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/IconButton';
import { ResetIcon } from '@/components/ui/icons';
import { ParamField } from './ParamField';
import { ImageInput, isImageParam } from './ImageInput';
import { paramLabel, type WorkflowParam } from './params';
import { composePrompt, exposedParams, promptCandidates, useStudio } from './studioStore';

/**
 * Stable empties.
 *
 * A zustand selector is compared by reference. `s.exposed[path] ?? []` builds a new array on every
 * render, so the store reports a change every time, which re-renders, which builds another — React
 * error #185, "maximum update depth exceeded". Returning the same frozen empty breaks the cycle.
 */
const NO_IDS: string[] = [];
const NO_VALUES: Record<string, unknown> = {};

/** Pick which saved ComfyUI workflow to drive. */
export function WorkflowPicker({
  workflows, onOpen, onRefresh, large,
}: {
  workflows: SavedWorkflow[];
  onOpen: (path: string) => void;
  onRefresh: () => void;
  large?: boolean;
}) {
  const path = useStudio(s => s.path);

  if (!workflows.length) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-subtle p-4 text-center">
        <p className="text-[13px] font-medium text-fg-secondary">No saved workflows yet</p>
        <p className="text-[12px] text-fg-muted">
          Build one in ComfyUI and save it. It shows up here on its own, a moment later.
        </p>
        <button type="button" onClick={onRefresh} className="mt-1 text-[12px] text-accent">
          Look again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {workflows.map(w => (
        <button
          key={w.path}
          type="button"
          onClick={() => onOpen(w.path)}
          className={cn(
            'flex items-center justify-between gap-2 rounded-lg px-3 text-left transition-colors',
            large ? 'min-h-[48px] text-[14px]' : 'min-h-[40px] text-[13px]',
            w.path === path
              ? 'bg-accent/15 text-fg-primary ring-1 ring-accent/40'
              : 'text-fg-secondary hover:bg-bg-hover',
          )}
        >
          <span className="truncate">{w.name}</span>
          {w.path === path && <span className="shrink-0 text-[11px] text-accent">open</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * The knobs.
 *
 * In simple mode this is only what the person chose to expose — the point of the whole view: a
 * workflow with ninety widgets reduced to the four that matter today. In advanced mode it is
 * everything, grouped by the node it came from, each with a pin that adds it to simple mode.
 */
export function ParamList({ large, host }: { large?: boolean; host: string | null }) {
  const params = useStudio(s => s.params);
  const path = useStudio(s => s.path);
  const mode = useStudio(s => s.mode);
  const exposedIds = useStudio(s => (s.path ? s.exposed[s.path] ?? NO_IDS : NO_IDS));
  const values = useStudio(s => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const setValue = useStudio(s => s.setValue);
  const resetValue = useStudio(s => s.resetValue);
  const toggleExposed = useStudio(s => s.toggleExposed);
  // A string or null, so comparing by reference is safe: this re-renders only when it changes.
  const targetId = useStudio(s => s.targetId());

  if (!path) return <Hint>Pick a workflow to see its controls.</Hint>;
  if (!params.length) return <Hint>This workflow has no adjustable inputs.</Hint>;
  // The prompt box is filled from the prompt panel above, so offering it here as well would be two
  // editors for one field, with this one silently overwritten on every run.
  const shownParams = targetId ? params.filter(p => p.id !== targetId) : params;

  const valueOf = (p: WorkflowParam) => (p.id in values ? values[p.id] : p.value);

  /** An image input gets the uploader; everything else gets the normal control. */
  const render = (p: WorkflowParam) =>
    isImageParam(p) && host ? (
      <ImageInput
        key={p.id}
        param={p}
        value={valueOf(p)}
        onChange={v => setValue(p.id, v)}
        host={host}
        large={large}
      />
    ) : (
      <ParamField
        key={p.id}
        param={p}
        value={valueOf(p)}
        onChange={v => setValue(p.id, v)}
        onReset={() => resetValue(p.id)}
        large={large}
      />
    );

  if (mode === 'simple') {
    const shown = exposedParams(shownParams, exposedIds);
    if (!shown.length) {
      return (
        <Hint>
          Nothing is pinned yet. Switch to Advanced and pin the few controls you want here.
        </Hint>
      );
    }
    return <div className="flex flex-col gap-1">{shown.map(render)}</div>;
  }

  // Advanced: every knob, grouped by node, in graph order.
  const groups: { nodeId: number; label: string; items: WorkflowParam[] }[] = [];
  for (const p of shownParams) {
    const last = groups[groups.length - 1];
    if (last && last.nodeId === p.nodeId) last.items.push(p);
    else groups.push({ nodeId: p.nodeId, label: p.nodeLabel, items: [p] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(g => (
        <section key={g.nodeId} className="flex flex-col gap-1">
          <h3 className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            <span className="truncate">{g.label}</span>
            <span className="shrink-0 font-normal normal-case tracking-normal opacity-60">#{g.nodeId}</span>
          </h3>
          {g.items.map(p => (
            <div key={p.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{render(p)}</div>
              <button
                type="button"
                onClick={() => toggleExposed(p.id)}
                aria-pressed={exposedIds.includes(p.id)}
                title={exposedIds.includes(p.id) ? 'Remove from the simple view' : 'Show this in the simple view'}
                className={cn(
                  'mt-6 h-9 w-9 shrink-0 rounded-lg border text-[15px] leading-none transition-colors',
                  exposedIds.includes(p.id)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border-subtle text-fg-muted hover:text-fg-secondary',
                )}
              >
                {exposedIds.includes(p.id) ? '★' : '☆'}
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * The prompt, split in two.
 *
 * Keywords belong to the workflow: the score tags Pony wants, the quality prefix an Illustrious
 * merge wants, a LoRA's trigger word. The prompt is the subject, and by default it is shared, so
 * switching from one workflow to another keeps what was being drawn and swaps only the model's own
 * vocabulary. A workflow can opt out and keep a prompt of its own.
 *
 * Both are joined, keywords first, into the workflow's positive text box on every run.
 */
export function PromptPanel({ large }: { large?: boolean }) {
  const path = useStudio(s => s.path);
  const params = useStudio(s => s.params);
  const targetId = useStudio(s => s.targetId());
  const keywords = useStudio(s => (s.path ? s.keywords[s.path] ?? '' : ''));
  const shared = useStudio(s => (s.path ? s.useShared[s.path] !== false : true));
  const prompt = useStudio(s => (s.path && s.useShared[s.path] === false ? s.ownPrompt[s.path] ?? '' : s.sharedPrompt));
  const setKeywords = useStudio(s => s.setKeywords);
  const setPrompt = useStudio(s => s.setPrompt);
  const setUseShared = useStudio(s => s.setUseShared);
  const setPromptTarget = useStudio(s => s.setPromptTarget);

  if (!path || !targetId) return null;
  const candidates = promptCandidates(params);
  const box = cn(
    'scroll-y w-full resize-y rounded-lg border border-border-subtle bg-bg-base px-3 py-2.5',
    'text-fg-primary outline-none placeholder:text-fg-muted focus:border-accent',
    large ? 'text-[15px]' : 'text-[13px]',
  );
  const label = 'text-[11px] font-semibold uppercase tracking-wide text-fg-muted';
  const sent = composePrompt(keywords, prompt);

  return (
    <section className="flex flex-col gap-2 border-b border-border-subtle pb-4">
      <div className="flex flex-col gap-1">
        <span className={label}>Keywords · this workflow</span>
        <textarea
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          rows={2}
          aria-label="Keywords for this workflow"
          placeholder="Tags only this model needs, e.g. score_9, score_8_up"
          className={box}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className={label}>Prompt</span>
          <label className="flex items-center gap-1.5 text-[11.5px] text-fg-secondary">
            <input
              type="checkbox"
              checked={shared}
              onChange={e => setUseShared(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent,#4F8AFF)]"
            />
            Shared with other workflows
          </label>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={large ? 6 : 5}
          aria-label="Prompt"
          placeholder="What to draw"
          className={box}
        />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-fg-muted">
        <span className="shrink-0">Sent to</span>
        {candidates.length > 1 ? (
          <select
            value={targetId}
            onChange={e => setPromptTarget(e.target.value)}
            aria-label="Which text box receives the prompt"
            className="min-w-0 flex-1 truncate rounded border border-border-subtle bg-bg-base px-1.5 py-0.5 text-fg-secondary"
          >
            {candidates.map(c => <option key={c.id} value={c.id}>{c.nodeLabel} #{c.nodeId}</option>)}
          </select>
        ) : (
          <span className="truncate text-fg-secondary">
            {candidates[0]?.nodeLabel} #{candidates[0]?.nodeId}
          </span>
        )}
        <span className="shrink-0 tabular-nums" title={sent}>{sent.length} chars</span>
      </div>
    </section>
  );
}

/**
 * What the run is doing, and what it made.
 *
 * While a job is live this shows ComfyUI's own preview frames — the partially-denoised image it
 * pushes down the socket each step — with a real progress bar under it and the name of the node
 * currently executing. Before the socket carried these, the only honest thing to show was the
 * word "Running".
 */
export function ResultView({
  results, latest, busy, status, progress, currentNode, preview, queueRemaining,
}: {
  results: { url: string; filename: string }[];
  latest: { url: string } | null;
  busy: boolean;
  status: string | null;
  progress?: number | null;
  currentNode?: string | null;
  preview?: string | null;
  queueRemaining?: number;
}) {
  // The image picked from the strip, by URL so it stays put while new results push the list along.
  // Null means "follow the newest", which is what a finished run should show.
  const [picked, setPicked] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // A new image landing means a run finished: show it, rather than holding an old pick.
  const newest = latest?.url ?? null;
  useEffect(() => { setPicked(null); }, [newest]);

  const index = picked ? Math.max(0, results.findIndex(r => r.url === picked)) : 0;
  const current = results[index] ?? null;
  // A live preview outranks everything: it is what is happening now.
  const livePreview = busy && preview ? preview : null;
  const shown = livePreview ?? current?.url ?? null;

  // ← older, → newer: the same direction as the generate view's history.
  const step = (dir: 1 | -1) => {
    if (!results.length) return;
    const next = Math.min(results.length - 1, Math.max(0, index + dir));
    setPicked(results[next].url);
  };
  const inStudio = () => useCanvasStore.getState().mainView === 'studio' && fullscreen === null;
  useShortcut('ArrowLeft', () => step(1), { priority: ShortcutPriority.Panel + 10, when: inStudio });
  useShortcut('ArrowRight', () => step(-1), { priority: ShortcutPriority.Panel + 10, when: inStudio });

  // Keep the picked thumbnail in view as the arrows walk the strip.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [index]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-bg-base">
        {shown ? (
          <img
            src={shown}
            alt={livePreview ? 'Live preview' : current?.filename ?? 'Generation'}
            onClick={() => { if (!livePreview && current) setFullscreen(index); }}
            // h-full w-full + object-contain scales a small preview frame up to the whole area,
            // where max-* alone left a 512px preview sitting in the middle of a large pane.
            className={cn('h-full w-full object-contain', !livePreview && 'cursor-zoom-in')}
          />
        ) : (
          <p className="px-6 text-center text-[13px] italic text-fg-muted">
            {busy ? (status ?? 'Working…') : 'No image yet — press Generate.'}
          </p>
        )}

        {!busy && results.length > 1 && (
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] tabular-nums text-white/85">
            {index + 1} / {results.length}
          </span>
        )}

        {busy && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
            <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-white/85">
              <span className="truncate">{currentNode ?? status ?? 'Working…'}</span>
              <span className="shrink-0 tabular-nums">
                {progress != null ? `${Math.round(progress * 100)}%` : ''}
                {queueRemaining ? ` · ${queueRemaining} queued` : ''}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/15">
              {progress != null ? (
                // A real bar once a sampler reports steps.
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: `${Math.max(2, progress * 100)}%` }}
                />
              ) : (
                // Between nodes there are no steps to count, so sweep rather than sit at zero.
                <div className="animate-view-loading h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" />
              )}
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div ref={stripRef} className="scroll-x-thin flex shrink-0 gap-2 pb-1">
          {results.map((r, i) => (
            <button
              key={r.url}
              type="button"
              data-index={i}
              onClick={() => setPicked(r.url)}
              onDoubleClick={() => setFullscreen(i)}
              aria-label={`Show ${r.filename}`}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-md ring-1 transition-shadow',
                i === index && !livePreview ? 'ring-2 ring-accent' : 'ring-border-subtle hover:ring-fg-muted',
              )}
            >
              <img src={r.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {fullscreen !== null && (
        <FullscreenImage
          items={results.map(r => ({ key: r.url, url: r.url }))}
          index={fullscreen}
          onIndexChange={i => { setFullscreen(i); setPicked(results[i]?.url ?? null); }}
          onClose={() => setFullscreen(null)}
          pageCaption={results[fullscreen]?.filename}
        />
      )}
    </div>
  );
}

/** Reset every knob on the open workflow back to what ComfyUI saved. */
export function ResetAllButton() {
  const path = useStudio(s => s.path);
  const params = useStudio(s => s.params);
  const resetValue = useStudio(s => s.resetValue);
  if (!path || !params.length) return null;
  return (
    <IconButton
      aria-label="Reset every control"
      title="Back to the values saved in ComfyUI"
      onClick={() => params.forEach(p => resetValue(p.id))}
    >
      <ResetIcon size={15} />
    </IconButton>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-6 text-center text-[13px] text-fg-muted">{children}</p>;
}

export { paramLabel };
