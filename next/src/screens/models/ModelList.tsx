/**
 * The result list: a responsive grid of `ModelTile`s or a column of `ModelRow`s, with skeletons
 * while loading, an inline error with Retry, and a sentinel that loads the next page when it
 * scrolls into view. `scroll` makes it its own scroll container (desktop); the phone page scrolls
 * the whole screen and renders this inline.
 */
import { useEffect, useRef } from 'react';
import type { CivitaiModel } from '@/lib/civitai';
import type { View } from './modelsStore';
import type { Installed } from './useInstalled';
import { ModelTile } from './ModelTile';
import { ModelRow } from './ModelRow';
import { GhostBtn } from './bits';

export function ModelList({ items, view, selectedId, mask, revealed, installed, loading, loadingMore, error, hasMore, hidden, onOpen, onReveal, onUse, onLoadMore, onRetry, scroll, minTile = 190 }: {
  items: CivitaiModel[]; view: View; selectedId: number | null; mask: number; revealed: number[]; installed: Installed;
  loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; hidden: number;
  onOpen: (m: CivitaiModel) => void; onReveal: (id: number) => void; onUse: (m: CivitaiModel) => void; onLoadMore: () => void; onRetry: () => void;
  scroll?: boolean; minTile?: number;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore(); }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onLoadMore, items.length]);

  const grid = view === 'grid';
  const body = loading && items.length === 0 ? (
    <Skeleton grid={grid} minTile={minTile} />
  ) : items.length === 0 ? (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--il-muted)', fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {error ? <>{error}<GhostBtn onClick={onRetry} h={32}>Try again</GhostBtn></> : hidden > 0 ? `${hidden} loaded model${hidden === 1 ? '' : 's'} hidden by the NSFW / early access / installed / precision filters` : 'Nothing matches — loosen the filters'}
    </div>
  ) : (
    <>
      {hidden > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '0 2px 6px' }}>{hidden} of the loaded models hidden by the NSFW / early access / installed / precision filters</div>}
      <div style={grid ? { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minTile}px, 1fr))`, gap: 8 } : { display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((m) => grid ? (
          <ModelTile key={m.id} model={m} selected={m.id === selectedId} installed={installed.model(m)} mask={mask} revealed={revealed.includes(m.id)} onOpen={() => onOpen(m)} onReveal={() => onReveal(m.id)} onUse={() => onUse(m)} />
        ) : (
          <ModelRow key={m.id} model={m} selected={m.id === selectedId} installed={installed.model(m)} mask={mask} revealed={revealed.includes(m.id)} onOpen={() => onOpen(m)} onReveal={() => onReveal(m.id)} />
        ))}
      </div>
      {error && <div style={{ padding: 12, textAlign: 'center', color: 'var(--il-err)', fontSize: 12, fontWeight: 700 }}>{error} <GhostBtn onClick={onRetry} h={26} style={{ marginLeft: 8 }}>Retry</GhostBtn></div>}
      <div ref={sentinel} style={{ height: 1 }} />
      {loadingMore && <div style={{ padding: 12, textAlign: 'center', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700 }}>Loading more…</div>}
    </>
  );

  if (!scroll) return <div>{body}</div>;
  return <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '2px 12px 12px', touchAction: 'pan-y' }}>{body}</div>;
}

function Skeleton({ grid, minTile }: { grid: boolean; minTile: number }) {
  return (
    <div style={grid ? { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minTile}px, 1fr))`, gap: 8 } : { display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: grid ? 8 : 6 }, (_, i) => (
        <div key={i} style={{ background: 'var(--il-card)', borderRadius: 16, padding: grid ? 10 : 8, display: 'flex', flexDirection: grid ? 'column' : 'row', gap: grid ? 7 : 10, opacity: 0.6 }}>
          <div style={{ aspectRatio: grid ? '3 / 4' : undefined, width: grid ? '100%' : 64, height: grid ? undefined : 64, borderRadius: grid ? 14 : 12, background: 'var(--il-elev)', flex: 'none' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 13, width: '70%', borderRadius: 6, background: 'var(--il-elev)' }} />
            <div style={{ height: 11, width: '45%', borderRadius: 6, background: 'var(--il-elev)' }} />
            <div style={{ height: 11, width: '60%', borderRadius: 6, background: 'var(--il-elev)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
