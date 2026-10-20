/**
 * Rule 15 on the phone: the queue as a card on the Output page. The running job first (with its
 * progress), then the queued ones, oldest first; every row has its own ✕ (Stop for the running
 * one, Cancel for a queued one). The Generate badge scrolls here.
 */
import { forwardRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { useQueue, type QueueRow } from '~/app/queue';
import { useSteps, STEP_LABEL } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import { progressFraction } from './phoneLogic';

function Row({ row, stepName, onCancel }: { row: QueueRow; stepName: string | null; onCancel: () => void }) {
  const running = row.status === 'running';
  const f = running ? progressFraction(row.progress) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: running ? 'var(--il-ember)' : 'var(--il-line-strong)' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
          {stepName && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap' }}>{stepName}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: running ? 'var(--il-ember-hi)' : 'var(--il-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {running ? (f != null ? `${Math.round(f * 100)}%` : 'Running') : 'Queued'}
          </span>
        </div>
        {running && (
          <div style={{ height: 4, borderRadius: 2, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(4, (f ?? 0.08) * 100)}%`, background: 'var(--il-ember)', borderRadius: 2, transition: 'width 200ms linear' }} />
          </div>
        )}
      </div>
      <button type="button" onClick={onCancel} aria-label={running ? `Stop ${row.label}` : `Cancel ${row.label}`}
        style={{ height: 32, padding: '0 10px', flex: 'none', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <IconX size={13} stroke={2.8} />{running ? 'Stop' : 'Cancel'}
      </button>
    </div>
  );
}

export const QueueCard = forwardRef<HTMLDivElement>(function QueueCard(_props, ref) {
  const { rows, cancel } = useQueue();
  const steps = useSteps((s) => s.steps);
  const nameOf = (id?: string) => {
    if (!id) return null;
    const i = steps.findIndex((s) => s.id === id);
    return i < 0 ? null : `${i + 1} · ${STEP_LABEL[steps[i].kind]}`;
  };
  return (
    <section ref={ref} aria-label="Queue" style={{ background: 'var(--il-card)', borderRadius: T.radius.lg, padding: T.pad.card, display: 'flex', flexDirection: 'column', gap: 4, scrollMarginBottom: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Queue</span>
        {rows.length > 0 && <span style={{ background: 'var(--il-ember)', color: 'var(--il-bg)', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{rows.length}</span>}
      </div>
      {rows.length === 0
        ? <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', padding: '2px 0 4px' }}>Nothing running. Generate while a job runs and it waits here.</div>
        : rows.map((r) => <Row key={r.id} row={r} stepName={nameOf(r.stepId)} onCancel={() => cancel(r.id)} />)}
    </section>
  );
});
