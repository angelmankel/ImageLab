/**
 * The thumbnail strip under the picture: its own row (rule 1), scrolls sideways, the current
 * thumb ember-outlined and kept in view, "load more" at the end while the gallery has more.
 * Thumbs are stills even for clips; a hidden (NSFW) sample shows a dim eye instead of a blur.
 * Item 28: the next gallery page loads by itself when the strip's end scrolls into view (a few
 * shimmer placeholder thumbs while it loads); a tap on the current thumb opens it full screen.
 * `scrollKey` keeps its sideways position per model + version (`useKeepScroll`): a reopen lands
 * where it was, and only centres the current thumb when that one is out of view.
 */
import { useCallback, useEffect, useRef } from 'react';
import { IconEyeOff } from '@tabler/icons-react';
import type { CivitaiImage } from '@/lib/civitai';
import { civitaiThumbUrl, previewStill } from '@/lib/civitai';
import { COVER_FALLBACK } from '~/screens/models/bits';
import { useKeepScroll, keptScroll } from '~/screens/models/useKeepScroll';
import { Skeleton } from '~/ui';

export const STRIP_H = 84;
const THUMB = 66;

export function ThumbStrip({ images, index, onSelect, onOpen, isHidden, hasMore, onMore, loading, loadingMore, scrollKey = null }: {
  images: CivitaiImage[]; index: number; onSelect: (i: number) => void; isHidden: (img: CivitaiImage) => boolean;
  /** A tap on the thumb that is already shown: full screen (item 31). */
  onOpen?: (i: number) => void;
  hasMore: boolean; onMore: () => void; loading: boolean; loadingMore?: boolean; scrollKey?: string | null;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const keep = useKeepScroll(scrollKey);
  const setRow = useCallback((el: HTMLDivElement | null) => { row.current = el; keep(el); }, [keep]);
  const first = useRef(true);
  // The end of the strip in view → the next page (item 28). Re-armed per page.
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = end.current;
    const root = row.current;
    if (!el || !root || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) onMore(); }, { root, rootMargin: '0px 400px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onMore, images.length]);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    const r = row.current;
    const el = r?.children[index] as HTMLElement | undefined;
    if (!r || !el) return;
    const a = el.getBoundingClientRect();
    const b = r.getBoundingClientRect();
    // On open with a kept position, leave the strip where it was if the current thumb shows.
    if (isFirst && keptScroll(scrollKey) && a.left >= b.left && a.right <= b.right) return;
    // Centre it by scrolling the strip itself only (scrollIntoView would also move the phone's page).
    r.scrollTo({ left: r.scrollLeft + (a.left - b.left) - (b.width - a.width) / 2, behavior: 'smooth' });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={setRow} className="il-scroll-x" style={{ height: STRIP_H, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', overflowX: 'auto', background: 'var(--il-bg)', borderTop: '1px solid var(--il-line)', touchAction: 'pan-x pan-y' }}>
      {images.map((img, i) => {
        const on = i === index;
        const hidden = isHidden(img);
        return (
          <button key={img.url + i} type="button" aria-label={`Image ${i + 1}`} aria-pressed={on} onClick={() => (on && onOpen ? onOpen(i) : onSelect(i))}
            style={{ width: THUMB, height: THUMB, flex: 'none', padding: 0, border: 0, borderRadius: 10, overflow: 'hidden', background: COVER_FALLBACK, outline: on ? '2px solid var(--il-ember)' : '2px solid transparent', outlineOffset: -2, opacity: on ? 1 : 0.8, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
            {hidden
              ? <IconEyeOff size={16} stroke={2} />
              : <img src={civitaiThumbUrl(previewStill(img, THUMB * 3), THUMB * 3)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </button>
        );
      })}
      {images.length === 0 && !loading && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>No samples</span>}
      {(loading || loadingMore) && Array.from({ length: images.length ? 3 : 8 }, (_, i) => (
        <Skeleton key={`sk${i}`} w={THUMB} h={THUMB} radius={10} style={{ flex: 'none' }} />
      ))}
      {hasMore && <div ref={end} aria-hidden style={{ width: 1, height: THUMB, flex: 'none' }} />}
    </div>
  );
}
