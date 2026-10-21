/**
 * The detail panel's pictures on desktop (fix list item 32): the selected sample big (contain,
 * a capped height so it can stay sticky above the info) and ONE row of thumbnails, a page at a
 * time (‹ 1–8 of 20+ ›) instead of the long grid that loaded everything; paging past what is
 * loaded asks CivitAI for the next page. A click on the big picture opens the model viewer on it.
 * Every picture is a drag source (~/dnd: drop it on a step's input, a tab, a collection).
 */
import { useEffect, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { CivitaiImage } from '@/lib/civitai';
import { isCivitaiVideo, previewStill } from '@/lib/civitai';
import { Button } from '~/ui';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';
import { useNsfwCover } from './nsfwCover';
import { COVER_FALLBACK } from './bits';
import { Media } from './DetailGallery';
import { vh } from '~/theme/uiScale';

/** Thumbnails per page. */
export const THUMB_PAGE = 8;

/** The page a picture is on, and the range a page shows ("9–16"). Pure. */
export const pageOf = (index: number, per = THUMB_PAGE) => Math.floor(Math.max(0, index) / per);

function useDrag(img: CivitaiImage | undefined, blocked: boolean) {
  return useImageDrag(() => {
    if (!img || blocked || isCivitaiVideo(img)) return null;
    const url = previewStill(img);
    return makePayload({ url, name: nameFromUrl(url) || 'civitai.png', source: 'model' });
  });
}

function ThumbButton({ img, i, on, blurred, reveal, onSelect }: { img: CivitaiImage; i: number; on: boolean; blurred: boolean; reveal: () => void; onSelect: (i: number) => void }) {
  const drag = useDrag(img, blurred);
  return (
    <button type="button" className="ilm-thumb" aria-label={`Image ${i + 1}`} aria-pressed={on} onClick={() => onSelect(i)} {...drag}
      style={{ padding: 0, border: 0, aspectRatio: '1', borderRadius: 9, overflow: 'hidden', position: 'relative', background: COVER_FALLBACK, outline: on ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2, cursor: 'pointer', minWidth: 0 }}>
      <Media img={img} width={160} blurred={blurred} reveal={reveal} still />
    </button>
  );
}

export function DetailMedia({ images, index, onSelect, onView, hasMore, onMore, loading }: {
  images: CivitaiImage[]; index: number; onSelect: (i: number) => void; onView: (img: CivitaiImage) => void; mask: number;
  hasMore: boolean; onMore: () => void; loading: boolean;
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const reveal = (url: string) => setRevealed((s) => new Set(s).add(url));
  const covered = useNsfwCover();
  const isBlurred = (img: CivitaiImage) => covered(img.nsfwLevel) && !revealed.has(img.url);
  const current = images[Math.min(index, Math.max(0, images.length - 1))];
  const [page, setPage] = useState(pageOf(index));
  // The page follows the selected picture (a click in the viewer, a version change).
  useEffect(() => { setPage(pageOf(index)); }, [index]);
  const heroDrag = useDrag(current, !!current && isBlurred(current));

  const heroH = `clamp(200px, ${vh(34)}, 380px)`;
  if (images.length === 0) {
    return (
      <div style={{ height: heroH, borderRadius: 14, background: COVER_FALLBACK, display: 'grid', placeItems: 'center', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700 }}>
        {loading ? 'Loading samples…' : 'No sample images'}
      </div>
    );
  }

  const pages = Math.ceil(images.length / THUMB_PAGE);
  const from = page * THUMB_PAGE;
  const shown = images.slice(from, from + THUMB_PAGE);
  const canNext = page + 1 < pages || hasMore;
  const next = () => {
    if (page + 1 < pages) setPage(page + 1);
    else if (hasMore) { onMore(); setPage(page + 1); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <button type="button" aria-label="Open this picture in the model viewer" onClick={() => current && !isBlurred(current) && onView(current)} {...heroDrag}
        style={{ height: heroH, width: '100%', padding: 0, border: 0, borderRadius: 14, overflow: 'hidden', background: 'var(--il-bg-deep)', position: 'relative', cursor: 'zoom-in', display: 'block' }}>
        {current && <Media img={current} width={760} blurred={isBlurred(current)} reveal={() => reveal(current.url)} cover={false} />}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${THUMB_PAGE}, minmax(0, 1fr))`, gap: 5 }}>
        {shown.map((img, k) => (
          <ThumbButton key={img.url + (from + k)} img={img} i={from + k} on={from + k === index} blurred={isBlurred(img)} reveal={() => reveal(img.url)} onSelect={onSelect} />
        ))}
        {shown.length === 0 && Array.from({ length: THUMB_PAGE }, (_, k) => <span key={k} style={{ aspectRatio: '1', borderRadius: 9, background: 'var(--il-elev)', opacity: 0.6 }} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>
        <Button size="sm" tone="ghost" icon={<IconChevronLeft size={14} stroke={2.6} />} disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))} aria-label="Previous pictures" />
        <span style={{ flex: 1, textAlign: 'center' }}>
          {shown.length ? `${from + 1}–${from + shown.length}` : 'Loading…'} of {images.length}{hasMore ? '+' : ''}
        </span>
        <Button size="sm" tone="ghost" icon={<IconChevronRight size={14} stroke={2.6} />} disabled={!canNext} onClick={next} aria-label="More pictures" />
      </div>
    </div>
  );
}
