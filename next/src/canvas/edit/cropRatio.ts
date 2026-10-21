/** Item 13: the crop flyout's ratio id → a number (w / h), 'orig' = the picture's own, free = null. */
import { CROP_RATIOS } from './editLogic';

export function cropRatioValue(id: string, W: number, H: number): number | null {
  const r = CROP_RATIOS.find((x) => x.id === id)?.ratio ?? null;
  return r === 'orig' ? (H > 0 ? W / H : null) : r;
}
