/**
 * The picture area (rule 1: nothing overlays it). The selected sample `object-fit: contain` on
 * the deep backdrop; a clip plays muted in place. An adult sample beyond the NSFW level is NOT
 * drawn: the "NSFW · tap to show" pill stands in its place (the one thing allowed in the empty
 * area). On desktop the ‹ › buttons sit in their own narrow columns beside the picture.
 *
 * Fit (fix list item 6): the media is positioned ABSOLUTELY inside a relative box that fills its
 * cell. Percent sizes on a grid / flex child resolve against a track that is still being sized
 * (the picture's natural height wins and the track grows to it, so the sample overflowed and was
 * cropped — twice). An absolute child resolves against the box itself, always: the longest edge
 * is capped by the free space, the aspect is kept, nothing crops, stretches or overflows.
 */
import { IconChevronLeft, IconChevronRight, IconEyeOff } from '@tabler/icons-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { CivitaiImage } from '@/lib/civitai';
import { civitaiThumbUrl, civitaiVideoUrl, isCivitaiVideo, previewStill } from '@/lib/civitai';
import { IconBtn } from '~/ui';
import { whenReady } from './preload';

export const PICTURE_WIDTH = 1600;
export const EDGE_COL = 44;
/** How long a page swap waits for the new picture to decode before showing it anyway. */
const SWAP_CAP_MS = 150;

/** The URL `Picture` shows for a sample (the preload hook warms exactly this one). */
export function pictureUrl(img: CivitaiImage): string {
  return civitaiThumbUrl(previewStill(img, PICTURE_WIDTH), PICTURE_WIDTH);
}

/**
 * The `<img src>` is swapped only once the new picture is decoded (a preloaded neighbour is
 * already), else after `SWAP_CAP_MS` — so paging never flashes blank and never waits either.
 */
function useSwapWhenDecoded(url: string): string {
  const [shown, setShown] = useState(url);
  useEffect(() => {
    if (!url) { setShown(''); return; }
    let live = true;
    void whenReady(url, SWAP_CAP_MS).then(() => { if (live) setShown(url); });
    return () => { live = false; };
  }, [url]);
  return shown;
}

/** Fills the box whatever the layout around it is: see the header comment. */
const MEDIA: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', objectFit: 'contain', display: 'block' };
const CENTRE: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

export function Picture({ image, hidden, onReveal, loading, empty, edges, canPrev, canNext, onPrev, onNext, style }: {
  image: CivitaiImage | undefined; hidden: boolean; onReveal: () => void; loading: boolean;
  /** What to say when there is no image at all. */
  empty: string;
  edges: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; style?: CSSProperties;
}) {
  const video = !!image && isCivitaiVideo(image);
  const url = image ? pictureUrl(image) : '';
  // Clips swap at once (the <video> element is its own); stills wait for their decode (capped).
  const shown = useSwapWhenDecoded(video || hidden ? '' : url) || url;

  const body = !image ? (
    <div style={CENTRE}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)' }}>{loading ? 'Loading samples…' : empty}</span></div>
  ) : hidden ? (
    <div style={CENTRE}>
      <button type="button" onClick={onReveal} style={{ height: 32, padding: '0 14px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <IconEyeOff size={13} stroke={2.2} />NSFW · tap to show
      </button>
    </div>
  ) : video ? (
    <video key={image.url} src={civitaiVideoUrl(image.url, PICTURE_WIDTH)} poster={url} muted loop autoPlay playsInline style={MEDIA} />
  ) : (
    <img src={shown} alt="" decoding="async" style={MEDIA} />
  );

  const area = (
    <div style={{ position: 'relative', minWidth: 0, minHeight: 0, width: '100%', height: '100%', background: 'var(--il-bg-deep)', overflow: 'hidden', ...style }}>
      {body}
    </div>
  );

  if (!edges) return area;
  return (
    // Explicit single tracks both ways: an implicit (auto) track would grow to the picture's natural size.
    <div style={{ display: 'grid', gridTemplateColumns: `${EDGE_COL}px minmax(0, 1fr) ${EDGE_COL}px`, gridTemplateRows: 'minmax(0, 1fr)', minHeight: 0, minWidth: 0, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'grid', placeItems: 'center' }}><IconBtn icon={<IconChevronLeft size={20} stroke={2.2} />} label="Previous image" onClick={onPrev} disabled={!canPrev} tooltip={false} /></div>
      {area}
      <div style={{ display: 'grid', placeItems: 'center' }}><IconBtn icon={<IconChevronRight size={20} stroke={2.2} />} label="Next image" onClick={onNext} disabled={!canNext} tooltip={false} /></div>
    </div>
  );
}
