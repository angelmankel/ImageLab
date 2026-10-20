/**
 * The thumbnail strip under the picture: its own row (rule 1), scrolls sideways, the current
 * thumb ember-outlined and kept in view, "load more" at the end while the gallery has more.
 * Thumbs are stills even for clips; a hidden (NSFW) sample shows a dim eye instead of a blur.
 * `scrollKey` keeps its sideways position per model + version (`useKeepScroll`): a reopen lands
 * where it was, and only centres the current thumb when that one is out of view.
 */
import { useCallback, useEffect, useRef } from 'react';
import { IconEyeOff } from '@tabler/icons-react';
import type { CivitaiImage } from '@/lib/civitai';
import { civitaiThumbUrl, previewStill } from '@/lib/civitai';
import { COVER_FALLBACK } from '~/screens/models/bits';
import { useKeepScroll, keptScroll } from '~/screens/models/useKeepScroll';

export const STRIP_H = 84;
const THUMB = 66;

export function ThumbStrip({ images, index, onSelect, isHidden, hasMore, onMore, loading, scrollKey = null }: {
  images: CivitaiImage[]; index: number; onSelect: (i: number) => void; isHidden: (img: CivitaiImage) => boolean;
  hasMore: boolean; onMore: () => void; loading: boolean; scrollKey?: string | null;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const keep = useKeepScroll(scrollKey);
  const setRow = useCallback((el: HTMLDivElement | null) => { row.current = el; keep(el); }, [keep]);
  const first = useRef(true);

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
    <div ref={setRow} className="il-scroll-x" style={{ height: STRIP_H, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', overflowX: 'auto', background: 'var(--il-bg)', borderTop: '1px solid var(--il-line)', touchAction: 'pan-x' }}>
      {images.map((img, i) => {
        const on = i === index;
        const hidden = isHidden(img);
        return (
          <button key={img.url + i} type="button" aria-label={`Image ${i + 1}`} aria-pressed={on} onClick={() => onSelect(i)}
            style={{ width: THUMB, height: THUMB, flex: 'none', padding: 0, border: 0, borderRadius: 10, overflow: 'hidden', background: COVER_FALLBACK, outline: on ? '2px solid var(--il-ember)' : '2px solid transparent', outlineOffset: -2, opacity: on ? 1 : 0.8, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
            {hidden
              ? <IconEyeOff size={16} stroke={2} />
              : <img src={civitaiThumbUrl(previewStill(img, THUMB * 3), THUMB * 3)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </button>
        );
      })}
      {images.length === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{loading ? 'Loading…' : 'No samples'}</span>}
      {hasMore && (
        <button type="button" onClick={onMore} style={{ height: THUMB, flex: 'none', padding: '0 12px', border: '1px dashed var(--il-line-strong)', borderRadius: 10, background: 'transparent', color: 'var(--il-ember)', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>load more</button>
      )}
    </div>
  );
}
