/**
 * Layers portalled to the body on top of an open Mantine Modal / Drawer (the fullscreen model
 * viewer). The modal's scroll lock (react-remove-scroll) cancels every touch scroll and wheel
 * outside its own DOM, so the viewer could neither scroll nor swipe on a phone. Every Modal and
 * Drawer gets this ref as a scroll "shard" (theme defaults); the lock reads its shards at event
 * time, so the viewer only has to point the ref at its root while it is mounted.
 */
export const viewerLayerRef: { current: HTMLElement | null } = { current: null };

/**
 * FIXLIST-2 (ADDED after close): a select / menu / popover list opened from inside a modal is
 * portalled to the body, OUTSIDE the modal's DOM, so the modal's scroll lock ate its mouse wheel
 * and touch scroll (the model viewer's version list would not scroll). This "ref" resolves, at
 * event time, to the floating list the current wheel / touch happens in — every Mantine Popover-
 * based dropdown (Select, Combobox, our SearchSelect, Menu, Popover) and our context menu — and is
 * passed as a shard to every Modal / Drawer (theme defaults). react-remove-scroll then lets that
 * list scroll itself (and still stops the page behind from scrolling).
 */
const FLOATING = '.m_38a85659, .mantine-Popover-dropdown, .mantine-Combobox-dropdown, .mantine-Menu-dropdown, .il-dd, [data-il-ctxmenu]';
let lastTarget: Element | null = null;
if (typeof window !== 'undefined') {
  const note = (e: Event) => { lastTarget = e.target instanceof Element ? e.target : null; };
  // Capture on window: runs before the lock's own document listeners.
  for (const t of ['wheel', 'touchstart', 'touchmove'] as const) window.addEventListener(t, note, { capture: true, passive: true });
}
export const floatingLayerRef: { readonly current: HTMLElement | null } = {
  get current() { return lastTarget?.closest<HTMLElement>(FLOATING) ?? null; },
};
