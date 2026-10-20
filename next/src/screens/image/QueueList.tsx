/**
 * Rule 15: the queue as a list of cards, one per running or queued job with a ✕ to cancel it
 * (running = interrupt, queued = delete). Shared by the desktop "Queue N" popover and the phone's
 * Output page. Card look from the boards: card grey, radius 14, padding 10.
 */
import { IconX } from '@tabler/icons-react';
import { useQueue, type QueueRow } from '~/app/queue';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';

function Row({ row, onCancel }: { row: QueueRow; onCancel: () => void }) {
  const running = row.status === 'running';
  const pct = row.progress != null ? Math.round(row.progress * 100) : null;
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: T.radius.lg, padding: T.pad.card, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: running ? 'var(--il-ok)' : 'var(--il-muted)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {running ? (pct != null ? `Running · ${pct}%` : 'Running') : 'Queued'}{row.detail ? ` · ${row.detail}` : ''}
        </div>
        {running && (
          <div style={{ height: 3, borderRadius: 2, background: 'var(--il-line-strong)', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, pct ?? 4)}%`, background: 'var(--il-ember)', transition: 'width .2s' }} />
          </div>
        )}
      </div>
      <IconBtn icon={<IconX size={14} stroke={2.4} />} label={running ? 'Stop' : 'Remove from the queue'} onClick={onCancel} size={28} tone="ghost" />
    </div>
  );
}

export function QueueList({ compact = false }: { compact?: boolean }) {
  const { rows, cancel, cancelAll } = useQueue();
  if (!rows.length) return <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>Nothing queued</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => <Row key={r.id} row={r} onCancel={() => cancel(r.id)} />)}
      {!compact && rows.length > 1 && (
        <button type="button" onClick={cancelAll} style={{ height: 30, border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Cancel all</button>
      )}
    </div>
  );
}
