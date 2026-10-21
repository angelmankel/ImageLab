/**
 * The device's form factor, live (mobile pass, m-shell): phone shell or not, orientation, window sides.
 * One module-level store fed by resize / orientationchange / pointer media changes; `useSyncExternalStore`
 * so a component that only reads `phone` re-renders only when `phone` changes.
 *
 *   const { phone, landscape } = useFormFactor();
 *   const phone = useIsPhone();              // old callers keep working
 *   const land  = usePhoneLandscape();       // phone AND landscape (the two-pane frame)
 *
 * Also stamps <html data-phone data-orient="portrait|landscape"> for CSS.
 */
import { useSyncExternalStore } from 'react';
import { computeFormFactor, sameFormFactor, type FormFactor } from './formFactorLogic';

const SSR: FormFactor = { phone: false, landscape: true, portrait: false, short: 800, long: 1280, coarse: false };

function read(): FormFactor {
  if (typeof window === 'undefined') return SSR;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const type = (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.type === 'string') ? screen.orientation.type : null;
  return computeFormFactor({
    vw: window.innerWidth, vh: window.innerHeight,
    sw: typeof screen !== 'undefined' ? screen.width : 0, sh: typeof screen !== 'undefined' ? screen.height : 0,
    coarse, orientationType: type,
  });
}

let current: FormFactor = read();
const listeners = new Set<() => void>();

function stamp(ff: FormFactor) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (ff.phone) el.setAttribute('data-phone', ''); else el.removeAttribute('data-phone');
  el.setAttribute('data-orient', ff.landscape ? 'landscape' : 'portrait');
}

function refresh() {
  const next = read();
  if (sameFormFactor(next, current)) return;
  current = next;
  stamp(current);
  for (const l of listeners) l();
}

let raf = 0;
function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; refresh(); });
}

if (typeof window !== 'undefined') {
  stamp(current);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', () => { schedule(); setTimeout(refresh, 250); }, { passive: true });
  try { screen.orientation?.addEventListener('change', schedule); } catch { /* older browsers */ }
  try { window.matchMedia('(pointer: coarse)').addEventListener('change', schedule); } catch { /* old Safari */ }
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** The snapshot right now (non-React code: notifications position, handlers). */
export function getFormFactor(): FormFactor { return current; }

export function useFormFactor(): FormFactor {
  return useSyncExternalStore(subscribe, getFormFactor, () => SSR);
}

/** Phone shell? (re-renders only when it flips). */
export function useIsPhoneFF(): boolean {
  return useSyncExternalStore(subscribe, () => current.phone, () => false);
}

/** Phone shell AND landscape: the two-pane phone layout. */
export function usePhoneLandscape(): boolean {
  return useSyncExternalStore(subscribe, () => current.phone && current.landscape, () => false);
}
