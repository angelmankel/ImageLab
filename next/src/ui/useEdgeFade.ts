/**
 * A sideways row fades out at an edge while there is more to scroll that way (the snippet
 * category pills): a CSS mask on the scroller itself, so it works on any background. Returns a
 * callback ref and the style to spread on the scroller; re-reads on scroll and resize.
 */
import { useCallback, useRef, useState, type CSSProperties } from 'react';

const FADE = 28;

export function useEdgeFade<T extends HTMLElement>(): { ref: (el: T | null) => void; style: CSSProperties } {
  const [edges, setEdges] = useState({ left: false, right: false });
  const off = useRef<(() => void) | null>(null);
  const ref = useCallback((el: T | null) => {
    off.current?.();
    off.current = null;
    if (!el) return;
    const read = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    off.current = () => { el.removeEventListener('scroll', read); ro.disconnect(); };
  }, []);
  const mask = edges.left || edges.right
    ? `linear-gradient(to right, ${edges.left ? `transparent, #000 ${FADE}px` : '#000'}, ${edges.right ? `#000 calc(100% - ${FADE}px), transparent` : '#000'})`
    : undefined;
  return { ref, style: mask ? { maskImage: mask, WebkitMaskImage: mask } : {} };
}
