/**
 * The phone workspace: Image, Video and Workflow in one layout.
 *
 *   ┌ [ Image | Video | Workflow ]            ┐  the mode
 *   │ ● Image 45%  ● Video rendering          │  every running job, both modes at once
 *   ├ Create  ·  Result  ·  Gallery           ┤  the view's tabs
 *   │ (settings list / big result / history)  │
 *   ├ Seed [ 12345 ] 🎲 Auto                  ┤  image + video
 *   └ [ ▶ Generate            ] [🎲]          ┘  one run bar, Stop while it runs
 *
 * Create is the same settings list for every mode (`mobileCreate.tsx`); Result is the same hero and
 * strip (`components/blocks`). A run starting shows Result; a result landing while you are elsewhere
 * badges the tab. Tabs stay mounted within a mode so scroll and open editors survive a switch.
 * The bottom edge below all this is the app-wide `MobileNav`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDice } from '@tabler/icons-react';
import { FullscreenImage } from '@/components/FullscreenImage';
import { HeroResult, JobTray, ModeSwitch, ResultsStrip, RunBar, useWorkspaceMode } from '@/components/blocks';
import { RightPanel } from '@/features/canvasLayers';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { GenerateNavActions } from '@/features/generate/GenerateNavActions';
import { useLiveFrame } from '@/features/history/FullscreenViewer';
import { ViewTabs } from '@/features/layout/MobileNav';
import { JobStatusCluster } from '@/features/layout/JobStatusCluster';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useStudio } from '@/features/studio/studioStore';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { useWorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import { startWorkflowRun } from '@/features/studio/studioRun';
import { startVideoRun, useVideoRun } from '@/features/video/videoRun';
import { useVideo } from '@/features/video/videoStore';
import { useHostTimings } from '@/features/video/videoTimings';
import { onApp } from '@/lib/appEvents';
import type { RunStore } from '@/lib/comfyRunner';
import { jobActivity } from '@/lib/jobActivity';
import { useStore } from '@/lib/store';
import { estimateRun, formatDuration } from '@/lib/videoEstimate';
import { buildWanGraph, wanRunShape } from '@/lib/wanGraph';
import type { ResultItem, WorkspaceMode } from '@/lib/workspace';
import { StepperInput } from '@/components/fields';
import { ImageCreate, VideoCreate, WorkflowCreate } from './mobileCreate';
import { SeedRow, usePanelScope } from './imageScope';
import { useModeHost } from './modeHost';
import { useImageResults, useVideoResults, useWorkflowResults } from './results';

type Tab = 'create' | 'result' | 'gallery';
const TAB_KEY = 'imagelab.mobileTab.v2';

function loadTab(): Tab {
  try { const t = localStorage.getItem(TAB_KEY); return t === 'result' || t === 'gallery' ? t : 'create'; } catch { return 'create'; }
}

export function MobileWorkspace() {
  const mode = useWorkspaceMode();
  const [tab, setTabRaw] = useState<Tab>(loadTab);
  const setTab = (t: Tab) => { setTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };
  // The quick search sends the phone to a tab (Parameters, to show a panel section).
  useEffect(() => onApp('mobile-tab', (t) => setTab(t === 'parameters' ? 'create' : t === 'image' ? 'result' : 'gallery')), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Gallery is the image history; the other modes keep their results in the strip.
  const hasGallery = mode === 'image';
  const shownTab: Tab = tab === 'gallery' && !hasGallery ? 'result' : tab;

  // A result landing while you are elsewhere: badge Result until you look.
  const count = useResultCount(mode);
  const seen = useRef(count);
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    if (shownTab === 'result') { seen.current = count; setUnseen(0); }
    else setUnseen(Math.max(0, count - seen.current));
  }, [count, shownTab]);
  useEffect(() => { seen.current = count; setUnseen(0); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // A run starting shows the result, so it is watched rather than waited out.
  const busy = useModeBusy(mode);
  const wasBusy = useRef(busy);
  useEffect(() => { if (busy && !wasBusy.current) setTab('result'); wasBusy.current = busy; }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    { value: 'create' as Tab, label: 'Create' },
    { value: 'result' as Tab, label: 'Result', badge: unseen },
    ...(hasGallery ? [{ value: 'gallery' as Tab, label: 'Gallery' }] : []),
  ];

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', position: 'absolute', inset: 0, background: 'var(--mantine-color-dark-8)', overscrollBehavior: 'none', touchAction: 'manipulation' }}>
      <Box style={{ paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }} className="bg-bg-panel">
        <div className="flex flex-col gap-1.5 px-2 pt-2 pb-1.5">
          <ModeSwitch size="sm" />
          <Group gap={6} wrap="nowrap" className="scroll-x-thin">
            <JobStatusCluster />
            <JobTray compact />
          </Group>
        </div>
        <ViewTabs<Tab> value={shownTab} onChange={setTab} tabs={tabs} />
      </Box>

      {/* One mode's panes at a time, mounted on first visit and kept. */}
      <Box key={mode} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {mode === 'image' && <ImageMode tab={shownTab} setTab={setTab} />}
        {mode === 'video' && <VideoMode tab={shownTab} setTab={setTab} />}
        {mode === 'workflow' && <WorkflowMode tab={shownTab} setTab={setTab} />}
      </Box>
    </Box>
  );
}

function useResultCount(mode: WorkspaceMode): number {
  const images = useStore(s => s.history.length);
  const videos = useVideoRun(s => s.results.length);
  const wf = useWorkflowRun(s => s.results.length);
  return mode === 'image' ? images : mode === 'video' ? videos : wf;
}

function useModeBusy(mode: WorkspaceMode): boolean {
  const image = useStore(s => s.jobs.some(j => j.status === 'running' || j.status === 'queued'));
  const video = useVideoRun(s => s.busy);
  const wf = useWorkflowRun(s => s.busy);
  return mode === 'image' ? image : mode === 'video' ? video : wf;
}

/** Panes mount on first visit and stay mounted; only the active one is shown. */
function Panes({ tab, panes }: { tab: Tab; panes: Partial<Record<Tab, ReactNode>> }) {
  const [mounted, setMounted] = useState<Set<Tab>>(() => new Set([tab, ...(panes.gallery ? ['gallery' as Tab] : [])]));
  useEffect(() => { setMounted(prev => (prev.has(tab) ? prev : new Set([...prev, tab]))); }, [tab]);
  return (
    <>
      {(Object.keys(panes) as Tab[]).map(t => mounted.has(t) && panes[t] && (
        <Box key={t} style={{ position: 'absolute', inset: 0, display: tab === t ? 'flex' : 'none', flexDirection: 'column' }}>
          {panes[t]}
        </Box>
      ))}
    </>
  );
}

/** The run bar and anything pinned above it, under every tab. */
function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border-default bg-bg-panel px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
      {children}
    </div>
  );
}

/** The result tab: the hero, the strip under it, and the actions for the shown result. */
function ResultPane({ items, currentKey, onPick, onOpen, hero, actions }: {
  items: readonly ResultItem[]; currentKey: string | null; onPick: (key: string) => void; onOpen: (item: ResultItem) => void;
  hero: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      {hero}
      <ResultsStrip items={items} currentKey={currentKey} onPick={onPick} onOpen={k => { const it = items.find(i => i.key === k); if (it) onOpen(it); }} size={72} />
      {actions && <Group justify="flex-end" gap={4} wrap="nowrap" className="scroll-x-thin shrink-0">{actions}</Group>}
    </div>
  );
}

// ── Image ───────────────────────────────────────────────────────────────────

function ImageMode({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { scope, empty, note } = usePanelScope();
  const items = useImageResults();
  const selected = useStore(s => s.selectedEntry);
  const select = useStore(s => s.selectHistoryEntry);
  const openViewer = useStore(s => s.openViewer);
  const live = useLiveFrame();
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const online = useStore(s => Object.keys(s.serverInfo).length > 0);
  const status = useStore(s => s.status);
  const cancelJob = useStore(s => s.cancelJob);
  const activity = jobActivity(jobs, submitting, online);
  const running = jobs.find(j => j.status === 'running') ?? jobs.find(j => j.status === 'queued');
  const current = items.find(i => i.entry.id === selected?.id) ?? items[0] ?? null;

  // Only jump to the result once a job is really queued; a refused run keeps its reason in view.
  const run = async (newSeed = false) => {
    const before = useStore.getState().jobs.length;
    await fireFromStore(newSeed);
    const st = useStore.getState();
    if (st.jobs.length > before) setTab('result');
    else if (st.status.kind === 'error') notifications.show({ title: 'Could not generate', message: st.status.text, color: 'red', autoClose: 8000 });
  };

  return (
    <>
      <Panes tab={tab} panes={{
        create: <ImageCreate scope={scope} empty={empty} note={note} onSwipeToResult={() => setTab('result')} />,
        result: (
          <ResultPane
            items={items}
            currentKey={current?.key ?? null}
            onPick={k => { const it = items.find(i => i.key === k); if (it) select(it.entry); }}
            onOpen={() => openViewer()}
            hero={
              <HeroResult
                item={current}
                preview={live}
                busy={activity.active}
                progress={activity.percent != null ? activity.percent / 100 : null}
                statusLine={activity.label}
                queued={activity.queued}
                onOpen={() => openViewer()}
                empty="No image yet — write a prompt and press Generate."
              />
            }
            actions={<GenerateNavActions />}
          />
        ),
        gallery: <RightPanel />,
      }} />
      <Footer>
        {status.kind === 'error' && <Text size="xs" c="red.4" lineClamp={2} onClick={() => useStore.getState().setStatus('Ready', 'ok')}>{status.text}</Text>}
        {!empty && <SeedRow />}
        <RunBar
          size="lg"
          busy={!!running || submitting}
          busyLabel={running?.status === 'queued' ? 'Queued' : 'Generating'}
          progress={activity.percent != null ? activity.percent / 100 : null}
          statusLine={activity.active ? activity.detail : undefined}
          onRun={() => void run()}
          onStop={running ? () => cancelJob(running.id) : undefined}
          disabled={empty}
          disabledReason="Select a canvas layer first"
          secondary={{ icon: <IconDice size={22} />, label: 'New seed and generate', onClick: () => void run(true) }}
        />
      </Footer>
    </>
  );
}

// ── Video ───────────────────────────────────────────────────────────────────

const MAX_SEED = 0xFFFFFFFF;

function VideoSeedRow() {
  const seed = useVideo(s => s.seed);
  const auto = useVideo(s => s.randomizeSeed);
  const set = useVideo(s => s.set);
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed" w={32}>Seed</Text>
      <StepperInput value={seed} min={0} max={MAX_SEED} step={1} size="xs" style={{ flex: 1, minWidth: 0 }} onChange={seed => set({ seed })} aria-label="Seed"
        styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
      <button type="button" onClick={() => set({ randomizeSeed: !auto })} aria-pressed={auto} className={`h-8 rounded-md border px-2 text-[12px] ${auto ? 'border-accent bg-accent-soft text-accent-fg' : 'border-border-default text-fg-muted'}`}>Auto</button>
    </Group>
  );
}

/** The estimate for the current settings on this server, from its past runs. */
function useVideoEstimateLine(host: string | null, busy: boolean): string {
  const v = useVideo();
  const runs = useHostTimings(host);
  const estimate = useMemo(() => {
    const shape = wanRunShape(buildWanGraph(v, v.startImage || 'x'));
    return estimateRun(runs, shape, runs.length ? runs[runs.length - 1].modelsKey : null);
  }, [v, runs]);
  const startedAt = useVideoRun(s => s.startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]);
  if (busy) {
    if (!estimate || !startedAt) return 'Timing this run to estimate the next ones';
    const left = estimate.ms - (now - startedAt);
    return left > 0 ? `About ${formatDuration(left)} left` : 'Taking longer than the estimate';
  }
  if (estimate) return `About ${formatDuration(estimate.ms)}${estimate.parts.load > 0 ? ' (incl. loading models)' : ''} · from ${estimate.runs} run${estimate.runs === 1 ? '' : 's'}`;
  return 'Time estimate after your first video on this server';
}

/** Video and Workflow share this: the run store's hero, strip and run bar. */
function RunResultPane({ store, items, empty, onOpen }: { store: RunStore; items: readonly ResultItem[]; empty: string; onOpen: (i: number) => void }) {
  const busy = store(s => s.busy);
  const preview = store(s => s.preview);
  const progress = store(s => s.progress);
  const currentNode = store(s => s.currentNode);
  const status = store(s => s.status);
  const queued = store(s => s.queueRemaining);
  const latest = store(s => s.latest);
  // Null means "follow the newest", which is what a finished run should show.
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { setPicked(null); }, [latest?.url]);
  const current = (picked && items.find(i => i.key === picked)) || items[0] || null;
  return (
    <ResultPane
      items={items}
      currentKey={current?.key ?? null}
      onPick={setPicked}
      onOpen={it => onOpen(items.findIndex(i => i.key === it.key))}
      hero={
        <HeroResult item={current} preview={preview} busy={busy} progress={progress} statusLine={currentNode ?? status} queued={queued}
          onOpen={it => onOpen(items.findIndex(i => i.key === it.key))} empty={empty} />
      }
    />
  );
}

function RunFullscreen({ items, index, onIndexChange, onClose }: { items: readonly ResultItem[]; index: number | null; onIndexChange: (i: number) => void; onClose: () => void }) {
  if (index === null || !items[index]) return null;
  return (
    <FullscreenImage items={items.map(r => ({ key: r.key, url: r.url }))} index={index} onIndexChange={onIndexChange} onClose={onClose} pageCaption={items[index]?.filename} />
  );
}

function VideoMode({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const host = useModeHost('video');
  const items = useVideoResults();
  const busy = useVideoRun(s => s.busy);
  const progress = useVideoRun(s => s.progress);
  const status = useVideoRun(s => s.status);
  const error = useVideoRun(s => s.error);
  const setHost = useVideoRun(s => s.setHost);
  const attach = useVideoRun(s => s.attach);
  useEffect(() => { setHost(host); }, [host, setHost]);
  useEffect(() => attach(), [attach]);
  const line = useVideoEstimateLine(host, busy);
  const [fs, setFs] = useState<number | null>(null);

  if (!host) return <NoServer />;
  return (
    <>
      <Panes tab={tab} panes={{
        create: <VideoCreate host={host} onSwipeToResult={() => setTab('result')} />,
        result: <RunResultPane store={useVideoRun} items={items} empty="No video yet — write a prompt and press Generate." onOpen={setFs} />,
      }} />
      <Footer>
        {error && <Text size="xs" c="red.4" lineClamp={2} onClick={() => useVideoRun.getState().clearError()}>{error}</Text>}
        <VideoSeedRow />
        <RunBar size="lg" label="Generate video" busy={busy} busyLabel={status ?? 'Rendering'} progress={progress} statusLine={line}
          onRun={() => void startVideoRun(host)} onStop={() => void useVideoRun.getState().cancel()} />
      </Footer>
      <RunFullscreen items={items} index={fs} onIndexChange={setFs} onClose={() => setFs(null)} />
    </>
  );
}

// ── Workflow ────────────────────────────────────────────────────────────────

function WorkflowMode({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const host = useModeHost('workflow');
  const { info, error: infoError } = useObjectInfo(host);
  const library = useWorkflowLibrary(host, info);
  const items = useWorkflowResults();
  const path = useStudio(s => s.path);
  const busy = useWorkflowRun(s => s.busy);
  const progress = useWorkflowRun(s => s.progress);
  const status = useWorkflowRun(s => s.status);
  const error = useWorkflowRun(s => s.error);
  const setHost = useWorkflowRun(s => s.setHost);
  const attach = useWorkflowRun(s => s.attach);
  useEffect(() => { setHost(host); }, [host, setHost]);
  useEffect(() => attach(), [attach]);
  const [fs, setFs] = useState<number | null>(null);

  if (!host) return <NoServer />;
  if (infoError) return <Dead title="Cannot reach ComfyUI" body={infoError} />;
  return (
    <>
      <Panes tab={tab} panes={{
        create: <WorkflowCreate host={host} library={library} onSwipeToResult={() => setTab('result')} />,
        result: <RunResultPane store={useWorkflowRun} items={items} empty="Nothing yet — open a workflow and run it." onOpen={setFs} />,
      }} />
      <Footer>
        {error && <Text size="xs" c="red.4" lineClamp={2} onClick={() => useWorkflowRun.getState().clearError()}>{error}</Text>}
        <RunBar size="lg" label="Run workflow" busy={busy} busyLabel={status ?? 'Running'} progress={progress}
          statusLine={!info ? 'Reading the server…' : undefined}
          onRun={() => void startWorkflowRun(host, info)} onStop={() => void useWorkflowRun.getState().cancel()}
          disabled={!path || !info} disabledReason={!info ? 'Reading the server…' : 'Pick a workflow first'} />
      </Footer>
      <RunFullscreen items={items} index={fs} onIndexChange={setFs} onClose={() => setFs(null)} />
    </>
  );
}

function NoServer() {
  return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-8 text-center">
      <Text size="sm" fw={500}>{title}</Text>
      <Text size="xs" c="dimmed">{body}</Text>
    </div>
  );
}
