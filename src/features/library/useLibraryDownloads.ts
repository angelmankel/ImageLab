import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import type { Server } from '@/lib/storage';
import { useDownloadsStore } from '@/features/downloads';
import { displayName, knownFileNames, serverHasFile, type ModelLibraryEntry } from '@/lib/modelLibrary';

/**
 * Install state and downloading for "My models".
 *
 * Downloads go through the downloads store's `start`, as the model window and browser tiles do:
 * by default to every online server that lacks the file, or to one server the user picks. A
 * server that already has a file skips it cheaply, but we skip installed ones up front anyway so
 * the user is told what was left alone.
 */

export const ALL_SERVERS = 'all';

export type EntryStatus = {
  /** Online servers whose model lists have this file. */
  on: Server[];
  /** Target servers that lack it. */
  missing: Server[];
  /** On every target server (false when no server is online — nothing to compare with). */
  installed: boolean;
  /** Some server's hash index knows the SHA256 (the index is merged, so not which one). */
  hashMatch: boolean;
  downloading: boolean;
};

export type BulkReport = { started: number; installed: number; busy: number; failed: string[] };

const EMPTY_STATUS = new Map<number, EntryStatus>();

export function useLibraryDownloads(entries: ModelLibraryEntry[]) {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const hashes = useStore((s) => s.modelHashes);
  const rows = useDownloadsStore((s) => s.rows);
  const start = useDownloadsStore((s) => s.start);
  const [target, setTarget] = useState<string>(ALL_SERVERS);

  const online = useMemo(() => servers.filter((s) => serverInfo[s.id]), [servers, serverInfo]);
  // A picked server that went offline falls back to "all" rather than silently doing nothing.
  const effectiveTarget = target !== ALL_SERVERS && online.some((s) => s.id === target) ? target : ALL_SERVERS;
  const targets = useMemo(
    () => (effectiveTarget === ALL_SERVERS ? online : online.filter((s) => s.id === effectiveTarget)),
    [online, effectiveTarget],
  );

  const status = useMemo(() => {
    if (entries.length === 0) return EMPTY_STATUS;
    const busy = new Set(rows.filter((r) => r.status === 'downloading').map((r) => r.version_id));
    const map = new Map<number, EntryStatus>();
    for (const e of entries) {
      const { names, hashMatch } = knownFileNames(e, hashes);
      let on = online.filter((s) => serverHasFile(serverInfo[s.id] as unknown as Record<string, unknown>, names));
      // Files outside the listed folders (diffusion_models, text encoders, …) are only in the
      // hash index. With one server online a hash match can only be that server; with several,
      // the merged index cannot say which, so treat it as installed rather than risk a duplicate
      // multi-GB download.
      const hashOnly = hashMatch && on.length === 0;
      if (hashOnly && online.length === 1) on = online;
      const onIds = new Set(on.map((s) => s.id));
      const missing = hashOnly && online.length > 1 ? [] : targets.filter((s) => !onIds.has(s.id));
      map.set(e.versionId, {
        on,
        missing,
        installed: targets.length > 0 && missing.length === 0,
        hashMatch,
        downloading: busy.has(e.versionId),
      });
    }
    return map;
  }, [entries, hashes, online, serverInfo, targets, rows]);

  /** Start downloads one after another (each start polls the servers once). */
  const downloadMany = async (list: ModelLibraryEntry[]): Promise<BulkReport> => {
    const report: BulkReport = { started: 0, installed: 0, busy: 0, failed: [] };
    for (const e of list) {
      const st = status.get(e.versionId);
      if (!st) continue;
      if (st.downloading) { report.busy++; continue; }
      if (st.installed) { report.installed++; continue; }
      if (st.missing.length === 0) continue; // no server online
      const r = await start(e.versionId, undefined, st.missing.map((s) => s.id)).catch((err: unknown) => ({
        accepted: 0, errors: [err instanceof Error ? err.message : String(err)],
      }));
      if (r.accepted > 0) report.started++;
      if (r.errors.length) report.failed.push(`${displayName(e)} — ${r.errors[0]}`);
    }
    notifyReport(report, list.length === 1 ? list[0] : null);
    return report;
  };

  return { online, targets, target: effectiveTarget, setTarget, status, downloadMany };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function notifyReport(r: BulkReport, single: ModelLibraryEntry | null) {
  if (single) {
    const name = displayName(single);
    if (r.installed) notifications.show({ title: 'Already installed', message: `${name} is already on every chosen server.`, color: 'gray' });
    else if (r.busy) notifications.show({ title: 'Already downloading', message: name, color: 'gray' });
    else if (r.failed.length) notifications.show({ title: 'Download refused', message: r.failed[0], color: 'red', autoClose: 10000 });
    else if (r.started) notifications.show({ title: 'Download started', message: name, color: 'teal' });
    return;
  }
  const parts: string[] = [];
  if (r.started) parts.push(`started ${plural(r.started, 'download')}`);
  if (r.installed) parts.push(`skipped ${r.installed} already installed`);
  if (r.busy) parts.push(`${r.busy} already downloading`);
  if (r.failed.length) parts.push(`${r.failed.length} refused`);
  const message = parts.length ? parts.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : 'Nothing to download.';
  notifications.show({
    title: r.failed.length ? 'Some downloads were refused' : 'Downloads',
    message: r.failed.length ? `${message} ${r.failed.slice(0, 3).join('; ')}` : message,
    color: r.failed.length ? 'red' : r.started ? 'teal' : 'gray',
    autoClose: r.failed.length ? 10000 : 5000,
  });
}
