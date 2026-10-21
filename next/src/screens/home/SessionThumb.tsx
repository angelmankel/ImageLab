/**
 * A session's picture: its last output (image, or a video's first frame), or a dark placeholder.
 * Used by the tab strip (20px) and the Home tiles (natural aspect ratio).
 */
import type { CSSProperties } from 'react';
import { VideoThumb } from '~/ui/VideoThumb';
import type { ResultItem } from '@/lib/workspace';

/** `autoplay={false}`: a clip here plays on hover only, never by itself (the session tabs). */
export function SessionThumb({ item, style, label, autoplay = true }: { item: ResultItem | null; style?: CSSProperties; label?: string; autoplay?: boolean }) {
  const box: CSSProperties = { display: 'block', objectFit: 'cover', background: 'var(--il-bg-deep)', ...style };
  if (!item) {
    return (
      <span aria-hidden style={{ ...box, display: 'grid', placeItems: 'center', color: 'var(--il-dim)', fontSize: 11, fontWeight: 700 }}>
        {label}
      </span>
    );
  }
  // Settings → Video previews.
  if (item.kind === 'video') return <VideoThumb src={item.url} autoplay={autoplay} style={box} />;
  return <img src={item.url} alt="" loading="lazy" draggable={false} style={box} />;
}
