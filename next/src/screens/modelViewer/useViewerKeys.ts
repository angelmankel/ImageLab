/**
 * Keys while the viewer is open: Esc closes, ←/→ page the samples. Listened in the capture
 * phase on `window` and stopped there, so the Mantine modal under the viewer (the picker) never
 * sees the Escape that was meant for us. Nothing fires while a text box has focus. Also locks
 * body scroll for as long as the layer is up.
 */
import { useEffect } from 'react';

const TYPING = 'input, textarea, select, [contenteditable="true"]';

export function useViewerKeys(opened: boolean, h: { close: () => void; prev: () => void; next: () => void }) {
  useEffect(() => {
    if (!opened) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.(TYPING)) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); h.close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); h.prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); h.next(); }
    };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [opened, h.close, h.prev, h.next]);
}
