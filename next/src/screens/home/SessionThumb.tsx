/**
 * A session's picture: its last output (image, or a video's first frame), or a dark placeholder.
 * Used by the tab strip (20px) and the Home tiles (natural aspect ratio).
 */
import type { CSSProperties } from 'react';
import type { ResultItem } from '@/lib/workspace';

export function SessionThumb({ item, style, label }: { item: ResultItem | null; style?: CSSProperties; label?: string }) {
  const box: CSSProperties = { display: 'block', objectFit: 'cover', background: 'var(--il-bg-deep)', ...style };
  if (!item) {
    return (
      <span aria-hidden style={{ ...box, display: 'grid', placeItems: 'center', color: 'var(--il-dim)', fontSize: 11, fontWeight: 700 }}>
        {label}
      </span>
    );
  }
  if (item.kind === 'video') return <video src={item.url} muted playsInline preload="metadata" style={{ ...box, pointerEvents: 'none' }} />;
  return <img src={item.url} alt="" loading="lazy" draggable={false} style={box} />;
}
