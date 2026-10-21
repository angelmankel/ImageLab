/**
 * The opened model's sample gallery (rule 13). Desktop: a 4:3 hero and a 4-column strip of
 * thumbnails. Phone: a full-width swipeable strip (scroll-snap) with dots. The selected image
 * feeds the Sample card (its generation data). Videos play muted in place; adult samples beyond
 * the NSFW level are blurred until tapped.
 */
import { useEffect, useRef, useState } from 'react';
import { IconEyeOff } from '@tabler/icons-react';
import type { CivitaiImage } from '@/lib/civitai';
import { civitaiThumbUrl, civitaiVideoUrl, isCivitaiVideo, previewStill } from '@/lib/civitai';
import { useNsfwCover } from './nsfwCover';
import { COVER_FALLBACK, GhostBtn, type Size } from './bits';

export function Media({ img, width, reveal, blurred, style, cover = true, still }: { img: CivitaiImage; width: number; reveal: () => void; blurred: boolean; style?: React.CSSProperties; cover?: boolean; still?: boolean }) {
  // Thumbnails are stills even for clips: a grid of autoplaying videos is a lot of decoding for nothing.
  const video = !still && isCivitaiVideo(img);
  const base: React.CSSProperties = { width: '100%', height: '100%', objectFit: cover ? 'cover' : 'contain', display: 'block', filter: blurred ? 'blur(18px)' : undefined, transform: blurred ? 'scale(1.1)' : undefined, ...style };
  return (
    <>
      {video && !blurred
        ? <video src={civitaiVideoUrl(img.url, width)} poster={civitaiThumbUrl(previewStill(img, width), width)} muted loop autoPlay playsInline style={base} />
        : <img src={civitaiThumbUrl(previewStill(img, width), width)} alt="" loading="lazy" decoding="async" style={base} />}
      {blurred && (
        <button type="button" onClick={(e) => { e.stopPropagation(); reveal(); }} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', border: 0, background: 'color-mix(in srgb, var(--il-bg) 35%, transparent)', color: 'var(--il-fg)', cursor: 'pointer' }}>
          <span style={{ height: 26, padding: '0 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--il-bg) 80%, transparent)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}><IconEyeOff size={12} />NSFW · tap to show</span>
        </button>
      )}
    </>
  );
}

export function DetailGallery({ images, index, onSelect, size, hasMore, onMore, loading }: {
  images: CivitaiImage[]; index: number; onSelect: (i: number) => void; mask: number; size: Size; hasMore: boolean; onMore: () => void; loading: boolean;
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const reveal = (url: string) => setRevealed((s) => new Set(s).add(url));
  const covered = useNsfwCover();
  const isBlurred = (img: CivitaiImage) => covered(img.nsfwLevel) && !revealed.has(img.url);
  const strip = useRef<HTMLDivElement>(null);
  const current = images[Math.min(index, Math.max(0, images.length - 1))];

  // Phone: keep the strip on the selected slide (a thumb tap elsewhere, a version change).
  useEffect(() => {
    if (size !== 'phone' || !strip.current) return;
    const w = strip.current.clientWidth;
    if (Math.abs(strip.current.scrollLeft - index * w) > 2) strip.current.scrollTo({ left: index * w, behavior: 'auto' });
  }, [index, size, images.length]);

  if (images.length === 0) {
    return (
      <div style={{ width: '100%', aspectRatio: size === 'phone' ? '13 / 10' : '4 / 3', borderRadius: size === 'phone' ? 0 : 16, background: COVER_FALLBACK, display: 'grid', placeItems: 'center', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700 }}>
        {loading ? 'Loading samples…' : 'No sample images'}
      </div>
    );
  }

  if (size === 'phone') {
    return (
      <div>
        <div
          ref={strip}
          className="il-scroll-x"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== index && i >= 0 && i < images.length) onSelect(i);
          }}
          style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', aspectRatio: '13 / 10', background: 'var(--il-bg-deep)', touchAction: 'pan-x pan-y' }}
        >
          {images.map((img, i) => (
            <div key={img.url + i} style={{ flex: 'none', width: '100%', height: '100%', scrollSnapAlign: 'start', position: 'relative', overflow: 'hidden' }}>
              <Media img={img} width={800} blurred={isBlurred(img)} reveal={() => reveal(img.url)} cover={false} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, margin: '8px 0 0', flexWrap: 'wrap', padding: '0 16px' }}>
          {images.slice(0, 24).map((img, i) => (
            <button key={img.url + i} type="button" aria-label={`Image ${i + 1}`} onClick={() => onSelect(i)} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, border: 0, padding: 0, background: i === index ? 'var(--il-ember)' : 'var(--il-dim)', cursor: 'pointer', transition: 'width .15s' }} />
          ))}
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)', marginLeft: 6 }}>{index + 1} / {images.length}</span>
          {hasMore && <GhostBtn h={24} onClick={onMore} style={{ marginLeft: 6 }}>more</GhostBtn>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden', background: 'var(--il-bg-deep)', position: 'relative' }}>
        {current && <Media img={current} width={760} blurred={isBlurred(current)} reveal={() => reveal(current.url)} cover={false} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {images.map((img, i) => (
          <button key={img.url + i} type="button" aria-label={`Image ${i + 1}`} aria-pressed={i === index} onClick={() => onSelect(i)} style={{ padding: 0, border: 0, aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative', background: COVER_FALLBACK, outline: i === index ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2, cursor: 'pointer' }}>
            <Media img={img} width={180} blurred={isBlurred(img)} reveal={() => reveal(img.url)} still />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700, color: 'var(--il-muted)', padding: '0 2px' }}>
        <span>{images.length} image{images.length === 1 ? '' : 's'}</span>
        {hasMore && <button type="button" onClick={onMore} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 10, fontWeight: 700, padding: 0, cursor: 'pointer' }}>load more</button>}
      </div>
    </div>
  );
}
