/**
 * Top-bar clock (rule 9 keeps the bar tight: one muted 12px label, no pill). Local time, 12 h,
 * formatted as NN:NNAM/PM. Re-renders once a minute, on the minute: one
 * setTimeout aimed at the next minute boundary, re-armed after each tick (no per-second interval).
 */
import { useEffect, useState } from 'react';
import { formatClock } from '~/lib/time';

/** "02:07PM" — Donny's format (10-19): two-digit 12-hour clock, no space before AM/PM (`~/lib/time`). */
export const fmtClock = (d: Date): string => formatClock(d);

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      const d = new Date();
      const wait = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20;
      timer = window.setTimeout(() => { setNow(new Date()); arm(); }, wait);
    };
    arm();
    // A sleeping laptop / background tab can delay timers: snap back when the page is shown again.
    const onVis = () => { if (document.visibilityState === 'visible') { setNow(new Date()); window.clearTimeout(timer); arm(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return (
    <time
      dateTime={now.toISOString()}
      title={now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      style={{ color: 'var(--il-muted)', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', padding: '0 4px', whiteSpace: 'nowrap', flex: 'none' }}
    >
      {fmtClock(now)}
    </time>
  );
}
