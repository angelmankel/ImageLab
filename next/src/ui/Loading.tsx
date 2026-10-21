/**
 * THE loading states (FIXLIST-2 item 5), one family for the whole app:
 *   <Skeleton w={120} h={14} />                       a shimmering block (text line, chip, avatar)
 *   <SkeletonText lines={3} />                         a few text lines, the last one shorter
 *   <SkeletonTiles count={12} min={150} aspect={3/4} caption />    a grid of placeholder tiles
 *   <SkeletonTiles masonry columns={4} />              masonry (mixed heights) for galleries
 *   <Spinner size={16} />                              a ring for buttons / small busy spots
 *   <LoadingState label="Loading models…" />          a centred spinner + words for a panel / page
 * Images: `LoadingImage` (./LoadingImage) — shimmer, optional blurred thumb, fade-in, error state.
 * Theme colours only; the shimmer stops with Motion "Off" (a still block is still a placeholder),
 * the spinner keeps turning (it says "working"). Each is `aria-hidden` except LoadingState, which
 * is a polite status for screen readers.
 */
import type { CSSProperties, ReactNode } from 'react';

const MIXED = [1.25, 0.8, 1, 1.5, 0.75, 1.1, 1.33, 0.9];

export function Skeleton({ w = '100%', h = 12, radius = 6, style, className }: {
  w?: number | string; h?: number | string; radius?: number | string; style?: CSSProperties; className?: string;
}) {
  return <span aria-hidden className={`il-skel${className ? ` ${className}` : ''}`} style={{ display: 'block', width: w, height: h, borderRadius: radius, flex: 'none', ...style }} />;
}

export function SkeletonText({ lines = 3, size = 11, gap = 6, last = '60%', style }: { lines?: number; size?: number; gap?: number; last?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} h={size} w={i === lines - 1 && lines > 1 ? last : '100%'} />)}
    </span>
  );
}

export function SkeletonTiles({ count = 8, columns, min = 140, aspect = 1, masonry = false, gap = 8, radius = 14, caption = false, style }: {
  count?: number;
  /** Fixed column count; otherwise auto-fill at `min` px. */
  columns?: number;
  min?: number;
  /** Width ÷ height of each tile (ignored by masonry, which mixes heights). */
  aspect?: number;
  masonry?: boolean;
  gap?: number;
  radius?: number;
  /** Two text lines under each tile (cards with a name). */
  caption?: boolean;
  style?: CSSProperties;
}) {
  const tile = (i: number) => (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, breakInside: 'avoid', marginBottom: masonry ? gap : 0 }}>
      <Skeleton h="auto" radius={radius} style={{ aspectRatio: String(masonry ? MIXED[i % MIXED.length] : aspect) }} />
      {caption && <><Skeleton h={11} w="72%" /><Skeleton h={10} w="44%" /></>}
    </div>
  );
  const items = Array.from({ length: count }, (_, i) => tile(i));
  if (masonry) return <div aria-hidden style={{ columnCount: columns ?? undefined, columnWidth: columns ? undefined : min, columnGap: gap, ...style }}>{items}</div>;
  return (
    <div aria-hidden style={{ display: 'grid', gap, gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${min}px, 1fr))`, ...style }}>
      {items}
    </div>
  );
}

export function Spinner({ size = 16, color = 'var(--il-ember)', stroke, style }: { size?: number; color?: string; stroke?: number; style?: CSSProperties }) {
  const w = stroke ?? Math.max(2, Math.round(size / 8));
  return (
    <span aria-hidden className="il-spin" style={{
      display: 'inline-block', flex: 'none', width: size, height: size, borderRadius: '50%', boxSizing: 'border-box',
      border: `${w}px solid color-mix(in srgb, ${color} 22%, transparent)`, borderTopColor: color, ...style,
    }} />
  );
}

export function LoadingState({ label = 'Loading…', size = 22, children, style }: { label?: ReactNode; size?: number; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '28px 12px', color: 'var(--il-muted)', fontSize: 12, fontWeight: 700, textAlign: 'center', ...style }}>
      <Spinner size={size} />
      {label}
      {children}
    </div>
  );
}
