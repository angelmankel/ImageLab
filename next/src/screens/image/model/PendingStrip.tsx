/**
 * The "not downloaded" strip on a pending entry's card (models-picker brief, item 5): what is
 * waiting, a Download button through the main app's download manager (`useDownloadsStore`,
 * every online server that lacks the file), the progress while it runs, the error if it failed.
 * The entry flips to enabled by itself when the file lands (`usePendingReconcile`).
 */
import { IconAlertTriangle, IconDownload, IconLoader2 } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useDownloadsStore } from '@/features/downloads';
import { T } from '~/theme/tokens';
import { downloadProgress, recordDownloadKey, recordFolder, type PendingRecord } from './pendingLogic';
import { notifyError, say } from '~/app/notify';

/** Start a record's download on every online server: by version, or by its own file URL (a pair's other half). */
export async function startRecordDownload(record: PendingRecord) {
  const dl = useDownloadsStore.getState();
  return record.downloadUrl ? dl.startUrl(record.downloadUrl, recordFolder(record), record.file) : dl.start(record.versionId, recordFolder(record));
}

export function PendingStrip({ record }: { record: PendingRecord }) {
  const rows = useDownloadsStore((s) => s.rows);
  const online = useStore((s) => s.servers.some((sv) => !!s.serverInfo[sv.id]));
  const p = downloadProgress(rows, recordDownloadKey(record));
  const busy = p?.status === 'downloading';

  const download = async () => {
    const r = await startRecordDownload(record);
    if (r.errors.length) notifyError('Download failed', r.errors.join('\n'));
    else say(`Downloading ${record.modelName} on ${r.accepted} server${r.accepted === 1 ? '' : 's'}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: T.radius.md, background: 'var(--il-elev)', border: '1px dashed var(--il-line-strong)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {busy ? `Downloading · ${Math.round(p!.percent)}%`
            : p?.status === 'failed' ? <span style={{ color: 'var(--il-err)' }}><IconAlertTriangle size={12} style={{ verticalAlign: -2 }} /> Failed{p.error ? ` · ${p.error}` : ''}</span>
            : p?.status === 'completed' ? 'Downloaded · waiting for the server list'
            : `Not downloaded yet · ${record.file}`}
        </span>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy || !online}
          title={online ? `Download ${record.versionName} to every server that lacks it` : 'No server online'}
          style={{ height: 28, padding: '0 11px', border: 0, borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy || !online ? 'default' : 'pointer', opacity: busy || !online ? 0.6 : 1, flex: 'none' }}
        >
          {busy ? <IconLoader2 size={13} className="animate-spin" /> : <IconDownload size={13} stroke={2.6} />}
          {busy ? 'Downloading' : p?.status === 'failed' ? 'Retry' : 'Download'}
        </button>
      </div>
      {busy && (
        <div style={{ height: 4, borderRadius: 2, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
          <div style={{ width: `${p!.percent}%`, height: '100%', background: 'var(--il-ember)', transition: 'width .4s' }} />
        </div>
      )}
    </div>
  );
}
