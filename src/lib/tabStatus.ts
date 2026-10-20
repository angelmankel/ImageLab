/**
 * What the browser tab shows: a favicon that turns a colour for the app's state, with a progress
 * ring while something renders, and the percent in the title. Pure, so it can be tested; the hook
 * `useTabStatus` feeds it the stores and writes the result into the document head.
 */

export type TabKind = 'idle' | 'queued' | 'running' | 'done' | 'error';

export type TabState = { kind: TabKind; percent: number | null };

/** Something that can be busy: the image queue, the video run, the workflow run. */
export type TabSource = { busy: boolean; running: boolean; percent: number | null };

const COLORS: Record<TabKind, string> = {
  idle: '#24A6A9',
  queued: '#8a8f98',
  running: '#f5a524',
  done: '#2fbf71',
  error: '#e5484d',
};

const MARKS: Record<TabKind, string> = { idle: '', queued: '… ', running: '▶ ', done: '✓ ', error: '✕ ' };

/** The live state: running beats queued beats idle. `flash` is a latched done/error the hook holds. */
export function tabState(sources: TabSource[], flash: 'done' | 'error' | null): TabState {
  const running = sources.find((s) => s.running);
  if (running) {
    const withPercent = sources.find((s) => s.running && s.percent !== null);
    return { kind: 'running', percent: withPercent ? clampPercent(withPercent.percent as number) : null };
  }
  if (sources.some((s) => s.busy)) return { kind: 'queued', percent: null };
  if (flash) return { kind: flash, percent: null };
  return { kind: 'idle', percent: null };
}

export function clampPercent(p: number): number {
  return Math.min(100, Math.max(0, Math.round(p)));
}

export function tabTitle(state: TabState, base: string): string {
  if (state.kind === 'running' && state.percent !== null) return `▶ ${state.percent}% · ${base}`;
  if (state.kind === 'done') return `✓ Done · ${base}`;
  if (state.kind === 'error') return `✕ Error · ${base}`;
  return `${MARKS[state.kind]}${base}`;
}

/**
 * The app icon (a rounded square with two tiles) in the state's colour. While running, a ring
 * around it fills clockwise from the top; with no percent yet it shows as a faint full ring.
 */
export function tabIconSvg(state: TabState): string {
  const color = COLORS[state.kind];
  const r = 27;
  const len = 2 * Math.PI * r;
  let ring = '';
  if (state.kind === 'running' || state.kind === 'queued') {
    const track = `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.3" stroke-width="8"/>`;
    const filled = state.percent === null ? 0 : (state.percent / 100) * len;
    const arc = filled > 0
      ? `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${filled.toFixed(2)} ${len.toFixed(2)}" transform="rotate(-90 32 32)"/>`
      : '';
    ring = track + arc;
  }
  // With a ring the square shrinks inside it; without one it fills the icon like the app icon.
  const [x, size, rx] = ring ? [17, 30, 7] : [4, 56, 13];
  const tile = size * 0.31;
  const gap = size * 0.16;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${ring}`
    + `<rect x="${x}" y="${x}" width="${size}" height="${size}" rx="${rx}" fill="${color}"/>`
    + `<rect x="${x + gap}" y="${x + gap}" width="${tile}" height="${tile}" rx="${tile * 0.22}" fill="#fff"/>`
    + `<rect x="${x + size - gap - tile}" y="${x + size - gap - tile}" width="${tile}" height="${tile}" rx="${tile * 0.22}" fill="#fff" fill-opacity="0.5"/>`
    + '</svg>';
}

export function tabIconHref(state: TabState): string {
  return `data:image/svg+xml,${encodeURIComponent(tabIconSvg(state))}`;
}
