/**
 * "Mine" — the user's saved whole prompts, image and video (`lib/promptMine.ts` holds the data
 * rules). Kept in this browser like the snippet library.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/storage';
import { addMine, nameFor, removeMine, type MinePrompt, type PromptKind } from '@/lib/promptMine';

interface MineState {
  items: MinePrompt[];
  /** Save one; returns its id, or null when an identical prompt was already there. */
  save: (p: { kind: PromptKind; positive: string; negative?: string; name?: string; theme?: string }) => string | null;
  remove: (id: string) => void;
  /** Put one back after an Undo. */
  restore: (p: MinePrompt) => void;
}

export const useMine = create<MineState>()(
  persist(
    (set, get) => ({
      items: [],
      save: (p) => {
        const item: MinePrompt = { id: uid(), kind: p.kind, name: p.name?.trim() || nameFor(p.positive), positive: p.positive.trim(), negative: p.negative?.trim() || undefined, createdAt: Date.now(), theme: p.theme };
        const next = addMine(get().items, item);
        if (next.length === get().items.length) return null;
        set({ items: next });
        return item.id;
      },
      remove: (id) => set({ items: removeMine(get().items, id) }),
      restore: (p) => set({ items: addMine(get().items, p) }),
    }),
    { name: 'imagelab.prompts.mine.v1', partialize: (s) => ({ items: s.items }) },
  ),
);
