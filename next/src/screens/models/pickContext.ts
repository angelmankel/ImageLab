/**
 * What the picker was opened for: a step's kind and its `onPick`, read by tiles and the detail
 * panel without prop drilling. Absent (the rail's Models entry) = the free browser.
 */
import { createContext, useContext } from 'react';
import type { ModelKindKey } from './civitaiQuery';
import type { ModelPick } from './pick';

export interface PickCtx {
  kind: ModelKindKey | null;
  onPick: ((pick: ModelPick) => void) | null;
  /** Close the modal (null on the route). */
  close: (() => void) | null;
}

export const PickContext = createContext<PickCtx>({ kind: null, onPick: null, close: null });

/**
 * The picker that is open right now, for layers rendered outside its tree — the model viewer
 * opened from a picker tile (fix list 2, added item: its "Use" must hand the pick to the slot
 * being changed, not add a new model to the step). Set by the step's model list while its picker
 * is open.
 */
let openPicker: PickCtx | null = null;
export function setOpenPicker(ctx: PickCtx | null): void { openPicker = ctx; }

export const usePick = (): PickCtx => {
  const ctx = useContext(PickContext);
  return ctx.onPick ? ctx : openPicker ?? ctx;
};
