/**
 * Where the title bridge's tooltip goes (item 20), pure: centred above the anchor with a 6px gap,
 * below it when there is no room above, kept 8px inside the window. All in window px.
 */
export const TIP_GAP = 6;
export const TIP_EDGE = 8;

export function placeTip(
  anchor: { left: number; top: number; width: number; height: number },
  tip: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number; side: 'top' | 'bottom' } {
  const above = anchor.top - TIP_GAP - tip.height;
  const side = above >= TIP_EDGE ? 'top' : 'bottom';
  let top = side === 'top' ? above : anchor.top + anchor.height + TIP_GAP;
  top = Math.max(TIP_EDGE, Math.min(top, view.height - TIP_EDGE - tip.height));
  let left = anchor.left + anchor.width / 2 - tip.width / 2;
  left = Math.max(TIP_EDGE, Math.min(left, view.width - TIP_EDGE - tip.width));
  return { left, top, side };
}
