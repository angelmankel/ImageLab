/**
 * The ONE time / date formatter of the next UI (fix list 2, item 10): 12-hour clock with AM / PM
 * everywhere (history, viewer metadata, queues, logs, Settings). Never `toLocaleTimeString` or
 * `getHours()` padding in a screen: import from here. Pure, local time, no Intl (same output on
 * every browser locale).
 *
 *   formatTime(t)                 "2:54 PM"          ({ seconds: true } → "2:54:07 PM")
 *   formatDate(t)                 "12 Oct"           (another year → "12 Oct 2025")
 *   formatDateTime(t)             "12 Oct · 2:54 PM"
 *   formatWhen(t)                 "Today · 2:54 PM", "Yesterday · 9:05 AM", else formatDateTime
 *   formatClock(d)                "02:07PM"          (the footer clock: Donny's format, 10-19)
 */

export type TimeInput = number | Date;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (t: TimeInput): Date => (t instanceof Date ? t : new Date(t));

/** "2:54 PM"; with seconds "2:54:07 PM". '' for an invalid time. */
export function formatTime(t: TimeInput, opts: { seconds?: boolean } = {}): string {
  const d = toDate(t);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const s = opts.seconds ? `:${pad(d.getSeconds())}` : '';
  return `${h % 12 || 12}:${pad(d.getMinutes())}${s} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "12 Oct", or "12 Oct 2025" when not this year. */
export function formatDate(t: TimeInput, now: TimeInput = Date.now()): string {
  const d = toDate(t);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === toDate(now).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "12 Oct · 2:54 PM" (year added when not this year). */
export function formatDateTime(t: TimeInput, now: TimeInput = Date.now()): string {
  const date = formatDate(t, now);
  return date ? `${date} · ${formatTime(t)}` : '';
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today · 2:54 PM", "Yesterday · 9:05 AM", else "12 Oct · 6:40 PM". */
export function formatWhen(t: TimeInput, now: TimeInput = Date.now()): string {
  const d = toDate(t);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((dayStart(toDate(now)) - dayStart(d)) / 86_400_000);
  if (diff === 0) return `Today · ${formatTime(d)}`;
  if (diff === 1) return `Yesterday · ${formatTime(d)}`;
  return formatDateTime(d, now);
}

/** "02:07PM": the footer clock (two-digit hour, no space; Donny 10-19). */
export function formatClock(t: TimeInput): string {
  const d = toDate(t);
  const h = d.getHours();
  return `${pad(h % 12 || 12)}:${pad(d.getMinutes())}${h < 12 ? 'AM' : 'PM'}`;
}
