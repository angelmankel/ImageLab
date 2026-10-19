/**
 * Whether the last thing the person did was a touch. Result stepping animates for touch (it
 * should feel like a phone) and cuts for mouse, wheel and keyboard (on a desktop the slide only
 * gets in the way). Listeners go on at first use, in the capture phase so nothing can hide an
 * event from them.
 */
let touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let listening = false;

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch' || e.pointerType === 'pen'; }, true);
  window.addEventListener('keydown', () => { touch = false; }, true);
  window.addEventListener('wheel', () => { touch = false; }, { capture: true, passive: true });
}

export function lastInputWasTouch(): boolean {
  listen();
  return touch;
}
