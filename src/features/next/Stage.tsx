/**
 * The stage: the centre of the new workspace. Desktop: the full height of the window, no padding;
 * the result, the live preview or the clip is `object-fit: contain` at full height, and nothing
 * else in the column takes height from it — the bar, the filmstrip, the result actions and the
 * progress all float over it. Phone: full width, no padding, the shape of what it shows (so a
 * portrait result is tall, a wide clip short); the controls scroll under it.
 *
 * The picture itself is `HeroResult` (one pager everywhere — see "Swiping results" in CLAUDE.md),
 * bare. A fullscreen button is always there: a result opens the original viewer
 * (`components/FullscreenImage` through the history viewer for images), a live preview opens it
 * on the frame. Keys: ←/→ older / newer, Space fullscreen (the image viewer's Space is app-wide
 * already, so only video / workflow bind it here).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActionIcon, Badge, Button, Progress } from '@mantine/core';
import { IconMaximize } from '@tabler/icons-react';
import { HeroResult } from '@/components/blocks/HeroResult';
import { ResultsStrip, type ResultsStripHandle } from '@/components/blocks/ResultsStrip';
import { FullscreenImage } from '@/components/FullscreenImage';
import { useMediaAspect } from '@/hooks/useMediaAspect';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { jobActivity } from '@/lib/jobActivity';
import { stepResult } from '@/lib/desktopLayout';
import type { WorkspaceMode } from '@/lib/workspace';
import type { RunStore } from '@/lib/comfyRunner';
import { SendToButtons } from '@/features/workspace/sendTo';
import { GenerateNavActions } from '@/features/generate/GenerateNavActions';
import { FullscreenViewer, useLiveFrame } from '@/features/history/FullscreenViewer';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useVideoRun } from '@/features/video/videoRun';
import { useResultLabel } from '@/features/video/videoControls';
import { CompareVideos } from '@/features/video/CompareVideos';
import { useVideo } from '@/features/video/videoStore';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { usePadResults } from '@/features/gamepad/padViewer';
import { useDesktopLayout } from '@/features/desktop/desktopLayoutStore';
import { StageBar } from './StageBar';
import { useNext } from './nextStore';

const NO_URLS: string[] = [];
/** The floating filmstrip's own padding around its thumbnails. */
const STRIP_PAD = 20;

export function Stage({ mode, mobile = false }: { mode: WorkspaceMode; mobile?: boolean }) {
  return mode === 'image'
    ? <ImageStage mobile={mobile} />
    : <RunStage key={mode} mode={mode} store={mode === 'video' ? useVideoRun : useWorkflowRun} mobile={mobile} />;
}

// ── Frame ───────────────────────────────────────────────────────────────────

/**
 * Desktop: fills its column. Phone: full width at the shape of what it shows (`aspect`), so the
 * stage is never cropped and never padded.
 */
function Frame({ mobile, aspect, children }: { mobile: boolean; aspect: number | null; children: ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden bg-bg-base"
      style={mobile ? { aspectRatio: String(aspect ?? 1), flexShrink: 0 } : { height: '100%' }}
    >
      {children}
    </div>
  );
}

/** The phone's always-there way to full screen (desktop has it in the floating bar). */
function FullscreenButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <ActionIcon variant="filled" color="dark" size="lg" radius="md" style={{ opacity: 0.85 }} className="pointer-events-auto" onClick={onClick} disabled={disabled} aria-label="Fullscreen">
      <IconMaximize size={18} />
    </ActionIcon>
  );
}

/** The thumbnails, floating along the bottom edge; a tap selects, a second tap opens. */
function Filmstrip({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2 pb-2 pt-3">
      <div className="pointer-events-auto" data-no-swipe>{children}</div>
    </div>
  );
}

/** The run's progress, floating just above the filmstrip; HeroResult's own band is off. */
function ProgressBand({ bottom, statusLine, progress, queued }: { bottom: number; statusLine?: string | null; progress: number | null; queued?: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 z-10 flex flex-col gap-1 px-3 pb-2 pt-6" style={{ bottom, background: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)' }}>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-white/85">
        <span className="truncate">{statusLine ?? 'Working…'}</span>
        <span className="shrink-0 tabular-nums">
          {progress != null ? `${Math.round(progress * 100)}%` : ''}
          {queued ? ` · ${queued} queued` : ''}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/15">
        {progress != null
          ? <Progress value={Math.max(2, progress * 100)} size={4} radius="xl" bg="transparent" transitionDuration={150} />
          : <div className="animate-view-loading h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" />}
      </div>
    </div>
  );
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

function ImageStage({ mobile }: { mobile: boolean }) {
  const items = useImageResults();
  const history = useStore(s => s.history);
  const selected = useStore(s => s.selectedEntry);
  const select = useStore(s => s.selectHistoryEntry);
  const openViewer = useStore(s => s.openViewer);
  const closeViewer = useStore(s => s.closeViewer);
  const viewerOpen = useStore(s => s.viewerOpen);
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const online = useStore(s => Object.keys(s.serverInfo).length > 0);
  const servers = useStore(s => s.servers);
  const livePreviews = useCanvasStore(s => s.livePreviews);
  const width = useStore(s => s.workflow.width);
  const height = useStore(s => s.workflow.height);
  const filmstrip = useNext(s => s.filmstrip);
  const { strip, onWheel } = useStripSize();
  const liveFrame = useLiveFrame();

  // The hero follows the selection, else the newest. A finished image lands as the newest, so a
  // run's result shows itself unless something older was picked on purpose.
  const current = selected ?? history[0] ?? null;
  const index = current ? history.findIndex(h => h.id === current.id) : -1;
  const previews = useMemo(() => {
    const urls = servers.map(sv => livePreviews[sv.id]).filter((u): u is string => !!u);
    return urls.length ? urls : NO_URLS;
  }, [servers, livePreviews]);
  const activity = jobActivity(jobs, submitting, online);
  const live = activity.active ? previews[0] ?? null : null;
  const stage = activity.queued > 0 ? `${activity.label} · ${activity.queued} queued` : activity.label;
  const strip_ = useRef<ResultsStripHandle>(null);
  const pick = (key: string) => { const e = history.find(h => h.id === key); if (e) select(e); };
  const currentUrl = items.find(i => i.key === current?.id)?.url ?? null;
  const measured = useMediaAspect(mobile ? (live ?? currentUrl) : null, 'image');
  const aspect = mobile ? (measured ?? width / height) : null;

  useShortcut('ArrowLeft', () => { const i = stepResult(index, history.length, 1); if (history[i]) select(history[i]); },
    { priority: ShortcutPriority.Panel + 10, when: () => !viewerOpen });
  useShortcut('ArrowRight', () => { const i = stepResult(index, history.length, -1); if (history[i]) select(history[i]); },
    { priority: ShortcutPriority.Panel + 10, when: () => !viewerOpen });

  const canFullscreen = history.length > 0 || !!liveFrame;
  const showStrip = filmstrip && items.length > 0;
  const bottom = showStrip ? strip + STRIP_PAD : 0;
  const viewerIndex = viewerOpen ? Math.max(0, history.findIndex(e => e.id === current?.id)) : -1;

  return (
    <Frame mobile={mobile} aspect={aspect}>
      <HeroResult
        bare hideProgress
        items={items}
        currentKey={current?.id ?? null}
        onPick={pick}
        onDragProgress={f => strip_.current?.follow(f)}
        preview={live}
        busy={activity.active}
        progress={activity.percent != null ? activity.percent / 100 : null}
        statusLine={activity.active ? stage : undefined}
        onOpen={() => openViewer()}
        empty="No image yet — press Generate."
      >
        {!mobile && <StageBar floating onFullscreen={() => openViewer()} fullscreenDisabled={!canFullscreen} />}
        <div className="pointer-events-none absolute inset-x-0 flex items-start justify-between gap-2 px-2" style={{ top: mobile ? 8 : 56 }}>
          <div>{mobile && <FullscreenButton onClick={() => openViewer()} disabled={!canFullscreen} />}</div>
          {history.length > 1 && index >= 0 && (
            <Badge variant="filled" color="dark" radius="sm" className="tabular-nums" style={{ opacity: 0.85 }}>{index + 1} / {history.length}</Badge>
          )}
        </div>
        {previews.length > 1 && (
          // A second server's live frame rides along small; the first fills the stage.
          <div className="pointer-events-none absolute right-3 flex gap-2" style={{ bottom: bottom + 12 }}>
            {previews.slice(1).map((u, i) => <img key={i} src={u} alt="" className="h-24 w-24 rounded-md object-cover ring-1 ring-white/10" />)}
          </div>
        )}
        {activity.active && (
          <ProgressBand bottom={bottom} statusLine={stage} progress={activity.percent != null ? activity.percent / 100 : null} />
        )}
        {!activity.active && current && (
          <div data-no-swipe className="absolute left-2 z-10 rounded-md bg-bg-panel/80 backdrop-blur-sm" style={{ bottom: bottom + 8 }}>
            <GenerateNavActions />
          </div>
        )}
        {showStrip && (
          <Filmstrip>
            <div onWheel={onWheel}>
              <ResultsStrip ref={strip_} items={items} currentKey={current?.id ?? null} size={mobile ? 56 : strip}
                onPick={pick}
                onOpen={key => { const e = history.find(h => h.id === key); if (e) { select(e); openViewer(); } }} />
            </div>
          </Filmstrip>
        )}
      </HeroResult>
      {viewerOpen && (history.length > 0 || !!liveFrame) && (
        <FullscreenViewer
          list={history}
          index={Math.max(0, viewerIndex)}
          onIndexChange={i => { const next = history[i]; if (next) select(next); }}
          onClose={closeViewer}
        />
      )}
    </Frame>
  );
}

// ── Video and Workflow ──────────────────────────────────────────────────────

function RunStage({ mode, store, mobile }: { mode: WorkspaceMode; store: RunStore; mobile: boolean }) {
  const latest = store(s => s.latest);
  const busy = store(s => s.busy);
  const status = store(s => s.status);
  const progress = store(s => s.progress);
  const currentNode = store(s => s.currentNode);
  const preview = store(s => s.preview);
  const queue = store(s => s.queueRemaining);
  const filmstrip = useNext(s => s.filmstrip);
  const { strip, onWheel } = useStripSize();
  const vw = useVideo(s => (s.engine === 'h3' ? s.h3.width : s.width));
  const vh = useVideo(s => (s.engine === 'h3' ? s.h3.height : s.height));

  // The component is keyed by mode, so this branch never changes within an instance.
  const items = mode === 'video' ? useVideoResults() : useWorkflowResults(); // eslint-disable-line react-hooks/rules-of-hooks

  // Picked by URL so it stays put while new results push the list along; null follows the newest.
  const picked = useDesktopLayout(s => s.picked[mode]);
  const setPickedFor = useDesktopLayout(s => s.setPicked);
  const setPicked = useCallback((key: string | null) => setPickedFor(mode, key), [mode, setPickedFor]);
  const [fullscreen, setFullscreen] = useState<number | 'live' | null>(null);
  const [comparing, setComparing] = useState(false);
  useEffect(() => { setPicked(null); }, [latest?.url, setPicked]);
  const index = picked ? Math.max(0, items.findIndex(i => i.key === picked)) : items.length ? 0 : -1;
  const item = items[index] ?? null;
  const label = useResultLabel(mode === 'video' ? item?.url : null);
  const live = busy ? preview : null;
  const measured = useMediaAspect(mobile ? (live ?? item?.url ?? null) : null, live ? 'image' : item?.kind === 'video' ? 'video' : 'image');
  const aspect = mobile ? (measured ?? (mode === 'video' ? vw / vh : 1)) : null;

  const step = (dir: 1 | -1) => { const i = stepResult(index, items.length, dir); if (items[i]) setPicked(items[i].key); };
  const openFull = () => { if (item) setFullscreen(index); else if (preview) setFullscreen('live'); };
  usePadResults({ step, open: openFull });
  const noOverlay = () => fullscreen === null;
  useShortcut('ArrowLeft', () => step(1), { priority: ShortcutPriority.Panel + 10, when: noOverlay });
  useShortcut('ArrowRight', () => step(-1), { priority: ShortcutPriority.Panel + 10, when: noOverlay });
  useShortcut('Space', (e) => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'BUTTON' || ae.tagName === 'A' || ae.getAttribute('role') === 'button')) return;
    e.preventDefault();
    if (fullscreen !== null) setFullscreen(null); else openFull();
  }, { priority: ShortcutPriority.Global + 1 });

  const line = busy ? `${currentNode ?? status ?? 'Working…'}${queue ? ` · ${queue} queued` : ''}` : undefined;
  const noun = mode === 'video' ? 'video' : 'result';
  const strip_ = useRef<ResultsStripHandle>(null);
  const showStrip = filmstrip && items.length > 0;
  const bottom = showStrip ? strip + STRIP_PAD : 0;

  return (
    <Frame mobile={mobile} aspect={aspect}>
      <HeroResult bare hideProgress items={items} currentKey={item?.key ?? null} onPick={setPicked} onDragProgress={f => strip_.current?.follow(f)}
        preview={live} busy={busy} progress={progress} statusLine={line}
        onOpen={() => { if (item) setFullscreen(index); }} empty={`No ${noun} yet — press Generate.`}>
        {!mobile && <StageBar floating onFullscreen={openFull} fullscreenDisabled={!item && !preview} />}
        <div className="pointer-events-none absolute inset-x-0 flex items-start justify-between gap-2 px-2" style={{ top: mobile ? 8 : 56 }}>
          <div className="flex items-center gap-2">
            {mobile && <FullscreenButton onClick={openFull} disabled={!item && !preview} />}
            {label && !busy && <Badge variant="filled" color="dark" radius="sm" style={{ opacity: 0.85 }}>{label}</Badge>}
          </div>
          {items.length > 1 && index >= 0 && !busy && (
            <Badge variant="filled" color="dark" radius="sm" className="tabular-nums" style={{ opacity: 0.85 }}>{index + 1} / {items.length}</Badge>
          )}
        </div>
        {busy && <ProgressBand bottom={bottom} statusLine={line} progress={progress ?? null} />}
        {item && !busy && (
          <div data-no-swipe className="absolute left-2 z-10 flex items-center gap-1 rounded-md bg-bg-panel/80 px-1 backdrop-blur-sm" style={{ bottom: bottom + 8 }}>
            <SendToButtons from={mode} source={{ url: item.url, filename: item.filename, kind: item.kind === 'video' ? 'video' : 'image' }} />
            {mode === 'video' && items.length > 1 && (
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setComparing(true)}>Compare A/B</Button>
            )}
          </div>
        )}
        {showStrip && (
          <Filmstrip>
            <div onWheel={onWheel}>
              <ResultsStrip ref={strip_} items={items} currentKey={item?.key ?? null} size={mobile ? 56 : strip} onPick={setPicked}
                onOpen={key => { const i = items.findIndex(x => x.key === key); if (i >= 0) { setPicked(key); setFullscreen(i); } }} />
            </div>
          </Filmstrip>
        )}
      </HeroResult>
      {mode === 'video' && (
        <CompareVideos items={items} opened={comparing} onClose={() => setComparing(false)} initialA={items[index + 1]?.key ?? null} initialB={item?.key ?? null} />
      )}
      {fullscreen !== null && (
        <FullscreenImage
          items={fullscreen === 'live' ? [] : items.map(i => ({ key: i.key, url: i.url }))}
          index={fullscreen === 'live' ? 0 : fullscreen}
          liveUrl={fullscreen === 'live' ? preview : null}
          onIndexChange={i => { setFullscreen(i); setPicked(items[i]?.key ?? null); }}
          onClose={() => setFullscreen(null)}
          pageCaption={fullscreen === 'live' ? 'Live preview' : items[fullscreen]?.filename}
        />
      )}
    </Frame>
  );
}
