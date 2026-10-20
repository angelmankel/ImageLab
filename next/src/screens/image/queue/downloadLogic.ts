/**
 * Item 14, the pure part of the Download queue (tests/downloads.test.cjs): order, sizes, speed and
 * time left, and what each row may do.
 */
export interface DownloadLike {
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
  downloaded_bytes: number;
  total_bytes: number;
  started_at: number;
  updated_at: number;
  version_id: number;
  url?: string | null;
}

const RANK: Record<DownloadLike['status'], number> = { downloading: 0, failed: 1, cancelled: 2, completed: 3 };

/** Downloading first (oldest started first: it finishes first), then failed, cancelled, done (newest first). */
export function orderDownloads<T extends DownloadLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => RANK[a.status] - RANK[b.status]
    || (a.status === 'downloading' ? a.started_at - b.started_at : b.updated_at - a.updated_at));
}

export function fmtBytes(n: number): string {
  if (!(n > 0)) return '0 MB';
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

/** "~3 min", "~40 s", "~1 h 5 min"; null when the speed is unknown. */
export function etaText(remainingBytes: number, bytesPerSecond: number): string | null {
  if (!(bytesPerSecond > 0) || !(remainingBytes > 0)) return null;
  const s = Math.round(remainingBytes / bytesPerSecond);
  if (s < 60) return `~${Math.max(1, s)} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `~${m} min`;
  return `~${Math.floor(m / 60)} h ${m % 60} min`;
}

/** The second line of a running row: "1.2 / 6.5 GB · 34 MB/s · ~2 min". */
export function progressLine(d: DownloadLike, bytesPerSecond: number): string {
  const size = d.total_bytes > 0 ? `${fmtBytes(d.downloaded_bytes)} / ${fmtBytes(d.total_bytes)}` : fmtBytes(d.downloaded_bytes);
  const speed = bytesPerSecond > 0 ? `${fmtBytes(bytesPerSecond)}/s` : null;
  const eta = d.total_bytes > 0 ? etaText(d.total_bytes - d.downloaded_bytes, bytesPerSecond) : null;
  return [size, speed, eta].filter(Boolean).join(' · ');
}

/** Retry needs a CivitAI version id or the URL it came from (a newer server reports it; it also has its own retry). */
export const canRetry = (d: DownloadLike): boolean => (d.status === 'failed' || d.status === 'cancelled');

export function downloadCounts(rows: readonly DownloadLike[]): { active: number; failed: number; finished: number } {
  let active = 0; let failed = 0; let finished = 0;
  for (const r of rows) {
    if (r.status === 'downloading') active++;
    else { finished++; if (r.status === 'failed') failed++; }
  }
  return { active, failed, finished };
}
