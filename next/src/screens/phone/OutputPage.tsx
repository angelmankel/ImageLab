/**
 * The phone's Output page for one step (rules 11 + 15), top to bottom:
 *   "Output" · Step N · fullscreen (an extra; a tap on the picture does the same)
 *   the picture (OutputPicture: full width, aspect kept, nothing over it)
 *   the progress line while the step's job runs
 *   the results strip
 *   the prompt line + actions (Send to the next step · ★ · Download · Delete — no confirm, the note has Undo)
 *   the Queue card (Stop / Cancel per job)
 * Image steps read the generate history and open the history viewer (the same `openViewer()` the
 * desktop stage uses, item 30: `HistoryViewer`); video / workflow steps read their run store and open `ImageViewer`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconMaximize } from '@tabler/icons-react';
import { enterEdit } from '~/canvas/edit/editStore';
import { PhoneEdit } from '~/canvas/edit/PhoneEdit';
import { HistoryViewer } from '~/screens/viewer/HistoryViewer';
import { ImageViewer } from '~/screens/viewer/ImageViewer';
import { useLiveFrame } from '@/features/history/FullscreenViewer';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { isJobOfSession, useOutputs, useSessionImageResults, useSessionVideoResults, useSessionWorkflowResults } from '~/app/outputs';
import { useSessions } from '~/app/sessionsStore';
import { useModeHost } from '@/features/workspace/modeHost';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { jobActivity } from '@/lib/jobActivity';
import { useStore } from '@/lib/store';
import type { ResultItem } from '@/lib/workspace';
import { deleteImage, deleteRun } from '~/app/deleteResult';
import { useRoute } from '~/app/routeStore';
import { STEP_LABEL, type Step } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import { DOCK_SPACE } from './PhoneDock';
import { OutputPicture } from './OutputPicture';
import { QueueCard } from './QueueCard';
import { ResultThumbs } from './ResultThumbs';
import { LiveToggle, OutputActions, SendNext } from './OutputActions';
import { usePhone } from './phoneStore';

export function OutputPage({ step, index }: { step: Step; index: number }) {
  if (step.kind === 'video') return <RunOutput key="video" mode="video" step={step} index={index} />;
  if (step.kind === 'workflow') return <RunOutput key="workflow" mode="workflow" step={step} index={index} />;
  return <ImageOutput step={step} index={index} />;
}

// ── Image steps ─────────────────────────────────────────────────────────────

function ImageOutput({ step, index }: { step: Step; index: number }) {
  const items = useSessionImageResults(); // this session's (fix list 2, items 9 + 15)
  const sessionId = useSessions((s) => s.currentId);
  const owners = useOutputs((s) => s.jobs);
  const history = useStore((s) => s.history);
  const selected = useStore((s) => s.selectedEntry);
  const select = useStore((s) => s.selectHistoryEntry);
  const openViewer = useStore((s) => s.openViewer);
  const closeViewer = useStore((s) => s.closeViewer);
  const viewerOpen = useStore((s) => s.viewerOpen);
  const allJobs = useStore((s) => s.jobs);
  const jobs = useMemo(() => allJobs.filter((j) => isJobOfSession(j.id, sessionId, owners)), [allJobs, sessionId, owners]);
  const submitting = useStore((s) => s.isSubmitting);
  const online = useStore((s) => Object.keys(s.serverInfo).length > 0);
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const livePreview = useViewerPrefs((s) => s.livePreview);
  const liveFrame = useLiveFrame();

  const item = items.find((i) => i.key === selected?.id) ?? items[0] ?? null;
  const current = item?.entry ?? null;
  const activity = jobActivity(jobs, submitting && jobs.length > 0, online);
  const live = activity.active && jobs.some((j) => j.status === 'running') && livePreview ? liveFrame : null;
  const status = activity.queued > 0 ? `${activity.label} · ${activity.queued} queued` : activity.label;
  const pick = (key: string) => { const e = history.find((h) => h.id === key); if (e) select(e); };
  const open = (key?: string) => {
    if (key) pick(key);
    if (history.length > 0 || liveFrame) openViewer();
  };

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
      sourceKey={current?.derivedFrom?.id ?? null}
      onDelete={current ? () => deleteImage(current) : undefined}
      onEdit={item && item.kind === 'image' && !live ? () => enterEdit({ url: item.url, filename: item.filename, entry: current }, false) : undefined}
      viewer={viewerOpen && (history.length > 0 || !!liveFrame) ? (
        <HistoryViewer onClose={closeViewer} showLive={!!live && !item} />
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
  const items = mode === 'video' ? useSessionVideoResults() : useSessionWorkflowResults(); // eslint-disable-line react-hooks/rules-of-hooks

  useEffect(() => { if (host) store.getState().setHost(host); }, [host, store]);
  useEffect(() => store.getState().attach(), [store]);

  const [picked, setPicked] = useState<string | null>(null);
  const [full, setFull] = useState<number | 'live' | null>(null);
  useEffect(() => { setPicked(null); }, [latest?.url]);
  const i = picked ? Math.max(0, items.findIndex((x) => x.key === picked)) : items.length ? 0 : -1;
  const item = items[i] ?? null;
  const livePreview = useViewerPrefs((s) => s.livePreview);
  const live = busy && livePreview ? preview : null;
  const open = (key?: string) => {
    const at = key ? items.findIndex((x) => x.key === key) : i;
    if (at >= 0) { setPicked(items[at].key); setFull(at); } else if (preview) setFull('live');
  };

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
      onDelete={item ? () => { setPicked((items[i + 1] ?? items[i - 1])?.key ?? null); deleteRun(item.url); } : undefined}
      viewer={full !== null ? (
        <ImageViewer
          items={full === 'live' ? [] : items}
          index={full === 'live' ? 0 : full}
          liveUrl={full === 'live' ? preview : null}
          onIndexChange={(n) => { setFull(n); setPicked(items[n]?.key ?? null); }}
          onClose={() => setFull(null)}
        />
      ) : null}
    />
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

function OutputLayout({ step, index, items, currentKey, onPick, onOpen, live, busy, progress, status, fallbackAspect, caption, current, sourceKey, onDelete, onEdit, viewer }: {
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
  /** The picture a derived result came from (Compare's default Before). */
  sourceKey?: string | null;
  onDelete?: () => void;
  /** Item 13: open the picture in Edit mode (`~/canvas/edit/PhoneEdit`). */
  onEdit?: () => void;
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
  const comparable = !live && current?.kind === 'image' && items.filter((i) => i.kind === 'image').length > 1;
  const noun = step.kind === 'video' ? 'video' : step.kind === 'workflow' ? 'result' : 'image';

  return (
    <div className="il-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: `calc(${DOCK_SPACE + 12}px + var(--il-safe-bottom))` }}>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: `calc(env(safe-area-inset-top, 0px)) ${T.pad.panel}px 0`, boxSizing: 'content-box' }}>
        <span style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>Output</span>
        <span style={{ height: 30, padding: '0 10px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-ember)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          Step {index + 1} · {STEP_LABEL[step.kind]}
        </span>
        <LiveToggle />
        <button type="button" aria-label="Fullscreen" disabled={!canFull} onClick={() => onOpen()}
          style={{ width: 40, height: 40, border: 0, borderRadius: '50%', background: 'var(--il-fg)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center', opacity: canFull ? 1 : 0.4, cursor: 'pointer' }}>
          <IconMaximize size={15} stroke={2.4} />
        </button>
      </div>

      <OutputPicture items={items} currentKey={currentKey} onPick={onPick} onOpen={onOpen} live={live} busy={busy} status={status} liveGrid={step.kind === 'image'}
        fallbackAspect={fallbackAspect} empty={`No ${noun} yet — press Generate.`} compare={comparable} sourceKey={sourceKey ?? null} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md, paddingTop: T.gap.md }}>
        {busy && <ProgressLine status={status} progress={progress} />}
        <OutputActions step={step} current={current} comparable={comparable} onEdit={onEdit} onDelete={onDelete} />
        <ResultThumbs items={items} currentKey={currentKey} onPick={onPick} onOpen={(k) => onOpen(k)} onMore={() => go('library')} />
        {caption && (
          <p style={{ margin: `0 ${T.pad.panel}px`, fontSize: 13, color: 'var(--il-fg2)', lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{caption}</p>
        )}
        <SendNext step={step} current={current} />
        <div style={{ padding: `0 ${T.pad.panel}px` }}><QueueCard ref={queueRef} /></div>
      </div>
      {viewer}
      <PhoneEdit />
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
