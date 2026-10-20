/**
 * Items 12 + 13 (+ 39): the tile / pill logic shared by every prompt card — the Image step's and a
 * Workflow step's. Given the positive (and optional negative) text and a way to write each, it
 * reads which tiles are in the text and toggles one: its text goes in (each kind it has) or out.
 */
import { useMemo } from 'react';
import type { Snippet } from '@/lib/types';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { appendPiece, applyEdit, partsBySnippet, promptParts, removeRange, snippetTextFor } from './promptSections';
import { typedText } from './SmartPromptBox';
import { useTiles } from './useTiles';

export interface TileText { text: string; put: (next: string) => void }

export function usePromptTiles(pos: TileText, neg?: TileText) {
  const tiles = useTiles();
  const negText = neg?.text ?? '';
  const posParts = useMemo(() => promptParts(pos.text, tiles.positive, 'positive'), [pos.text, tiles.positive]);
  const negParts = useMemo(() => promptParts(negText, tiles.negative, 'negative'), [negText, tiles.negative]);
  const posOn = useMemo(() => partsBySnippet(posParts), [posParts]);
  const negOn = useMemo(() => partsBySnippet(negParts), [negParts]);
  const typed = useMemo(() => typedText(pos.text, posParts), [pos.text, posParts]);

  const toggle = (s: Snippet) => {
    useWorkspace.getState().touchSnippet(s.id);
    const p = posOn.get(s.id);
    const n = negOn.get(s.id);
    if (p || n) {
      if (p) pos.put(applyEdit(pos.text, removeRange(pos.text, p.start, p.end)));
      if (n && neg) neg.put(applyEdit(neg.text, removeRange(neg.text, n.start, n.end)));
      return;
    }
    const pt = snippetTextFor(s, 'positive');
    const nt = snippetTextFor(s, 'negative');
    if (pt) pos.put(applyEdit(pos.text, appendPiece(pos.text, pt)));
    if (nt && neg) neg.put(applyEdit(neg.text, appendPiece(neg.text, nt)));
  };

  return { tiles, posOn, negOn, typed, toggle };
}
