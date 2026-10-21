/**
 * Item 47 (tab title / favicon) + item 19 (footer): the app's job progress in one small shape, pure
 * so it can be tested (tests/jobProgress.test.cjs). `jobProgress.ts` feeds it the stores; the tab
 * title, the favicon and the footer all read the same answer.
 *
 * State order: running beats queued beats a latched done / error beats offline beats idle.
 */
import type { QueueRow } from './queueLogic';
import { LOGO_BLUE, markPath, viewBoxFor } from './monolith';

export type JobState = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'offline';

export interface JobProgress {
  state: JobState;
  /** 0..100 of the running job, null when it has not reported steps yet. */
  percent: number | null;
  /** 1-based index of the running job's step, null when unknown. */
  stepIndex: number | null;
  /** How many steps the session has (the title says "step 2" only when there is more than one). */
  stepCount: number;
  running: number;
  queued: number;
  /** Model downloads in flight, and their summed progress 0..100 (null = none / unknown size). */
  downloads: number;
  downloadPercent: number | null;
  /** A short human line: "42% · step 2 · 3 queued", "3 queued", "Done", "Offline", "↓ 37%", "Ready". */
  label: string;
}

export interface JobInput {
  rows: readonly QueueRow[];
  /** Step ids in rail order. */
  stepIds: readonly string[];
  flash: 'done' | 'error' | null;
  offline: boolean;
  downloads: number;
  downloadPercent: number | null;
}

export const IDLE: JobProgress = Object.freeze({
  state: 'idle', percent: null, stepIndex: null, stepCount: 1, running: 0, queued: 0, downloads: 0, downloadPercent: null, label: 'Ready',
}) as JobProgress;

const pct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function jobProgressOf(i: JobInput): JobProgress {
  const runningRows = i.rows.filter((r) => r.status === 'running');
  const queued = i.rows.length - runningRows.length;
  const first = runningRows.find((r) => r.progress != null) ?? runningRows[0] ?? null;
  const percent = first?.progress != null ? pct(first.progress * 100) : null;
  const idx = first?.stepId ? i.stepIds.indexOf(first.stepId) : -1;
  const stepIndex = idx >= 0 ? idx + 1 : null;
  const state: JobState = runningRows.length ? 'running' : queued ? 'queued' : i.flash ?? (i.offline ? 'offline' : 'idle');
  const downloadPercent = i.downloads && i.downloadPercent != null ? pct(i.downloadPercent) : null;
  const base: Omit<JobProgress, 'label'> = {
    state, percent, stepIndex, stepCount: i.stepIds.length || 1, running: runningRows.length, queued, downloads: i.downloads, downloadPercent,
  };
  return { ...base, label: labelOf(base) };
}

function labelOf(p: Omit<JobProgress, 'label'>): string {
  const step = p.stepIndex != null && p.stepCount > 1 ? `step ${p.stepIndex}` : null;
  const more = p.queued ? `${p.queued} queued` : null;
  switch (p.state) {
    case 'running': return [p.percent != null ? `${p.percent}%` : 'Running', step, more].filter(Boolean).join(' · ');
    case 'queued': return `${p.queued} queued`;
    case 'done': return 'Done';
    case 'error': return 'Error';
    case 'offline': return 'Offline';
    default: return p.downloads ? `↓ ${p.downloadPercent != null ? `${p.downloadPercent}%` : p.downloads}` : 'Ready';
  }
}

const MARK: Record<JobState, string> = { running: '▶ ', queued: '⏳ ', done: '✓ ', error: '⚠ ', offline: '⚠ ', idle: '' };

/** The browser tab's title: short, the live part first. Idle with no download = just the base. */
export function tabTitleOf(p: JobProgress, base = 'ImageLab'): string {
  if (p.state === 'idle') return p.downloads ? `${p.label} · ${base}` : base;
  return `${MARK[p.state]}${p.label} · ${base}`;
}

const COLOR: Record<JobState, string> = {
  idle: LOGO_BLUE, running: LOGO_BLUE, queued: '#8A8A94', done: '#3DD68C', error: '#C96A6A', offline: '#C96A6A',
};

/**
 * The favicon for a live state: a dark disc with the logo mark in the state's colour, and around it a ring
 * that fills clockwise with the running job's percent (or the download's while only that runs).
 * Idle with nothing downloading returns null: keep the app's own icon.
 */
export function faviconSvgOf(p: JobProgress): string | null {
  const ringPct = p.state === 'running' ? p.percent : p.state === 'idle' && p.downloads ? p.downloadPercent : null;
  if (p.state === 'idle' && !p.downloads) return null;
  const color = p.state === 'idle' ? '#6FA0CF' : COLOR[p.state];
  const r = 26;
  const len = 2 * Math.PI * r;
  const ring = p.state === 'running' || p.state === 'queued' || (p.state === 'idle' && p.downloads)
    ? `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-opacity=".28" stroke-width="9"/>`
      + (ringPct ? `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${((ringPct / 100) * len).toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 32 32)"/>` : '')
    : `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="9"/>`;
  // The logo's mark (Monolith, cut 11 for a tab-icon size) in the state's colour, inside the ring.
  const mark = `<svg x="18" y="18" width="28" height="28" viewBox="${viewBoxFor(11)}"><path d="${markPath(11)}" fill="${color}"/></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="21" fill="#0c0e11"/>${ring}${mark}</svg>`;
}

export function faviconHrefOf(p: JobProgress): string | null {
  const svg = faviconSvgOf(p);
  return svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : null;
}

/** Same answer, same object: lets the store skip a set (and every subscriber's render). */
export function sameProgress(a: JobProgress, b: JobProgress): boolean {
  return a.state === b.state && a.percent === b.percent && a.stepIndex === b.stepIndex && a.stepCount === b.stepCount
    && a.running === b.running && a.queued === b.queued && a.downloads === b.downloads && a.downloadPercent === b.downloadPercent;
}
