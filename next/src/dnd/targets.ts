/**
 * The phone fallback for drag and drop (fix list 42: "touch / phone fallback = long-press or
 * send-to menus"): every drop target that wants to be reachable without a mouse registers itself
 * here while it is on screen (`useRegisterDropTarget`), and a long-press on any drag source opens
 * the Send-to sheet (`openSendTo`), which lists them. Desktop uses the same list in a right-click
 * / ⋯ menu when an owner wires it.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import type { DropItem, ImagePayload } from './payload';

export interface DropTarget {
  /** Stable id ("input:step-image", "collection:abc", "session:new", "step:new"). */
  id: string;
  /** "Input of 1 · Image", "Collection · Faces", "New session", "New step…". */
  label: string;
  /** Groups the sheet shows as sections: 'input' | 'collection' | 'session' | 'step' | other. */
  group: string;
  /** Lower comes first inside its group. */
  order?: number;
  accept?: (item: DropItem) => boolean;
  onDrop: (item: DropItem) => void;
}

interface TargetsState {
  targets: Record<string, DropTarget>;
  register: (t: DropTarget) => void;
  unregister: (id: string) => void;
  /** The picture the Send-to sheet is open for, or null. */
  sending: DropItem | null;
  openSendTo: (item: DropItem) => void;
  closeSendTo: () => void;
}

export const useTargets = create<TargetsState>()((set) => ({
  targets: {},
  register: (t) => set((s) => ({ targets: { ...s.targets, [t.id]: t } })),
  unregister: (id) => set((s) => { if (!(id in s.targets)) return s; const next = { ...s.targets }; delete next[id]; return { targets: next }; }),
  sending: null,
  openSendTo: (item) => set({ sending: item }),
  closeSendTo: () => set({ sending: null }),
}));

const EMPTY: DropTarget[] = [];
let lastTargets: Record<string, DropTarget> | null = null;
let lastList: DropTarget[] = EMPTY;
/** The registered targets, sorted by group then order (stable per store change: safe as a selector). */
export function useDropTargets(): DropTarget[] {
  return useTargets((s) => {
    if (s.targets === lastTargets) return lastList;
    lastTargets = s.targets;
    lastList = Object.values(s.targets).sort((a, b) => a.group.localeCompare(b.group) || (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
    return lastList;
  });
}

/** Register while mounted. `deps` re-register when the label / handler change (pass what they close over). */
export function useRegisterDropTarget(target: DropTarget | null, deps: readonly unknown[] = []): void {
  const register = useTargets((s) => s.register);
  const unregister = useTargets((s) => s.unregister);
  useEffect(() => {
    if (!target) return;
    register(target);
    return () => unregister(target.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, register, unregister, ...deps]);
}

/** Open the Send-to sheet for a payload (a long-press on a tile, a "Send to…" menu entry). */
export const openSendTo = (p: ImagePayload): void => useTargets.getState().openSendTo({ kind: 'url', url: p.url, name: p.name, payload: p });
