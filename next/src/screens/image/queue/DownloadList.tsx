/**
 * Item 14: the Download queue — the real model downloads from every server (ImageLabCore's
 * `/imagelab/api/downloads`, polled by the downloads store), one card each: the file, its folder
 * and server, live progress with speed and time left; × cancels a running one or dismisses a
 * finished one, ↻ retries a failed / cancelled one; "Clear finished" dismisses every row that is
 * not downloading. Card look of the job queue (card grey, radius 14, padding 10).
 */
import { useState } from 'react';
import { IconCheck, IconRefresh, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { useDownloadsStore, type DownloadRow } from '@/features/downloads/store';
import { Button, IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { canRetry, downloadCounts, orderDownloads, progressLine } from './downloadLogic';
import { notifyError } from '~/app/notify';

function Row({ row }: { row: DownloadRow }) {
  const cancel = useDownloadsStore((s) => s.cancel);
  const retry = useDownloadsStore((s) => s.retry);
  const bps = useDownloadsStore((s) => s.bytesPerSecond)(row.rowId);
  const [busy, setBusy] = useState(false);
  const running = row.status === 'downloading';
  const pct = row.total_bytes > 0 ? Math.round((row.downloaded_bytes / row.total_bytes) * 100) : null;
  const doRetry = () => {
    setBusy(true);
    retry(row).catch((err: unknown) => notifyError('Could not retry the download', err))
      .finally(() => setBusy(false));
  };
  const status = running ? progressLine(row, bps)
    : row.status === 'failed' ? `Failed${row.error ? ` · ${row.error}` : ''}`
      : row.status === 'cancelled' ? 'Cancelled' : 'Done';
  const icon = running ? null : row.status === 'completed'
    ? <IconCheck size={14} stroke={2.6} color="var(--il-ok)" />
    : row.status === 'failed' ? <IconAlertTriangle size={14} stroke={2.4} color="var(--il-err)" /> : null;
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: T.radius.lg, padding: T.pad.card, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--il-fg)' }}>
          {icon}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={row.filename}>{row.filename}</span>
          {running && pct != null && <span style={{ marginLeft: 'auto', color: 'var(--il-ember-hi)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{pct}%</span>}
        </div>
        <div title={status} style={{ fontSize: 11, fontWeight: 600, color: row.status === 'failed' ? 'var(--il-err)' : 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
          {status}{!running && row.folder && row.folder !== '?' ? ` · ${row.folder}` : ''}{running && row.folder !== '?' ? ` · ${row.folder}` : ''} · {row.serverName}
        </div>
        {running && (
          <div style={{ height: 3, borderRadius: 2, background: 'var(--il-line-strong)', marginTop: 6, overflow: 'hidden' }}>
            {pct != null
              ? <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, background: 'var(--il-ember)', transition: 'width .4s linear' }} />
              : <div className="il-sweep" style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg, transparent, var(--il-ember), transparent)' }} />}
          </div>
        )}
      </div>
      {canRetry(row) && <IconBtn icon={<IconRefresh size={15} stroke={2.4} />} label="Retry" onClick={doRetry} disabled={busy} size={30} tone="ghost" />}
      <IconBtn icon={<IconX size={14} stroke={2.4} />} label={running ? 'Cancel the download' : 'Dismiss'} onClick={() => void cancel(row)} size={30} tone="ghost" />
    </div>
  );
}

export function DownloadList() {
  const rows = useDownloadsStore((s) => s.rows);
  const clearFinished = useDownloadsStore((s) => s.clearFinished);
  if (!rows.length) return <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>No downloads</div>;
  const { finished } = downloadCounts(rows);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {orderDownloads(rows).map((r) => <Row key={r.rowId} row={r} />)}
      {finished > 0 && (
        <Button size="sm" tone="ghost" onClick={() => void clearFinished()} style={{ alignSelf: 'center' }}>Clear finished ({finished})</Button>
      )}
    </div>
  );
}
