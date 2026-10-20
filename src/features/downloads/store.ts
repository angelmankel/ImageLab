import { create } from 'zustand';
import { useStore } from '@/lib/store';
import {
  fetchDownloads, startDownload, startUrlDownload, cancelDownload, retryDownload, type Download,
} from '@/lib/comfy';
import { withCivitaiAuth } from '@/lib/civitai';
import { useLibraryStore } from '@/features/library/store';
import { onePerOrigin } from '@/lib/downloadRows';

/**
 * Feature-scoped store for the downloads panel — separate from the global app
 * store and the generation queue.
 *
 * Downloads are per-server (each ComfyUI box runs its own ImageLab node), but
 * under round-robin routing a model is only *usable* if it's on every server.
 * So `start` fires the download at every online server; servers that already
 * have the file skip it cheaply. `refresh` polls every server and flattens the
 * results into one tagged list. Servers on one origin (a pod's image and video ComfyUI) share one
 * download manager and one disk, so they count as one server here (`onePerOrigin`).
 */

/** One download, tagged with the server it's running on. */
export type DownloadRow = Download & {
  serverId: string;
  serverName: string;
  /** `${serverId}:${version_id}` — unique across servers. */
  rowId: string;
};

/** Per-row rolling speed samples — last 3 seconds of (timestamp, bytes)
 *  observations. Module-local because samples are noisy state we don't want
 *  triggering React re-renders; consumers read the derived MB/s via the
 *  `bytesPerSecond` selector. */
const _samples: Map<string, Array<{ t: number; bytes: number }>> = new Map();
const _SPEED_WINDOW_MS = 3000;

/** Aggregate progress across all currently-downloading rows. Returned as a
 *  fraction in [0, 1]; `null` when there's nothing active to track. Drives
 *  the `<DownloadsButton>` progress ring. */
function _aggregateProgress(rows: DownloadRow[]): number | null {
  let totalBytes = 0;
  let doneBytes = 0;
  for (const row of rows) {
    if (row.status !== 'downloading' || row.total_bytes <= 0) continue;
    totalBytes += row.total_bytes;
    doneBytes  += row.downloaded_bytes;
  }
  if (totalBytes === 0) return null;
  return Math.max(0, Math.min(1, doneBytes / totalBytes));
}

export type StartResult = { accepted: number; errors: string[] };

type DownloadsState = {
  rows: DownloadRow[];
  /** True while a refresh is in flight — lets the polling hook skip overlap. */
  refreshing: boolean;
  /** Poll every server for its downloads and rebuild `rows`. */
  refresh: () => Promise<void>;
  /**
   * Start a CivitAI version downloading. Fires at every online server by
   * default; pass `serverIds` to target a subset (e.g. syncing a model to
   * just the servers missing it). Resolves to how many servers accepted it
   * and the refusals of the rest.
   */
  start: (versionId: number, folder?: string, serverIds?: string[]) => Promise<StartResult>;
  /**
   * Start one file downloading by URL (a CivitAI version's non-primary file — a Wan LoRA's other
   * half — or any https file) into `folder` under `filename`. A civitai.com URL gets the app's
   * API token appended, as the browser's own CivitAI calls do. Same fan-out as `start`.
   */
  startUrl: (url: string, folder: string, filename: string, serverIds?: string[]) => Promise<StartResult>;
  /** Cancel an in-flight row, or dismiss a finished/failed one. */
  cancel: (row: DownloadRow) => Promise<void>;
  /** Start a failed / cancelled row again on its server. Rejects with the server's reason. */
  retry: (row: DownloadRow) => Promise<void>;
  /** Dismiss every row that is not downloading (completed, failed, cancelled). */
  clearFinished: () => Promise<void>;
  /** Bytes per second for a row, derived from the last 3s of poll deltas.
   *  Returns 0 for rows we have no samples for (just-started downloads). */
  bytesPerSecond: (rowId: string) => number;
  /** Aggregate active-download progress in [0, 1], or null when idle. */
  aggregateProgress: () => number | null;
};

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  rows: [],
  refreshing: false,

  refresh: async () => {
    if (get().refreshing) return;
    set({ refreshing: true });
    try {
      const servers = onePerOrigin(useStore.getState().servers);
      const results = await Promise.allSettled(
        servers.map(async (srv) => {
          const downloads = await fetchDownloads(srv.host);
          return downloads.map((d): DownloadRow => ({
            ...d,
            serverId: srv.id,
            serverName: srv.name,
            rowId: `${srv.id}:${d.version_id}`,
          }));
        }),
      );
      const rows: DownloadRow[] = [];
      for (const r of results) if (r.status === 'fulfilled') rows.push(...r.value);

      // A download that just transitioned to "completed" means its server
      // gained a model — re-fetch that server's capabilities so availability
      // and the modal's sync/on-disk status update without a manual reload.
      const prev = get().rows;
      const justFinished = new Set<string>();
      for (const row of rows) {
        if (row.status !== 'completed') continue;
        const before = prev.find((r) => r.rowId === row.rowId);
        if (before?.status === 'downloading') justFinished.add(row.serverId);
      }

      // Record a sample for every active row, then trim to the rolling
      // window. The speed selector reads the oldest sample in the window
      // and derives bytes/sec from the delta. Rows that finished, errored,
      // or vanished have their sample lists dropped — keeps the map from
      // growing unbounded across long sessions.
      const now = performance.now();
      const aliveActive = new Set<string>();
      for (const row of rows) {
        if (row.status !== 'downloading') continue;
        aliveActive.add(row.rowId);
        const list = _samples.get(row.rowId) ?? [];
        list.push({ t: now, bytes: row.downloaded_bytes });
        // Trim — keep at least 2 samples so we can always derive a rate.
        while (list.length > 2 && now - list[0].t > _SPEED_WINDOW_MS) {
          list.shift();
        }
        _samples.set(row.rowId, list);
      }
      for (const key of _samples.keys()) {
        if (!aliveActive.has(key)) _samples.delete(key);
      }

      set({ rows });

      // Funnel the capability refresh through the store action so this path
      // dedupes against the WS `onOpen` refresh instead of racing it.
      for (const serverId of justFinished) {
        void useStore.getState().refreshServerInfo(serverId);
      }
    } finally {
      set({ refreshing: false });
    }
  },

  start: async (versionId, folder, serverIds) => {
    const { servers, serverInfo } = useStore.getState();
    const online = servers.filter((s) => serverInfo[s.id]);
    const targets = onePerOrigin(serverIds ? online.filter((s) => serverIds.includes(s.id)) : online);
    const results = await Promise.allSettled(targets.map((s) => startDownload(s.host, versionId, folder)));
    const accepted = results.filter((r) => r.status === 'fulfilled').length;
    const errors = results.flatMap((r, i) =>
      r.status === 'rejected' ? [`${targets[i].name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : []);
    // Every download started from the app lands in the device-local "My models" list.
    if (accepted > 0) void useLibraryStore.getState().recordDownload(versionId);
    await get().refresh();
    return { accepted, errors };
  },

  startUrl: async (url, folder, filename, serverIds) => {
    const { servers, serverInfo } = useStore.getState();
    const online = servers.filter((s) => serverInfo[s.id]);
    const targets = onePerOrigin(serverIds ? online.filter((s) => serverIds.includes(s.id)) : online);
    const results = await Promise.allSettled(targets.map((s) => startUrlDownload(s.host, withCivitaiAuth(url), folder, filename)));
    const accepted = results.filter((r) => r.status === 'fulfilled').length;
    const errors = results.flatMap((r, i) =>
      r.status === 'rejected' ? [`${targets[i].name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : []);
    await get().refresh();
    return { accepted, errors };
  },

  cancel: async (row) => {
    const srv = useStore.getState().servers.find((s) => s.id === row.serverId);
    if (srv) await cancelDownload(srv.host, row.version_id).catch(() => { /* row may already be gone */ });
    // Drop it optimistically; the next refresh reconciles.
    _samples.delete(row.rowId);
    set({ rows: get().rows.filter((r) => r.rowId !== row.rowId) });
    void get().refresh();
  },

  retry: async (row) => {
    const srv = useStore.getState().servers.find((s) => s.id === row.serverId);
    if (!srv) throw new Error('That server is gone');
    await retryDownload(srv.host, row);
    await get().refresh();
  },

  clearFinished: async () => {
    const done = get().rows.filter((r) => r.status !== 'downloading');
    if (!done.length) return;
    const { servers } = useStore.getState();
    set({ rows: get().rows.filter((r) => r.status === 'downloading') });
    await Promise.allSettled(done.map((r) => {
      const srv = servers.find((s) => s.id === r.serverId);
      return srv ? cancelDownload(srv.host, r.version_id) : Promise.resolve();
    }));
    void get().refresh();
  },

  bytesPerSecond: (rowId) => {
    const list = _samples.get(rowId);
    if (!list || list.length < 2) return 0;
    const first = list[0];
    const last = list[list.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return Math.max(0, (last.bytes - first.bytes) / dt);
  },

  aggregateProgress: () => _aggregateProgress(get().rows),
}));
