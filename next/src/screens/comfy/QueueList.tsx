/**
 * Rules 14 + 15: the server's queue. The running prompt is a card with its node and step count and
 * a bar; each pending prompt a row; every row has a ✕ (running = interrupt, pending = remove).
 * "Clear" drops everything pending. Shared by the desktop right panel and the phone's Queue tab.
 */
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { Count } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { pendingDetail, progressFraction, progressText, type LiveProgress, type QueueRow } from './comfyHelpers';
import { cancelRow, clearPending } from './queueActions';

function XBtn({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  const phone = useIsPhone();
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={busy}
      style={{ width: phone ? 44 : 32, height: phone ? 44 : 32, flex: 'none', border: 0, borderRadius: '50%', background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 1 }}>
      <IconX size={16} stroke={2.4} />
    </button>
  );
}

export function QueueList({ host, rows, live, radius = 16 }: { host: string | null; rows: readonly QueueRow[]; live: LiveProgress | null; radius?: number }) {
  const [busy, setBusy] = useState<Record<string, true>>({});
  const pendingCount = rows.filter((r) => r.state === 'pending').length;
  const cancel = async (r: QueueRow) => {
    if (!host) return;
    setBusy((b) => ({ ...b, [r.id]: true }));
    try { await cancelRow(host, r); } finally { setBusy((b) => { const n = { ...b }; delete n[r.id]; return n; }); }
  };
  let position = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <span style={{ fontSize: 15, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}>Queue{rows.length > 0 && <Count n={rows.length} />}</span>
        {pendingCount > 0 && host && (
          <button type="button" onClick={() => void clearPending(host, rows)}
            style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 2px' }}>
            Clear
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => {
          if (r.state === 'running') {
            const frac = progressFraction(r, live);
            return (
              <div key={r.id} style={{ padding: '10px 6px 12px 14px', borderRadius: radius, background: 'var(--il-card)', border: '1px solid var(--il-line-strong)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                  <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--il-ember-hi)' }}>{progressText(r, live)}</span>
                  <XBtn label="Stop this job" busy={!!busy[r.id]} onClick={() => void cancel(r)} />
                </div>
                <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--il-line-strong)', margin: '4px 8px 0 0' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: `${Math.round(frac * 100)}%`, borderRadius: 2, background: 'var(--il-ember)', transition: 'width 200ms linear' }} />
                </div>
              </div>
            );
          }
          position += 1;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px 8px 14px', borderRadius: radius, background: 'var(--il-card)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{pendingDetail(r, position)}</span>
              </span>
              <XBtn label="Remove from the queue" busy={!!busy[r.id]} onClick={() => void cancel(r)} />
            </div>
          );
        })}
        {!rows.length && (
          <div style={{ padding: '12px 14px', borderRadius: radius, background: 'var(--il-card)', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>
            {host ? 'Nothing running or queued.' : 'No server.'}
          </div>
        )}
      </div>
    </div>
  );
}
