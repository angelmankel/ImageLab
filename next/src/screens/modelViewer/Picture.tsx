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
import { IconEyeOff } from '@tabler/icons-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { CivitaiImage } from '@/lib/civitai';
import { civitaiThumbUrl, civitaiVideoUrl, isCivitaiVideo, previewStill } from '@/lib/civitai';
import { NavArrows } from '~/ui';
import { whenReady } from './preload';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';

export const PICTURE_WIDTH = 1600;
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

export function Picture({ image, hidden, onReveal, onOpen, loading, empty, edges, canPrev, canNext, onPrev, onNext, style }: {
  image: CivitaiImage | undefined; hidden: boolean; onReveal: () => void; loading: boolean;
  /** A tap on the shown picture: the full-screen viewer (item 31). */
  onOpen?: () => void;
  /** What to say when there is no image at all. */
  empty: string;
  edges: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; style?: CSSProperties;
}) {
  const video = !!image && isCivitaiVideo(image);
  const url = image ? pictureUrl(image) : '';
  // Clips swap at once (the <video> element is its own); stills wait for their decode (capped).
  const shown = useSwapWhenDecoded(video || hidden ? '' : url) || url;
  // The picture is a drag source (fix list 42): onto an input, a collection, the rail, a tab.
  const drag = useImageDrag(() => (url && !hidden ? makePayload({ url, name: nameFromUrl(image?.url ?? url, 'civitai.png'), source: 'model' }) : null));

  const body = !image ? (
    <div style={CENTRE}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)' }}>{loading ? 'Loading samples…' : empty}</span></div>
  ) : hidden ? (
    <div style={CENTRE}>
      <button type="button" onClick={onReveal} style={{ height: 32, padding: '0 14px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <IconEyeOff size={13} stroke={2.2} />NSFW · tap to show
      </button>
    </div>
  ) : video ? (
    <video key={image.url} src={civitaiVideoUrl(image.url, PICTURE_WIDTH)} poster={url} muted loop autoPlay playsInline onClick={onOpen} style={{ ...MEDIA, cursor: onOpen ? 'zoom-in' : undefined }} />
  ) : (
    <img src={shown} alt="" decoding="async" {...drag} onClick={onOpen} style={{ ...MEDIA, cursor: onOpen ? 'zoom-in' : undefined }} />
  );

  // Item 30: previous / next float over the picture's edges (the shared NavArrows), no side strips.
  return (
    <div style={{ position: 'relative', minWidth: 0, minHeight: 0, width: '100%', height: '100%', background: 'var(--il-bg-deep)', overflow: 'hidden', ...style }}>
      {body}
      {edges && (canPrev || canNext) && <NavArrows onPrev={onPrev} onNext={onNext} canPrev={canPrev} canNext={canNext} />}
    </div>
  );
}
