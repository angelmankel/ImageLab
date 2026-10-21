/**
 * Download a CivitAI version through the existing download manager (rule 13). The logic is the
 * old `features/browser/TileDownload`'s: the version is "on disk" when every online server lists
 * its primary file (or its hash is on a server), "sync" when some do, "downloading" while the
 * manager reports it. `start` fires at every online server that lacks the file. The first
 * download ever flips the list off its Downloaded default (`markDownloaded`).
 */
import { IconCheck, IconDownload, IconLoader2 } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { serversWithModel } from '@/lib/routing';
import { useDownloadsStore } from '@/features/downloads';
import { useHashPending } from '@/lib/hashPending';
import type { CivitaiModelVersion } from '@/lib/civitai';
import { folderForType, versionDiskState, type VersionDiskState } from './civitaiQuery';
import { useInstalled } from './useInstalled';
import { useModels } from './modelsStore';
import { EmberBtn, GhostBtn, RoundAction, type Size } from './bits';
import { notifyError, say } from '~/app/notify';

/** ONE rule for every download control (`versionDiskState`): any file's hash, then names; "unchecked" when no server could list hashes. */
export type DownloadState = VersionDiskState;

export function useVersionDownload() {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const rows = useDownloadsStore((s) => s.rows);
  const start = useDownloadsStore((s) => s.start);
  const installed = useInstalled();
  const listed = useHashPending((s) => s.listed);
  const online = servers.filter((s) => serverInfo[s.id]);

  const stateOf = (v: CivitaiModelVersion): { state: DownloadState; missing: string[] } => versionDiskState(v, installed.index, {
    online: online.map((s) => s.id),
    withName: (name) => serversWithModel(serverInfo, name),
    hashListed: online.filter((s) => listed[s.host]).length,
    downloading: rows.some((r) => r.version_id === v.id && r.status === 'downloading'),
  });

  const download = async (v: CivitaiModelVersion, modelType?: string) => {
    const { state, missing } = stateOf(v);
    if (state === 'on-disk' || state === 'downloading' || state === 'offline') return;
    const r = await start(v.id, modelType ? folderForType(modelType) : undefined, state === 'sync' ? missing : undefined);
    if (r.errors.length) notifyError('Download failed', r.errors.join('\n'));
    else {
      say(`Downloading ${v.name} on ${r.accepted} server${r.accepted === 1 ? '' : 's'}`);
      if (r.accepted > 0) useModels.getState().markDownloaded();
    }
  };

  return { stateOf, download, online: online.length };
}

const LABEL: Record<DownloadState, string> = { download: 'Download', sync: 'Sync', 'on-disk': 'Installed', downloading: 'Downloading…', offline: 'No server', unchecked: "Can't check" };

/**
 * One version's download control. `shape`: 'pill' (tile / file row: "↓ Download"), 'round' (phone
 * row, 44px), 'icon' (28px ring for "download the latest" on a partly installed tile).
 */
export function DownloadButton({ version, modelType, shape = 'pill', size = 'desktop', h, style }: {
  version: CivitaiModelVersion; modelType?: string; shape?: 'pill' | 'round' | 'icon'; size?: Size; h?: number; style?: React.CSSProperties;
}) {
  const { stateOf, download } = useVersionDownload();
  const { state } = stateOf(version);
  const label = `${LABEL[state]} ${version.name}`;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const icon = state === 'on-disk' ? <IconCheck size={shape === 'round' ? 18 : 13} stroke={3} />
    : state === 'downloading' ? <IconLoader2 size={shape === 'round' ? 18 : 12} className="animate-spin" />
    : <IconDownload size={shape === 'round' ? 18 : 12} stroke={2.6} />;

  if (shape === 'round') {
    return (
      <span onClick={stop} onPointerDown={stop}>
        <RoundAction label={label} tone={state === 'on-disk' ? 'ok' : state === 'sync' ? 'ghost' : 'ember'} onClick={state === 'download' || state === 'sync' || state === 'unchecked' ? () => void download(version, modelType) : undefined} disabled={state === 'offline' || state === 'downloading'}>
          {icon}
        </RoundAction>
      </span>
    );
  }
  if (shape === 'icon') {
    return (
      <span onClick={stop} onPointerDown={stop}>
        <GhostBtn round h={28} tone="ember" label={label} onClick={() => void download(version, modelType)}>{icon}</GhostBtn>
      </span>
    );
  }
  if (state === 'on-disk') {
    return <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: size === 'phone' ? 13 : 12, fontWeight: 800, color: 'var(--il-ok)', flex: 'none', ...style }}><IconCheck size={13} stroke={3} />Installed</span>;
  }
  return (
    <span onClick={stop} onPointerDown={stop} style={{ display: 'inline-flex', ...style }}>
      <EmberBtn size={size} h={h} label={label} disabled={state === 'offline' || state === 'downloading'} onClick={() => void download(version, modelType)} style={style?.flex ? { flex: 1, width: '100%' } : undefined}>
        {icon}{state === 'downloading' ? 'Downloading' : state === 'sync' ? 'Sync' : state === 'unchecked' ? "Can't check · get" : 'Download'}
      </EmberBtn>
    </span>
  );
}
