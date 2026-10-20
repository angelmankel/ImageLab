/**
 * The phone's Output page for one step (rules 11 + 15), top to bottom:
 *   "Output" · Step N · fullscreen (an extra; a tap on the picture does the same)
 *   the picture (OutputPicture: full width, aspect kept, nothing over it)
 *   the progress line while the step's job runs
 *   the results strip
 *   the prompt line + actions (Send to the next step · ★ · Download)
 *   the Queue card (Stop / Cancel per job)
 * Image steps read the generate history and open the history viewer (the same `openViewer()` the
 * desktop stage uses); video / workflow steps read their run store and open `FullscreenImage`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconChevronRight, IconDownload, IconMaximize, IconStar, IconStarFilled } from '@tabler/icons-react';
import { FullscreenImage } from '@/components/FullscreenImage';
import { FullscreenViewer, useLiveFrame } from '@/features/history/FullscreenViewer';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useModeHost } from '@/features/workspace/modeHost';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { jobActivity } from '@/lib/jobActivity';
import { useStore } from '@/lib/store';
import type { ResultItem } from '@/lib/workspace';
import { sendToStep } from '~/app/actions';
import { useRoute } from '~/app/routeStore';
import { useSteps, STEP_LABEL, type Step } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import { DOCK_SPACE } from './PhoneDock';
import { OutputPicture } from './OutputPicture';
import { QueueCard } from './QueueCard';
import { ResultThumbs } from './ResultThumbs';
import { usePhone } from './phoneStore';

export function OutputPage({ step, index }: { step: Step; index: number }) {
  if (step.kind === 'video') return <RunOutput key="video" mode="video" step={step} index={index} />;
  if (step.kind === 'workflow') return <RunOutput key="workflow" mode="workflow" step={step} index={index} />;
  return <ImageOutput step={step} index={index} />;
}

// ── Image steps ─────────────────────────────────────────────────────────────

function ImageOutput({ step, index }: { step: Step; index: number }) {
  const items = useImageResults();
  const history = useStore((s) => s.history);
  const selected = useStore((s) => s.selectedEntry);
  const select = useStore((s) => s.selectHistoryEntry);
  const openViewer = useStore((s) => s.openViewer);
  const closeViewer = useStore((s) => s.closeViewer);
  const viewerOpen = useStore((s) => s.viewerOpen);
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const jobs = useStore((s) => s.jobs);
  const submitting = useStore((s) => s.isSubmitting);
  const online = useStore((s) => Object.keys(s.serverInfo).length > 0);
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const liveFrame = useLiveFrame();

  const current = selected ?? history[0] ?? null;
  const item = items.find((i) => i.key === current?.id) ?? null;
  const activity = jobActivity(jobs, submitting, online);
  const live = activity.active ? liveFrame : null;
  const status = activity.queued > 0 ? `${activity.label} · ${activity.queued} queued` : activity.label;
  const pick = (key: string) => { const e = history.find((h) => h.id === key); if (e) select(e); };
  const open = (key?: string) => {
    if (key) pick(key);
    if (history.length > 0 || liveFrame) openViewer();
  };
  const viewerIndex = Math.max(0, history.findIndex((e) => e.id === current?.id));

  return (
    <OutputLayout
      step={step}
      index={index}
      items={items}
      currentKey={current?.id ?? null}
      onPick={pick}
      onOpen={open}
      live={live}
      busy={activity.active}
      progress={activity.percent != null ? activity.percent / 100 : null}
      status={status}
      fallbackAspect={width / height}
      caption={current?.positive ?? null}
      current={item}
      liked={!!current?.liked}
      onLike={current ? () => toggleLiked(current.id) : undefined}
      viewer={viewerOpen && (history.length > 0 || !!liveFrame) ? (
        <FullscreenViewer list={history} index={viewerIndex} onIndexChange={(i) => { const e = history[i]; if (e) select(e); }} onClose={closeViewer} instantClose />
      ) : null}
    />
  );
}

// ── Video / workflow steps ──────────────────────────────────────────────────

function RunOutput({ mode, step, index }: { mode: 'video' | 'workflow'; step: Step; index: number }) {
  const store = mode === 'video' ? useVideoRun : useWorkflowRun;
  const host = useModeHost(mode);
  const latest = store((s) => s.latest);
  const busy = store((s) => s.busy);
  const status = store((s) => s.status);
  const progress = store((s) => s.progress);
  const currentNode = store((s) => s.currentNode);
  const preview = store((s) => s.preview);
  const queue = store((s) => s.queueRemaining);
  // The component is keyed by mode, so this branch never changes within an instance.
  const items = mode === 'video' ? useVideoResults() : useWorkflowResults(); // eslint-disable-line react-hooks/rules-of-hooks

  useEffect(() => { if (host) store.getState().setHost(host); }, [host, store]);
  useEffect(() => store.getState().attach(), [store]);

  const [picked, setPicked] = useState<string | null>(null);
  const [full, setFull] = useState<number | 'live' | null>(null);
  useEffect(() => { setPicked(null); }, [latest?.url]);
  const i = picked ? Math.max(0, items.findIndex((x) => x.key === picked)) : items.length ? 0 : -1;
  const item = items[i] ?? null;
  const live = busy ? preview : null;
  const open = (key?: string) => {
    const at = key ? items.findIndex((x) => x.key === key) : i;
    if (at >= 0) { setPicked(items[at].key); setFull(at); } else if (preview) setFull('live');
  };
  const fsItems = useMemo(() => items.map((x) => ({ key: x.key, url: x.url })), [items]);

  return (
    <OutputLayout
      step={step}
      index={index}
      items={items}
      currentKey={item?.key ?? null}
      onPick={setPicked}
      onOpen={open}
      live={live}
      busy={busy}
      progress={progress}
      status={busy ? `${currentNode ?? status ?? 'Working…'}${queue ? ` · ${queue} queued` : ''}` : null}
      fallbackAspect={mode === 'video' ? 16 / 9 : 1}
      caption={null}
      current={item}
      viewer={full !== null ? (
        <FullscreenImage
          items={full === 'live' ? [] : fsItems}
          index={full === 'live' ? 0 : full}
          liveUrl={full === 'live' ? preview : null}
          onIndexChange={(n) => { setFull(n); setPicked(items[n]?.key ?? null); }}
          onClose={() => setFull(null)}
          instantClose
          pageCaption={full === 'live' ? 'Live preview' : items[full]?.filename}
        />
      ) : null}
    />
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

function OutputLayout({ step, index, items, currentKey, onPick, onOpen, live, busy, progress, status, fallbackAspect, caption, current, liked, onLike, viewer }: {
  step: Step;
  index: number;
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  onOpen: (key?: string) => void;
  live: string | null;
  busy: boolean;
  progress: number | null;
  status: string | null;
  fallbackAspect: number;
  caption: string | null;
  current: (ResultItem & { entry?: unknown }) | null;
  liked?: boolean;
  onLike?: () => void;
  viewer: ReactNode;
}) {
  const go = useRoute((s) => s.go);
  const queueAsk = usePhone((s) => s.queueAsk);
  const queueRef = useRef<HTMLDivElement>(null);
  const seenAsk = useRef(queueAsk);
  useEffect(() => {
    if (queueAsk === seenAsk.current) return;
    seenAsk.current = queueAsk;
    requestAnimationFrame(() => queueRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  }, [queueAsk]);

  const canFull = items.length > 0 || !!live;
  const noun = step.kind === 'video' ? 'video' : step.kind === 'workflow' ? 'result' : 'image';

  return (
    <div className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: `calc(${DOCK_SPACE + 12}px + var(--il-safe-bottom))` }}>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: `calc(env(safe-area-inset-top, 0px)) ${T.pad.panel}px 0`, boxSizing: 'content-box' }}>
        <span style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>Output</span>
        <span style={{ height: 30, padding: '0 10px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-ember)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          Step {index + 1} · {STEP_LABEL[step.kind]}
        </span>
        <button type="button" aria-label="Fullscreen" disabled={!canFull} onClick={() => onOpen()}
          style={{ width: 32, height: 32, border: 0, borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center', opacity: canFull ? 1 : 0.4, cursor: 'pointer' }}>
          <IconMaximize size={15} stroke={2.4} />
        </button>
      </div>

      <OutputPicture items={items} currentKey={currentKey} onPick={onPick} onOpen={onOpen} live={live} busy={busy} status={status}
        fallbackAspect={fallbackAspect} empty={`No ${noun} yet — press Generate.`} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md, paddingTop: T.gap.md }}>
        {busy && <ProgressLine status={status} progress={progress} />}
        <ResultThumbs items={items} currentKey={currentKey} onPick={onPick} onOpen={(k) => onOpen(k)} onMore={() => go('library')} />
        {caption && (
          <p style={{ margin: `0 ${T.pad.panel}px`, fontSize: 13, color: 'var(--il-fg2)', lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{caption}</p>
        )}
        {current && <Actions step={step} current={current} liked={liked} onLike={onLike} />}
        <div style={{ padding: `0 ${T.pad.panel}px` }}><QueueCard ref={queueRef} /></div>
      </div>
      {viewer}
    </div>
  );
}

function ProgressLine({ status, progress }: { status: string | null; progress: number | null }) {
  return (
    <div style={{ padding: `0 ${T.pad.panel}px`, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status ?? 'Working…'}</span>
        {progress != null && <span style={{ color: 'var(--il-ember-hi)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(progress * 100)}%</span>}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(4, (progress ?? 0.08) * 100)}%`, background: 'var(--il-ember)', borderRadius: 2, transition: 'width 200ms linear' }} />
      </div>
    </div>
  );
}

function Actions({ step, current, liked, onLike }: { step: Step; current: ResultItem & { entry?: unknown }; liked?: boolean; onLike?: () => void }) {
  const steps = useSteps((s) => s.steps);
  const at = steps.findIndex((s) => s.id === step.id);
  const next = at >= 0 ? steps[at + 1] : undefined;
  const entry = current.entry as Parameters<typeof sendToStep>[0]['entry'];
  const btn: React.CSSProperties = { height: 44, border: 0, borderRadius: T.radius.lg, background: 'var(--il-card)', color: 'var(--il-fg)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 };
  return (
    <div style={{ display: 'flex', gap: T.gap.md, padding: `0 ${T.pad.panel}px` }}>
      {next && (
        <button type="button" style={{ ...btn, flex: 1 }} onClick={() => sendToStep({ url: current.url, entry }, next.id)}>
          Send to step {at + 2} · {STEP_LABEL[next.kind]}<IconChevronRight size={14} />
        </button>
      )}
      {!next && <div style={{ flex: 1 }} />}
      {onLike && (
        <button type="button" aria-label={liked ? 'Unfavourite' : 'Favourite'} aria-pressed={liked} onClick={onLike} style={{ ...btn, width: 44, color: liked ? 'var(--il-ember-hi)' : 'var(--il-fg)' }}>
          {liked ? <IconStarFilled size={18} /> : <IconStar size={18} />}
        </button>
      )}
      <a href={current.url} download={current.filename} target="_blank" rel="noreferrer" aria-label="Download" style={{ ...btn, width: 44, textDecoration: 'none' }}>
        <IconDownload size={18} />
      </a>
    </div>
  );
}
