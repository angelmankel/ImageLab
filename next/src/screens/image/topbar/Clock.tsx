/**
 * Top-bar clock (rule 9 keeps the bar tight: one muted 12px label, no pill). Local time, 24 h,
 * formatted by the browser's locale through Intl. Re-renders once a minute, on the minute: one
 * setTimeout aimed at the next minute boundary, re-armed after each tick (no per-second interval).
 */
import { useEffect, useState } from 'react';

const FMT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

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
      {FMT.format(now)}
    </time>
  );
}
