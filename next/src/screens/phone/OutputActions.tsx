/**
 * The phone's picture actions (mobile pass, m-create): the desktop stage toolbar's output actions,
 * in its order, as one row of 44 px round buttons with a word under each (tap over type, nothing
 * over the picture): Edit · Compare · Vary · Recall · ♥ · Download · Delete. Then the wide
 * "Send to step N" (or "Send to a new step": the kind picker). Zoom lives in the viewer (pinch);
 * Live preview on / off sits in the Output header (`LiveToggle`).
 */
import type { ReactNode } from 'react';
import {
  IconArrowRight, IconBroadcast, IconBroadcastOff, IconColumns2, IconDownload, IconHeart, IconHeartFilled, IconHistory,
  IconPencil, IconRefresh, IconTrash,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import type { ResultItem } from '@/lib/workspace';
import { useViewerPrefs } from '@/features/history/viewerPrefs';
import { recallFrom, reuseSettingsFrom, sendToNextStep } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { useSteps, STEP_LABEL, type Step } from '~/app/stepsStore';
import { useStepRun } from '~/screens/image/GenerateBar';
import { useStage } from '~/screens/image/stageStore';
import { downloadResult } from '~/screens/image/Toolbar';
import { haptic } from '~/phone';
import { T } from '~/theme/tokens';

function Act({ icon, label, onClick, on, disabled, tone }: { icon: ReactNode; label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; on?: boolean; disabled?: boolean; tone?: 'ember' }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} disabled={disabled} onClick={onClick}
      style={{ width: 52, flex: 'none', padding: 0, border: 0, background: 'transparent', color: 'var(--il-fg2)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, touchAction: 'manipulation' }}>
      <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: on ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: on || tone === 'ember' ? 'var(--il-ember-hi)' : 'var(--il-fg)',
        boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', color: on ? 'var(--il-ember-hi)' : 'var(--il-muted)' }}>{label}</span>
    </button>
  );
}

export function OutputActions({ step, current, comparable, onEdit, onDelete }: {
  step: Step;
  current: (ResultItem & { entry?: unknown }) | null;
  /** 2+ pictures: Compare can split the picture. */
  comparable: boolean;
  /** Edit mode for this picture (null: not an editable picture now). */
  onEdit?: () => void;
  /** Delete the shown result (default: `deleteOutput`). */
  onDelete?: () => void;
}) {
  const { run } = useStepRun(step);
  const toggleLiked = useStore((s) => s.toggleHistoryLiked);
  const entry = (current?.entry ?? null) as HistoryEntry | null;
  const liked = useStore((s) => (entry ? !!s.history.find((h) => h.id === entry.id)?.liked : false));
  const compare = useStage((s) => s.compare);
  const setCompare = useStage((s) => s.setCompare);
  const has = !!current;
  const vary = () => { if (entry) reuseSettingsFrom(entry); run(true); };
  return (
    <div className="il-scroll-x" data-no-swipe style={{ display: 'flex', justifyContent: 'space-between', gap: 2, padding: `0 ${T.pad.panel - 4}px`, touchAction: 'pan-x pan-y', scrollbarWidth: 'none' }}>
      <Act icon={<IconPencil size={18} stroke={2.2} />} label="Edit" onClick={() => onEdit?.()} disabled={!onEdit} />
      <Act icon={<IconColumns2 size={18} stroke={2.2} />} label="Compare" on={compare} onClick={() => { haptic(); setCompare(!compare); }} disabled={!compare && !comparable} />
      <Act icon={<IconRefresh size={18} stroke={2.2} />} label="Vary" onClick={vary} disabled={!has} />
      <Act icon={<IconHistory size={18} stroke={2.2} />} label="Recall" onClick={() => { if (entry) { recallFrom(entry); haptic(); } }} disabled={!entry} />
      <Act icon={liked ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={2.2} />} label="Favourite" on={liked} onClick={() => { if (entry) { toggleLiked(entry.id); haptic(); } }} disabled={!entry} />
      <Act icon={<IconDownload size={18} stroke={2.2} />} label="Download" onClick={() => { if (current) void downloadResult(current.url, current.filename); }} disabled={!has} />
      <Act icon={<IconTrash size={18} stroke={2.2} />} label="Delete" onClick={() => { if (!current) return; if (onDelete) onDelete(); else deleteOutput({ entry, url: current.url }); }} disabled={!has} />
    </div>
  );
}

/** "Send to step 3 · Video ›", or "Send to a new step ›" (the kind picker) on the last step. */
export function SendNext({ step, current }: { step: Step; current: (ResultItem & { entry?: unknown }) | null }) {
  const steps = useSteps((s) => s.steps);
  const at = steps.findIndex((s) => s.id === step.id);
  const next = at >= 0 ? steps[at + 1] : undefined;
  if (!current) return null;
  const entry = (current.entry ?? undefined) as HistoryEntry | undefined;
  return (
    <button type="button" onClick={(e) => sendToNextStep({ url: current.url, entry }, e.currentTarget)}
      style={{ height: 44, margin: `0 ${T.pad.panel}px`, border: 0, borderRadius: T.radius.lg, background: 'var(--il-card)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {next ? `Send to step ${at + 2} · ${STEP_LABEL[next.kind]}` : 'Send to a new step'}<IconArrowRight size={15} stroke={2.4} />
    </button>
  );
}

/** Live preview on / off (the desktop toolbar's last button). */
export function LiveToggle() {
  const on = useViewerPrefs((s) => s.livePreview);
  const set = useViewerPrefs((s) => s.setLivePreview);
  return (
    <button type="button" aria-label={on ? 'Live preview on' : 'Live preview off'} aria-pressed={on} onClick={() => { set(!on); haptic(); }}
      style={{ width: 40, height: 40, border: 0, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer',
        background: on ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: on ? 'var(--il-ember-hi)' : 'var(--il-muted)' }}>
      {on ? <IconBroadcast size={17} stroke={2.2} /> : <IconBroadcastOff size={17} stroke={2.2} />}
    </button>
  );
}
