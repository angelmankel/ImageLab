/**
 * The middle of the desktop workspace: the active mode's latest result, big, with the live
 * preview and progress while a run goes, and a strip of recent results under it. One click on the
 * hero opens the fullscreen viewer; ←/→ step through the results; Space toggles fullscreen.
 *
 * Image results are the generate history (selection = `useStore.selectedEntry`, as the history
 * panel and the toolbar already use); Video and Workflow results come from their run stores. The
 * image hero's action toolbar is the old generate top-nav's (`GenerateNavActions`), unchanged.
 * The image fullscreen viewer is the history panel's (it stays mounted in the folded column too),
 * so `openViewer()` is all the hero does; rendering a second one here would stack two overlays.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button } from '@mantine/core';
import { HeroResult } from '@/components/blocks/HeroResult';
import { ResultsStrip } from '@/components/blocks/ResultsStrip';
import { FullscreenImage } from '@/components/FullscreenImage';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { jobActivity } from '@/lib/jobActivity';
import { stepResult } from '@/lib/desktopLayout';
import type { WorkspaceMode } from '@/lib/workspace';
import type { RunStore } from '@/lib/comfyRunner';
import { GenerateNavActions } from '@/features/generate/GenerateNavActions';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useVideoRun } from '@/features/video/videoRun';
import { useResultLabel } from '@/features/video/videoControls';
import { CompareVideos } from '@/features/video/CompareVideos';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { usePadResults } from '@/features/gamepad/padViewer';
import { useDesktopLayout } from './desktopLayoutStore';

const NO_URLS: string[] = [];

export function ResultsArea({ mode }: { mode: WorkspaceMode }) {
  // Keyed by mode so a switch remounts with that mode's store and results.
  return mode === 'image' ? <ImageResults /> : <RunResults key={mode} mode={mode} store={mode === 'video' ? useVideoRun : useWorkflowRun} />;
}

/** The strip's thumbnail size is the user's; a wheel over it with Ctrl held changes it. */
function useStripSize() {
  const strip = useDesktopLayout(s => s.strip);
  const setStrip = useDesktopLayout(s => s.setStrip);
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setStrip(strip - Math.sign(e.deltaY) * 8);
  }, [strip, setStrip]);
  return { strip, onWheel };
}

// ── Image ───────────────────────────────────────────────────────────────────

function ImageResults() {
  const items = useImageResults();
  const history = useStore(s => s.history);
  const selected = useStore(s => s.selectedEntry);
  const select = useStore(s => s.selectHistoryEntry);
  const openViewer = useStore(s => s.openViewer);
  const viewerOpen = useStore(s => s.viewerOpen);
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const online = useStore(s => Object.keys(s.serverInfo).length > 0);
  const servers = useStore(s => s.servers);
  const livePreviews = useCanvasStore(s => s.livePreviews);
  const { strip, onWheel } = useStripSize();

  // The hero follows the selection, else the newest. A finished image lands as the newest, so a
  // run's result shows itself unless something older was picked on purpose.
  const current = selected ?? history[0] ?? null;
  const index = current ? history.findIndex(h => h.id === current.id) : -1;
  const item = useMemo(() => items.find(i => i.key === current?.id) ?? null, [items, current]);

  // Servers in their configured order, so two concurrent previews keep their places.
  const previews = useMemo(() => {
    const urls = servers.map(sv => livePreviews[sv.id]).filter((u): u is string => !!u);
    return urls.length ? urls : NO_URLS;
  }, [servers, livePreviews]);
  const activity = jobActivity(jobs, submitting, online);
  const stage = activity.queued > 0 ? `${activity.label} · ${activity.queued} queued` : activity.label;

  useShortcut('ArrowLeft', () => { const i = stepResult(index, history.length, 1); if (history[i]) select(history[i]); },
    { priority: ShortcutPriority.Panel + 10, when: () => !viewerOpen });
  useShortcut('ArrowRight', () => { const i = stepResult(index, history.length, -1); if (history[i]) select(history[i]); },
    { priority: ShortcutPriority.Panel + 10, when: () => !viewerOpen });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <HeroResult
        item={item}
        preview={previews[0] ?? null}
        busy={activity.active}
        progress={activity.percent != null ? activity.percent / 100 : null}
        statusLine={activity.active ? stage : undefined}
        onOpen={() => openViewer()}
        empty="No image yet — press Generate."
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <div className="pointer-events-auto rounded-md bg-bg-panel/80 backdrop-blur-sm"><GenerateNavActions /></div>
          {history.length > 1 && index >= 0 && (
            <Badge variant="filled" color="dark" radius="sm" className="tabular-nums" style={{ opacity: 0.85 }}>{index + 1} / {history.length}</Badge>
          )}
        </div>
        {previews.length > 1 && (
          // A second server's live frame rides along small; the first fills the hero.
          <div className="pointer-events-none absolute bottom-3 right-3 flex gap-2">
            {previews.slice(1).map((u, i) => <img key={i} src={u} alt="" className="h-24 w-24 rounded-md object-cover ring-1 ring-white/10" />)}
          </div>
        )}
      </HeroResult>
      <div onWheel={onWheel} className="shrink-0 empty:hidden">
        <ResultsStrip items={items} currentKey={current?.id ?? null} size={strip}
          onPick={key => { const e = history.find(h => h.id === key); if (e) select(e); }}
          onOpen={key => { const e = history.find(h => h.id === key); if (e) { select(e); openViewer(); } }} />
      </div>
    </div>
  );
}

// ── Video and Workflow ──────────────────────────────────────────────────────

function RunResults({ mode, store }: { mode: WorkspaceMode; store: RunStore }) {
  const latest = store(s => s.latest);
  const busy = store(s => s.busy);
  const status = store(s => s.status);
  const progress = store(s => s.progress);
  const currentNode = store(s => s.currentNode);
  const preview = store(s => s.preview);
  const queue = store(s => s.queueRemaining);
  const { strip, onWheel } = useStripSize();

  // The component is keyed by mode, so this branch never changes within an instance.
  const items = mode === 'video' ? useVideoResults() : useWorkflowResults(); // eslint-disable-line react-hooks/rules-of-hooks

  // Picked by URL so it stays put while new results push the list along; null follows the newest.
  // Shared with the right column's grid through the layout store.
  const picked = useDesktopLayout(s => s.picked[mode]);
  const setPickedFor = useDesktopLayout(s => s.setPicked);
  const setPicked = useCallback((key: string | null) => setPickedFor(mode, key), [mode, setPickedFor]);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  useEffect(() => { setPicked(null); }, [latest?.url, setPicked]);
  const index = picked ? Math.max(0, items.findIndex(i => i.key === picked)) : items.length ? 0 : -1;
  const item = items[index] ?? null;
  // A sweep names what made a video ("CFG 3.5"); other results have no label.
  const label = useResultLabel(mode === 'video' ? item?.url : null);

  const step = (dir: 1 | -1) => { const i = stepResult(index, items.length, dir); if (items[i]) setPicked(items[i].key); };
  usePadResults({ step, open: () => { if (item) setFullscreen(index); } });
  const noOverlay = () => fullscreen === null;
  useShortcut('ArrowLeft', () => step(1), { priority: ShortcutPriority.Panel + 10, when: noOverlay });
  useShortcut('ArrowRight', () => step(-1), { priority: ShortcutPriority.Panel + 10, when: noOverlay });
  useShortcut('Space', (e) => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'BUTTON' || ae.tagName === 'A' || ae.getAttribute('role') === 'button')) return;
    e.preventDefault();
    setFullscreen(f => (f === null ? (item ? index : null) : null));
  }, { priority: ShortcutPriority.Global + 1 });

  const line = busy ? `${currentNode ?? status ?? 'Working…'}${queue ? ` · ${queue} queued` : ''}` : undefined;
  const noun = mode === 'video' ? 'video' : 'result';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <HeroResult item={item} preview={busy ? preview : null} busy={busy} progress={progress} statusLine={line}
        onOpen={() => { if (item) setFullscreen(index); }} empty={`No ${noun} yet — press Generate.`}>
        {items.length > 1 && index >= 0 && !busy && (
          <Badge variant="filled" color="dark" radius="sm" className="pointer-events-none !absolute right-2 top-2 tabular-nums" style={{ opacity: 0.85 }}>
            {index + 1} / {items.length}
          </Badge>
        )}
        {label && !busy && (
          <Badge variant="filled" color="dark" radius="sm" className="pointer-events-none !absolute left-2 top-2" style={{ opacity: 0.85 }}>{label}</Badge>
        )}
        {mode === 'video' && items.length > 1 && !busy && (
          <Button size="compact-xs" variant="default" className="!absolute bottom-2 right-2" onClick={() => setComparing(true)}>Compare A/B</Button>
        )}
      </HeroResult>
      {mode === 'video' && (
        <CompareVideos items={items} opened={comparing} onClose={() => setComparing(false)} initialA={items[index + 1]?.key ?? null} initialB={item?.key ?? null} />
      )}
      <div onWheel={onWheel} className="shrink-0 empty:hidden">
        <ResultsStrip items={items} currentKey={item?.key ?? null} size={strip} onPick={setPicked}
          onOpen={key => { const i = items.findIndex(x => x.key === key); if (i >= 0) { setPicked(key); setFullscreen(i); } }} />
      </div>
      {fullscreen !== null && (
        <FullscreenImage
          items={items.map(i => ({ key: i.key, url: i.url }))}
          index={fullscreen}
          onIndexChange={i => { setFullscreen(i); setPicked(items[i]?.key ?? null); }}
          onClose={() => setFullscreen(null)}
          pageCaption={items[fullscreen]?.filename}
        />
      )}
    </div>
  );
}
