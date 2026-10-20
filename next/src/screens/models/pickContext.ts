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
export const usePick = () => useContext(PickContext);
