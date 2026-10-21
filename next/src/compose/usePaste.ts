/**
 * The paste half of every picture slot (fix list 2 item 36). `usePaste({ onItem })` gives:
 *   - `zone`: props for the slot's root — Ctrl+V while the pointer is over it or focus is inside it
 *     pastes into THIS slot (one app-wide listener; a hovered / focused slot wins over the
 *     page-wide `anywhere` slot, which takes a paste on an empty page spot);
 *   - `paste()`: the Paste button (reads the system clipboard);
 *   - `note`: why nothing was pasted, one short line for under the slot (no toast, item 12), gone
 *     after a few seconds or on the next try.
 * Text boxes keep their own paste. `ImageDropZone` uses it, so every drop zone has Paste; a slot
 * that cannot be an ImageDropZone uses this hook + `PasteButton`.
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type FocusEvent } from 'react';
import { readDrop, type DropItem } from '~/dnd';
import { PASTE_MISS, readClipboard, type PasteMiss } from './clipboard';

interface Slot { id: number; hovered: boolean; focused: boolean; anywhere: boolean; off: boolean; take: (item: DropItem) => void; miss: (m: PasteMiss) => void }

const slots = new Map<number, Slot>();
let nextId = 1;
let listening = false;

const isEditable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function onWindowPaste(e: ClipboardEvent) {
  if (e.defaultPrevented || isEditable(e.target)) return;
  const all = [...slots.values()].filter((s) => !s.off);
  const slot = all.find((s) => s.focused) ?? all.find((s) => s.hovered) ?? all.reverse().find((s) => s.anywhere);
  if (!slot) return;
  const item = readDrop(e.clipboardData);
  e.preventDefault();
  if (item) slot.take(item);
  else slot.miss(Array.from(e.clipboardData?.types ?? []).includes('text/plain') ? 'text' : 'empty');
}

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('paste', onWindowPaste);
}

export interface PasteZoneProps {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
  onPaste: (e: ReactClipboardEvent<HTMLElement>) => void;
}

export function usePaste({ onItem, anywhere = false, disabled = false }: { onItem: (item: DropItem) => void; anywhere?: boolean; disabled?: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const take = useRef(onItem);
  take.current = onItem;

  const say = useCallback((text: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    setNote(text);
    if (text) timer.current = setTimeout(() => setNote(null), 5000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const slot = useRef<Slot | null>(null);
  if (!slot.current) slot.current = { id: nextId++, hovered: false, focused: false, anywhere, off: disabled, take: () => {}, miss: () => {} };
  slot.current.anywhere = anywhere;
  slot.current.off = disabled;
  slot.current.take = (item) => { say(null); take.current(item); };
  slot.current.miss = (m) => say(PASTE_MISS[m]);
  useEffect(() => {
    const s = slot.current!;
    listen();
    slots.set(s.id, s);
    return () => { slots.delete(s.id); };
  }, []);

  const paste = useCallback(async () => {
    say(null);
    const r = await readClipboard();
    if ('item' in r) slot.current?.take(r.item);
    else say(PASTE_MISS[r.miss]);
  }, [say]);

  const zone: PasteZoneProps = {
    onPointerEnter: () => { slot.current!.hovered = true; },
    onPointerLeave: () => { slot.current!.hovered = false; },
    onFocus: () => { slot.current!.focused = true; },
    onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) slot.current!.focused = false; },
    // A paste with focus inside the slot (not in a text box): handled here, the window listener sees it prevented.
    onPaste: (e) => {
      if (disabled || isEditable(e.target)) return;
      const item = readDrop(e.clipboardData);
      e.preventDefault();
      if (item) slot.current!.take(item);
      else slot.current!.miss(Array.from(e.clipboardData?.types ?? []).includes('text/plain') ? 'text' : 'empty');
    },
  };

  return { zone, paste, note, say };
}
