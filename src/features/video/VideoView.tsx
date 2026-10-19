/**
 * Video — Wan 2.2 A14B, text to video or image to video.
 *
 * Built from the parts the other views already use: the field components (sliders, selects,
 * seed, dimensions), Studio's image uploader, runner and result view (which plays video), and the
 * model picker for LoRAs. The graph is `lib/wanGraph.ts`, the same one as ImageLabDocker's
 * workflows/Wan 2.2 *.json. Its settings live in `videoStore`, apart from the generate view's.
 *
 * The settings come in sections (`./sections.tsx`): Mode & input · Prompt · Models · LoRAs ·
 * Size & length · Speed & sampling · Upscale, each with a live one-line summary. Desktop: the
 * sections fold as cards in the left column, the video on the right. Phone: Settings / Video tabs;
 * Settings is the same settings list as Generate's Parameters tab (`SettingsPager`). Both keep the
 * seed, Generate and the time estimate pinned at the bottom.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActionIcon, Button, Collapse, Group, Loader, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconChevronDown, IconDice5, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { buildWanGraph, pickInstalledWanFiles, wanRunShape } from '@/lib/wanGraph';
import { VIDEO_SECTIONS, type VideoSectionId, type VideoSectionStatus } from '@/lib/videoSections';
import { estimateRun, formatDuration } from '@/lib/videoEstimate';
import { useHostTimings } from './videoTimings';
import { StepperInput } from '@/components/fields';
import { SettingsPager, StatusBadge } from '@/components/SettingsPager';
import { ResultView } from '@/features/studio/StudioPanels';
import { useModeHost } from '@/features/workspace/modeHost';
import { ViewTabs } from '@/features/layout/MobileNav';
import { useRunStore, type StudioRun } from '@/features/studio/useStudioRun';
import { useVideoRun, videoRunSource } from './videoRun';
import { useVideo } from './videoStore';
import { MissingFiles, VIDEO_SECTION_META, VideoSectionBody, useVideoSectionStatus } from './sections';

/** The video run store, as the view's handle (`features/video/videoRun.ts` owns the run). */
function useVideoRunHandle(host: string | null): StudioRun {
  return useRunStore(useVideoRun, host, videoRunSource(host ?? ''));
}

/** The estimate for the current settings on this server, from its past runs. */
export function useVideoEstimate(host: string | null) {
  const v = useVideo();
  const runs = useHostTimings(host);
  return useMemo(() => {
    const shape = wanRunShape(buildWanGraph(v, v.startImage || 'x'));
    const last = runs.length ? runs[runs.length - 1].modelsKey : null;
    return estimateRun(runs, shape, last);
  }, [v, runs]);
}

/** When a chosen Wan file is not on the server but one installed file clearly is its stand-in
 *  (SmoothMix's t2v High / Low, the umt5 encoder…), use that one. */
function useInstalledWanFiles() {
  const mode = useVideo((s) => s.mode);
  const diffusionModels = useStore((s) => s.server.diffusionModels);
  const textEncoders = useStore((s) => s.server.textEncoders);
  const vaes = useStore((s) => s.server.vaes);
  useEffect(() => {
    if (!diffusionModels.length) return;
    const st = useVideo.getState();
    const patch = pickInstalledWanFiles(st, { diffusionModels, textEncoders, vaes });
    if (Object.keys(patch).length) st.set(patch);
  }, [mode, diffusionModels, textEncoders, vaes]);
}

export function VideoView() {
  const host = useModeHost('video');
  const isDesktop = useIsDesktop();
  const run = useVideoRunHandle(host);
  useInstalledWanFiles();

  if (!host) {
    return (
      <Stack h="100%" align="center" justify="center" gap={6} px="xl" ta="center">
        <Text size="sm" fw={500}>No ComfyUI server</Text>
        <Text size="xs" c="dimmed">Add one in Settings, then come back.</Text>
      </Stack>
    );
  }

  const result = (
    <ResultView
      results={run.results}
      latest={run.latest}
      busy={run.busy}
      status={run.status}
      progress={run.progress}
      currentNode={run.currentNode}
      preview={run.preview}
      queueRemaining={run.queueRemaining}
    />
  );
  const error = run.error && <Text size="xs" c="red.4" className="shrink-0">{run.error}</Text>;

  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0">
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-border-subtle">
          {/* Block, not flex: a flex column would squash each section to fit instead of scrolling. */}
          <div className="scroll-y min-h-0 flex-1 px-2.5 py-2.5">
            <VideoDesktopSections host={host} />
          </div>
          <footer className="shrink-0 border-t border-border-subtle p-3">
            <VideoFooter run={run} host={host} />
          </footer>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          {result}
          {error}
        </main>
      </div>
    );
  }

  return <VideoMobile run={run} host={host} result={result} error={error} />;
}

// ── Desktop ─────────────────────────────────────────────────────────────────

/** Which cards are folded: a per-browser convenience, so storage may fail without harm. */
const FOLDED_KEY = 'imagelab.video.folded.v1';
/** The expert files are picked for you and rarely change, so Models starts folded. */
const FOLDED_DEFAULT: VideoSectionId[] = ['models'];

function loadFolded(): VideoSectionId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDED_KEY) || 'null');
    if (Array.isArray(raw)) return raw.filter((id): id is VideoSectionId => VIDEO_SECTIONS.includes(id));
  } catch { /* blocked or broken: the default */ }
  return FOLDED_DEFAULT;
}

function VideoDesktopSections({ host }: { host: string }) {
  const status = useVideoSectionStatus();
  const [folded, setFolded] = useState<VideoSectionId[]>(loadFolded);
  const toggle = (id: VideoSectionId) => setFolded((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });

  return (
    <Stack gap="xs">
      <MissingFiles />
      {VIDEO_SECTIONS.map((id) => (
        <SectionCard key={id} id={id} status={status[id]} open={!folded.includes(id)} onToggle={() => toggle(id)}>
          <VideoSectionBody id={id} host={host} />
        </SectionCard>
      ))}
      <ResetRow />
    </Stack>
  );
}

/** One folding section: icon, name and live summary on the header, the controls under it. */
function SectionCard({ id, status, open, onToggle, children }: {
  id: VideoSectionId; status: VideoSectionStatus; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const { title, icon: Icon } = VIDEO_SECTION_META[id];
  const warn = status.tone === 'warn';
  return (
    // `shrink-0`: a flex child shrinks by default and would clip its own controls.
    <section aria-label={title} className="shrink-0 rounded-lg border border-border-default bg-bg-panel">
      <button type="button" onClick={onToggle} aria-expanded={open} title={status.note}
        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-bg-elev focus-visible:ring-1 focus-visible:ring-accent">
        <Icon size="1.05rem" stroke={1.5} className={cn('shrink-0', open ? 'text-accent-fg' : 'text-fg-muted')} />
        <span className="shrink-0 text-[13px] font-medium text-fg-secondary">{title}</span>
        <span className={cn('min-w-0 flex-1 truncate text-right text-[11px] tabular-nums', warn ? 'text-red-400' : 'text-fg-muted')}>
          {warn && status.note ? status.note : status.summary}
        </span>
        {status.badge && <StatusBadge status={status} />}
        <IconChevronDown size={15} stroke={1.6} className="shrink-0 text-fg-muted transition-transform" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      <Collapse in={open}>
        <div className="px-3 pb-3 pt-1">{children}</div>
      </Collapse>
    </section>
  );
}

// ── Phone ───────────────────────────────────────────────────────────────────

type VideoPane = 'settings' | 'video';

/** Phones: Settings / Video tabs at the top (like Generate's and Studio's), Generate pinned above
 *  the app's bottom bar. A run starting shows the Video tab, as Generate shows its Image tab.
 *  Settings stays mounted, so an open page and its history entry survive a look at the video. */
function VideoMobile({ run, host, result, error }: { run: StudioRun; host: string; result: ReactNode; error: ReactNode }) {
  const [pane, setPane] = useState<VideoPane>('settings');
  useEffect(() => { if (run.busy) setPane('video'); }, [run.busy]);
  const status = useVideoSectionStatus();
  const rows = VIDEO_SECTIONS.map((id) => ({ id, ...VIDEO_SECTION_META[id], status: status[id] }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewTabs<VideoPane>
        value={pane}
        onChange={setPane}
        tabs={[
          { value: 'settings', label: 'Settings' },
          { value: 'video', label: 'Video' },
        ]}
      />
      <div className={cn('min-h-0 flex-1 flex-col', pane === 'settings' ? 'flex' : 'hidden')}>
        <SettingsPager
          rows={rows}
          renderPage={(id) => <VideoSectionBody id={id} host={host} />}
          pageIdPrefix="video-section-"
          onMenuSwipeLeft={() => setPane('video')}
          menu={(nav) => (
            <>
              <div className="mb-3 empty:hidden"><MissingFiles /></div>
              {nav}
              <div className="mt-3 rounded-xl border border-border-default bg-bg-panel px-3 py-2"><ResetRow /></div>
              <p className="mt-3 px-1 text-[11px] leading-relaxed text-fg-muted">
                Swipe right on a page to come back here. Swipe left here for the video.
              </p>
            </>
          )}
        />
      </div>
      {pane === 'video' && <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">{result}</div>}
      <footer className="flex shrink-0 flex-col gap-2 border-t border-border-subtle p-3">
        {error}
        <VideoFooter run={run} host={host} />
      </footer>
    </div>
  );
}

// ── Both ────────────────────────────────────────────────────────────────────

/** Settings back to Wan's defaults; what you made stays. */
function ResetRow() {
  const reset = useVideo((s) => s.resetSettings);
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="xs" c="dimmed">Prompt, start image and LoRAs stay.</Text>
      <Button size="xs" variant="subtle" color="gray" leftSection={<IconArrowBackUp size={15} />} onClick={reset} aria-label="Reset video settings" className="shrink-0">
        Wan's defaults
      </Button>
    </Group>
  );
}

/** The seed row (as Generate's footer has it), Generate / Stop, and the time estimate. */
function VideoFooter({ run, host }: { run: StudioRun; host: string }) {
  return (
    <Stack gap={8}>
      <VideoSeedRow />
      <VideoGenerateBar run={run} host={host} />
    </Stack>
  );
}

const MAX_SEED = 0xFFFFFFFF;

export function VideoSeedRow() {
  const seed = useVideo((s) => s.seed);
  const auto = useVideo((s) => s.randomizeSeed);
  const set = useVideo((s) => s.set);
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed" w={32}>Seed</Text>
      <StepperInput value={seed} min={0} max={MAX_SEED} step={1} size="xs" style={{ flex: 1, minWidth: 0 }}
        onChange={(seed) => set({ seed })} aria-label="Seed"
        styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
      <Tooltip label="Randomize seed">
        <ActionIcon variant="light" color="gray" size="md" onClick={() => set({ seed: Math.floor(Math.random() * MAX_SEED) })} aria-label="Randomize seed"><IconDice5 size={15} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Pick a new seed for every generation">
        <Switch size="xs" checked={auto} onChange={(e) => set({ randomizeSeed: e.currentTarget.checked })} label={<Text size="xs" c="dimmed">Auto</Text>} aria-label="Randomize seed every generation" />
      </Tooltip>
    </Group>
  );
}

/**
 * One line under Generate: the estimate for these settings, or — while a run goes — the estimate
 * made when it started, counted down. Shared with the desktop workspace's footer.
 */
export function useVideoEstimateLine(host: string | null, busy: boolean): string {
  const estimate = useVideoEstimate(host);
  const [started, setStarted] = useState<{ at: number; ms: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) { setStarted(null); return; }
    setStarted((s) => s ?? (estimate ? { at: Date.now(), ms: estimate.ms } : null));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (busy) {
    if (!started) return 'Timing this run to estimate the next ones';
    const left = started.ms - (now - started.at);
    return left > 0 ? `About ${formatDuration(left)} left` : 'Taking longer than the estimate';
  }
  if (estimate) {
    return `About ${formatDuration(estimate.ms)}${estimate.parts.load > 0 ? ' (incl. loading models)' : ''} · from ${estimate.runs} run${estimate.runs === 1 ? '' : 's'}`
      + (estimate.partial ? ' · upscale time learned after its first run' : '');
  }
  return 'Time estimate after your first video on this server';
}

function VideoGenerateBar({ run, host }: { run: StudioRun; host: string }) {
  const line = useVideoEstimateLine(host, run.busy);
  return (
    <Stack gap={6}>
      <Group gap="xs" wrap="nowrap">
        <Button
          aria-label="Generate video"
          onClick={() => void run.run()}
          disabled={run.busy}
          fullWidth
          size="md"
          leftSection={run.busy ? <Loader size="xs" color="white" /> : <IconPlayerPlay size="1rem" />}
          className="flex-1"
        >
          {run.busy ? (run.status ?? 'Working…') : 'Generate video'}
        </Button>
        {run.busy && (
          <Button variant="default" size="md" leftSection={<IconPlayerStop size="1rem" />} onClick={() => void run.cancel()} className="shrink-0">
            Stop
          </Button>
        )}
      </Group>
      <Text size="xs" c="dimmed" ta="center" className="tabular-nums">{line}</Text>
    </Stack>
  );
}
