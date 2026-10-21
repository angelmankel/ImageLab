/**
 * List-2 item 22: the slim nav hides when the mouse rests. `idle` turns true `ms` after the last
 * `wake()` (a pointer move / key / tap) and back to false on the next one. `hold` keeps it awake
 * (a popover is open, the pointer is on the nav, the slideshow picker…).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useIdle(ms: number, enabled: boolean, hold = false): { idle: boolean; wake: () => void; sleep: () => void } {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = enabled && !hold ? setTimeout(() => setIdle(true), ms) : null;
  }, [ms, enabled, hold]);
  const wake = useCallback(() => { setIdle(false); arm(); }, [arm]);
  const sleep = useCallback(() => { if (timer.current) clearTimeout(timer.current); if (enabled && !hold) setIdle(true); }, [enabled, hold]);
  useEffect(() => { if (!enabled || hold) setIdle(false); arm(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [enabled, hold, arm]);
  return { idle: enabled && !hold && idle, wake, sleep };
}
