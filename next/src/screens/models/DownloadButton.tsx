/**
 * Download a CivitAI version through the existing download manager (rule 13). The logic is the
 * old `features/browser/TileDownload`'s: the version is "on disk" when every online server lists
 * its primary file (or its hash is on a server), "sync" when some do, "downloading" while the
 * manager reports it. `start` fires at every online server that lacks the file. The first
 * download ever flips the list off its Downloaded default (`markDownloaded`).
 */
import { IconCheck, IconDownload, IconLoader2 } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { serversWithModel } from '@/lib/routing';
import { useDownloadsStore } from '@/features/downloads';
import { primaryFile } from '@/features/model-metadata/civitai';
import type { CivitaiModelVersion } from '@/lib/civitai';
import { folderForType } from './civitaiQuery';
import { useInstalled } from './useInstalled';
import { useModels } from './modelsStore';
import { EmberBtn, GhostBtn, RoundAction, type Size } from './bits';

export type DownloadState = 'download' | 'sync' | 'on-disk' | 'downloading' | 'offline';

export function useVersionDownload() {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const rows = useDownloadsStore((s) => s.rows);
  const start = useDownloadsStore((s) => s.start);
  const installed = useInstalled();
  const online = servers.filter((s) => serverInfo[s.id]);

  const stateOf = (v: CivitaiModelVersion): { state: DownloadState; missing: string[] } => {
    if (online.length === 0) return { state: 'offline', missing: [] };
    const have = new Set(serversWithModel(serverInfo, primaryFile(v)?.name ?? ''));
    const missing = online.filter((s) => !have.has(s.id)).map((s) => s.id);
    if (rows.some((r) => r.version_id === v.id && r.status === 'downloading')) return { state: 'downloading', missing };
    if (missing.length === 0 || (have.size === 0 && installed.version(v))) return { state: 'on-disk', missing: [] };
    return { state: have.size > 0 ? 'sync' : 'download', missing };
  };

  const download = async (v: CivitaiModelVersion, modelType?: string) => {
    const { state, missing } = stateOf(v);
    if (state === 'on-disk' || state === 'downloading' || state === 'offline') return;
    const r = await start(v.id, modelType ? folderForType(modelType) : undefined, state === 'sync' ? missing : undefined);
    if (r.errors.length) notifications.show({ color: 'red', title: 'Download refused', message: r.errors.join('\n') });
    else {
      notifications.show({ color: 'ember', message: `Downloading ${v.name} on ${r.accepted} server${r.accepted === 1 ? '' : 's'}` });
      if (r.accepted > 0) useModels.getState().markDownloaded();
    }
  };

  return { stateOf, download, online: online.length };
}

const LABEL: Record<DownloadState, string> = { download: 'Download', sync: 'Sync', 'on-disk': 'Installed', downloading: 'Downloading…', offline: 'No server' };

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
        <RoundAction label={label} tone={state === 'on-disk' ? 'ok' : state === 'sync' ? 'ghost' : 'ember'} onClick={state === 'download' || state === 'sync' ? () => void download(version, modelType) : undefined} disabled={state === 'offline' || state === 'downloading'}>
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
        {icon}{state === 'downloading' ? 'Downloading' : state === 'sync' ? 'Sync' : 'Download'}
      </EmberBtn>
    </span>
  );
}
