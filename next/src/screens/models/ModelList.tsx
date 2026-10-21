/**
 * The result list: a responsive grid of `ModelTile`s or a column of `ModelRow`s, with skeletons
 * while loading, an inline error with Retry, and a sentinel that loads the next page when it
 * scrolls into view. `scroll` makes it its own scroll container (desktop); the phone page scrolls
 * the whole screen and renders this inline. `minTile` sets the tile width (desktop 240 per the
 * picker brief; the phone passes a 2-per-row value). `scrollKey` keeps the scroll container's
 * position across unmounts (`useKeepScroll`).
 */
import { useEffect, useRef } from 'react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import type { View } from './modelsStore';
import type { Installed } from './useInstalled';
import { ModelTile } from './ModelTile';
import { ModelRow } from './ModelRow';
import { GhostBtn, type Size } from './bits';
import { Skeleton, Spinner } from '~/ui';
import { useKeepScroll } from './useKeepScroll';

export function ModelList({ items, view, selectedId, mask, revealed, favourites, installed, picking, size = 'desktop', loading, loadingMore, error, hasMore, hidden, onOpen, onReveal, onUse, onLoadMore, onRetry, scroll, scrollKey = null, minTile = 240, columns, emptyAction }: {
  items: CivitaiModel[]; view: View; selectedId: number | null; mask: number; revealed: number[]; favourites?: number[]; installed: Installed; picking?: boolean; size?: Size;
  loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; hidden: number;
  onOpen: (m: CivitaiModel) => void; onReveal: (id: number) => void; onUse: (m: CivitaiModel, v?: CivitaiModelVersion) => void; onLoadMore: () => void; onRetry: () => void;
  scroll?: boolean; scrollKey?: string | null; minTile?: number; columns?: number;
  /** Under the empty message (a Downloaded search with no hit: "Search CivitAI for …"). */
  emptyAction?: React.ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const keepScroll = useKeepScroll(scroll ? scrollKey : null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore(); }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onLoadMore, items.length]);

  const grid = view === 'grid';
  const gridStyle: React.CSSProperties = grid
    ? { display: 'grid', gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${minTile}px, 1fr))`, gap: size === 'phone' ? 8 : 12 }
    : { display: 'flex', flexDirection: 'column', gap: 8 };
  const body = loading && items.length === 0 ? (
    <ListSkeleton style={gridStyle} grid={grid} />
  ) : items.length === 0 ? (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {error ? <>{error}<GhostBtn onClick={onRetry} h={32}>Try again</GhostBtn></> : hidden > 0 ? `${hidden} loaded model${hidden === 1 ? '' : 's'} hidden by the NSFW / early access / installed / precision filters` : 'Nothing matches — loosen the filters'}
      {!error && emptyAction}
    </div>
  ) : (
    <>
      {hidden > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '0 2px 6px' }}>{hidden} of the loaded models hidden by the NSFW / early access / installed / precision filters</div>}
      <div style={gridStyle}>
        {items.map((m) => grid ? (
          <ModelTile key={m.id} model={m} size={size} picking={picking} favourite={favourites?.includes(m.id)} selected={m.id === selectedId} installed={installed.model(m)} mask={mask} revealed={revealed.includes(m.id)} onOpen={() => onOpen(m)} onReveal={() => onReveal(m.id)} onUse={(v) => onUse(m, v)} />
        ) : (
          <ModelRow key={m.id} model={m} picking={picking} selected={m.id === selectedId} installed={installed.model(m)} mask={mask} revealed={revealed.includes(m.id)} onOpen={() => onOpen(m)} onReveal={() => onReveal(m.id)} onUse={() => onUse(m)} />
        ))}
      </div>
      {error && <div style={{ padding: 12, textAlign: 'center', color: 'var(--il-err)', fontSize: 12, fontWeight: 700 }}>{error} <GhostBtn onClick={onRetry} h={26} style={{ marginLeft: 8 }}>Retry</GhostBtn></div>}
      <div ref={sentinel} style={{ height: 1 }} />
      {loadingMore && <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--il-muted)', fontSize: 11, fontWeight: 700 }}><Spinner size={14} />Loading more…</div>}
    </>
  );

  if (!scroll) return <div>{body}</div>;
  return <div ref={keepScroll} className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '2px 12px 12px', touchAction: 'pan-y' }}>{body}</div>;
}

/** The first page's placeholders: tile- or row-shaped, on the shared shimmer (item 5). */
function ListSkeleton({ style, grid }: { style: React.CSSProperties; grid: boolean }) {
  return (
    <div style={style}>
      {Array.from({ length: grid ? 8 : 6 }, (_, i) => (
        <div key={i} aria-hidden style={{ background: 'var(--il-card)', borderRadius: 16, padding: grid ? 10 : 8, display: 'flex', flexDirection: grid ? 'column' : 'row', gap: grid ? 7 : 10 }}>
          {grid ? <Skeleton h="auto" radius={14} style={{ aspectRatio: '3 / 4' }} /> : <Skeleton w={64} h={64} radius={12} style={{ flex: 'none' }} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton h={13} w="70%" />
            <Skeleton h={11} w="45%" />
            <Skeleton h={11} w="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}
