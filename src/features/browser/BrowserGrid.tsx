import { TileDownload } from './TileDownload';
import { Button } from '@mantine/core';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CivitaiSearchHit, CivitaiImage } from '@/lib/civitai';
import { civitaiThumbUrl } from '@/lib/civitai';
import { cn } from '@/lib/cn';
import { formatCount, formatDate } from '@/features/model-metadata/civitai';
import { IconBolt, IconDownload, IconMessageCircle, IconThumbUp } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useBrowserStore } from './store';
import { typeLabel } from './BrowserFiltersRail';

/** Tile heroes don't need full-resolution. 450px wide is plenty for the
 *  default ~220px tile (×2 DPR) and CivitAI's CDN re-encodes cheaply, so we
 *  burn far less bandwidth than the default ~1024 the search payload hands
 *  back. The metadata modal still requests larger sizes when clicked. */
const TILE_THUMB_WIDTH = 450;

/** How far below (and above) the viewport to start fetching a tile's hero
 *  image. ~2 viewport-heights of runway means a smooth-scrolling user
 *  almost always lands on a tile that's already decoded, while still
 *  letting `content-visibility: auto` skip layout for tiles further out. */
const PREFETCH_ROOT_MARGIN = '1200px 0px';

/**
 * Center grid of CivitAI model cards. Each card hero-images one of the model's gallery samples;
 * hover auto-seeks through the rest and the scroll wheel seeks by hand. Infinite-scrolls via a
 * sentinel the parent observes. Two filters the API lacks — hide Early Access, installed or not —
 * are applied here, on the loaded page.
 */
export function BrowserGrid({
  items, loading, loadingMore, error, onRetry, onCardClick, showNsfw, nsfwFirst, sentinelRef, compact,
}: {
  items: CivitaiSearchHit[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onRetry: () => void;
  onCardClick: (modelId: number) => void;
  showNsfw: boolean;
  /** When true (Civitai Red catalog), each tile sorts its preview images
   *  NSFW-first so the hero matches the catalog's intent, and the per-tile
   *  blur is suppressed regardless of the SFW toggle. */
  nsfwFirst: boolean;
  sentinelRef: RefObject<HTMLDivElement>;
  /** Phone: two narrow columns and less padding. */
  compact?: boolean;
}) {
  const cols = compact ? 'grid-cols-2 gap-2' : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3';
  const earlyFilter = useBrowserStore((s) => s.filters.earlyAccess);
  const installedFilter = useBrowserStore((s) => s.filters.installed);
  const setFilters = useBrowserStore((s) => s.setFilters);
  const installedHashes = useInstalledHashes();
  const shown = useMemo(() => items
    .map((m) => ({ m, installed: isInstalled(m, installedHashes) }))
    .filter(({ m, installed }) =>
      (earlyFilter !== 'hide' || earlyAccessUntil(m) == null)
      && (installedFilter === 'any' || (installedFilter === 'only') === installed)),
  [items, installedHashes, earlyFilter, installedFilter]);
  const hiddenHere = items.length - shown.length;
  return (
    <div className={`scroll-y min-h-0 flex-1 overflow-x-hidden ${compact ? 'p-2' : 'p-4'}`} onScroll={noteGridScroll}>
      {loading && items.length === 0 ? (
        <SkeletonGrid cols={cols} />
      ) : shown.length === 0 && !hiddenHere ? (
        <EmptyState error={error} onRetry={onRetry} />
      ) : (
        <>
          {hiddenHere > 0 && (
            <div className="mb-2 text-[11px] text-fg-muted">
              {hiddenHere} of the {items.length} loaded model{items.length === 1 ? '' : 's'} hidden by your Early Access / installed filters.
            </div>
          )}
          <div className={`grid ${cols}`}>
            {shown.map(({ m, installed }) => (
              <ModelCard
                key={m.id}
                model={m}
                blurNsfw={!showNsfw && !nsfwFirst}
                nsfwFirst={nsfwFirst}
                onClick={() => onCardClick(m.id)}
                installed={installed}
                compact={compact}
                onCreator={(username) => setFilters({ username })}
                onTag={(tag) => setFilters({ tag })}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="h-1 w-full" />
          {loadingMore && (
            <div className="mt-4 flex justify-center">
              <span className="text-[11px] text-fg-muted">Loading more…</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkeletonGrid({ cols }: { cols: string }) {
  return (
    <div className={`grid ${cols}`}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border-subtle bg-bg-elev/40">
          <div className="skeleton-shimmer aspect-[3/4] w-full" />
          <div className="space-y-1.5 p-2.5">
            <div className="skeleton-shimmer h-3 w-3/4 rounded" />
            <div className="skeleton-shimmer h-2 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center text-[12px] text-fg-muted">
      <div className="text-[13px] font-medium text-fg-secondary">
        {error ?? 'No models match these filters'}
      </div>
      {error
        ? (
          <Button size="xs" variant="default" onClick={onRetry}>
            Retry
          </Button>
        ) : (
          <div>Try widening the type or base-model filters, or clear the search.</div>
        )
      }
    </div>
  );
}

/** How often hover auto-seek moves to the next image. */
const AUTO_SEEK_MS = 1400;
/** Wheel travel per image step: one mouse notch (~100) is one step; a trackpad needs a short swipe. */
const WHEEL_STEP = 60;
/** A wheel event this soon after the grid scrolled belongs to that scroll, not to the tile under it. */
const SCROLL_GUARD_MS = 350;
let lastGridScrollAt = 0;
/** Called by the grid's scroll handler. */
export function noteGridScroll() { lastGridScrollAt = Date.now(); }

function relativeDate(iso?: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function sizeLabel(kb?: number): string {
  if (!kb) return '';
  const mb = kb / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** When a paid Early Access window on this model ends, if one is running. */
export function earlyAccessUntil(model: CivitaiSearchHit): string | null {
  for (const v of model.modelVersions ?? []) {
    const end = v.paidAccess?.endsAt ?? v.earlyAccessDeadline;
    if (end && Date.parse(end) > Date.now()) return end;
  }
  return model.hasActivePaidAccess ? '' : null;
}

/** Lowercase SHA256 of every model file on the connected servers. */
export function useInstalledHashes(): Set<string> {
  const hashes = useStore((s) => s.modelHashes);
  return useMemo(() => new Set(hashes.map((h) => h.hash.toLowerCase())), [hashes]);
}

export function isInstalled(model: CivitaiSearchHit, installed: Set<string>): boolean {
  return (model.modelVersions ?? []).some((v) => (v.files ?? []).some((f) => {
    const sha = f.hashes?.SHA256;
    return !!sha && installed.has(sha.toLowerCase());
  }));
}

/**
 * One model tile: a hero image, then name, creator, stats, the version's facts, tags, and the
 * download control.
 *
 * Image seeking: hovering auto-seeks through the model's samples. A scroll-wheel turn over the
 * image steps through them by hand and freezes auto-seek on this tile; leaving and coming back
 * starts the auto-seek timer over, until the next wheel turn. A wheel turn that arrives while the
 * grid is still scrolling is left to the scroll, so scrolling past tiles never hijacks it.
 *
 * `blurNsfw` blurs the hero when the SFW toggle is on and the rendered image carries
 * `nsfwLevel > 1`; a click on the blur reveals this one tile.
 */
function ModelCard({ model, blurNsfw, nsfwFirst, onClick, installed, compact, onCreator, onTag }: {
  model: CivitaiSearchHit;
  blurNsfw: boolean;
  nsfwFirst: boolean;
  onClick: () => void;
  installed: boolean;
  compact?: boolean;
  onCreator: (username: string) => void;
  onTag: (tag: string) => void;
}) {
  // Which version each sample image belongs to, so the download button can follow the preview.
  const imageVersion = useRef(new Map<string, number>());
  const images: CivitaiImage[] = useMemo(() => {
    // The SFW catalog takes the first ~8 images in version order (CivitAI's own curation). The
    // Red catalog walks every version so the sort below can surface NSFW samples that live in
    // later versions, then caps at 8.
    const out: CivitaiImage[] = [];
    const seen = new Set<string>();
    imageVersion.current.clear();
    for (const v of model.modelVersions ?? []) {
      for (const img of v.images ?? []) {
        if (img.url && !seen.has(img.url)) {
          seen.add(img.url);
          out.push(img);
          imageVersion.current.set(img.url, v.id);
        }
      }
      if (!nsfwFirst && out.length >= 8) break;
    }
    if (nsfwFirst && out.length > 1) {
      out.sort((a, b) => (b.nsfwLevel ?? 0) - (a.nsfwLevel ?? 0));
      if (out.length > 8) out.length = 8;
    }
    return out;
  }, [model.modelVersions, nsfwFirst]);
  const n = images.length;

  const [hover, setHover] = useState(false);
  /** A wheel turn froze auto-seek; cleared when the pointer leaves. */
  const [frozen, setFrozen] = useState(false);
  const [idx, setIdx] = useState(0);
  /** Gallery images past the hero load only once the tile has been hovered or seeked. */
  const [hoverArmed, setHoverArmed] = useState(false);
  /** Sticky once the tile is near the viewport; gates the hero <img> so far-off tiles fetch nothing. */
  const [prefetchArmed, setPrefetchArmed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefetchArmed) return;
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setPrefetchArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: PREFETCH_ROOT_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prefetchArmed]);

  // Auto-seek while hovered and not frozen. Re-entering re-runs this effect, so the timer starts over.
  useEffect(() => {
    if (!hover || frozen || n <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % n), AUTO_SEEK_MS);
    return () => clearInterval(id);
  }, [hover, frozen, n]);

  // Wheel seeking. A native listener, because React's wheel handler is passive and could not stop
  // the page from scrolling underneath.
  useEffect(() => {
    const el = imageRef.current;
    if (!el || n <= 1) return;
    let acc = 0;
    let lastAt = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Date.now() - lastGridScrollAt < SCROLL_GUARD_MS) return;
      e.preventDefault();
      setFrozen(true);
      setHoverArmed(true);
      const now = Date.now();
      if (now - lastAt > 250) acc = 0;
      lastAt = now;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
      acc += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      if (Math.abs(acc) >= WHEEL_STEP) {
        const dir = acc > 0 ? 1 : -1;
        acc -= dir * WHEEL_STEP;
        setIdx((i) => (i + dir + n) % n);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [n]);

  /** Per-URL loaded flag so each image fades in only after its bytes arrive. */
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);

  const heroIdx = n ? idx % n : 0;
  const hero = images[heroIdx];
  const nsfw = (hero?.nsfwLevel ?? 0) > 1;
  const shouldBlur = blurNsfw && nsfw && !revealed;
  const heroThumb = hero ? civitaiThumbUrl(hero.url, TILE_THUMB_WIDTH) : '';
  const heroLoaded = heroThumb ? !!loaded[heroThumb] : true;

  const versions = model.modelVersions ?? [];
  const previewVersionId = hero ? imageVersion.current.get(hero.url) : undefined;
  const version = versions.find((v) => v.id === previewVersionId) ?? versions[0];
  const file = version?.files?.find((f) => f.primary) ?? version?.files?.[0];
  const early = earlyAccessUntil(model);
  const stats = model.stats ?? ({} as CivitaiSearchHit['stats']);
  const seekTo = (i: number) => { setIdx(i); setFrozen(true); setHoverArmed(true); };

  return (
    // A div, not a button: the tile holds its own buttons, and buttons cannot nest.
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => { setHover(true); setFrozen(false); setHoverArmed(true); }}
      onMouseLeave={() => { setHover(false); setFrozen(false); }}
      // content-visibility skips layout/paint of offscreen tiles, which keeps long grids smooth;
      // the intrinsic size hint keeps the scrollbar from jumping as tiles swap in.
      style={{ contentVisibility: 'auto', containIntrinsicSize: compact ? '160px 330px' : '240px 470px' }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-elev/40 text-left outline-none transition-transform hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg focus-visible:border-accent"
    >
      <div ref={imageRef} className="relative aspect-[3/4] w-full overflow-hidden bg-bg-elev">
        {!heroLoaded && <div aria-hidden className="skeleton-shimmer absolute inset-0" />}

        {n === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] italic text-fg-muted">no preview</div>
        ) : prefetchArmed && images.map((img, i) => {
          const src = civitaiThumbUrl(img.url, TILE_THUMB_WIDTH);
          if (i !== heroIdx && !hoverArmed) return null;
          const isLoaded = !!loaded[src];
          return (
            <img
              key={src}
              src={src}
              alt={model.name}
              loading="eager"
              decoding="async"
              onLoad={() => setLoaded((m) => (m[src] ? m : { ...m, [src]: true }))}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out',
                !isLoaded ? 'opacity-0' : i === heroIdx ? 'opacity-100' : 'opacity-0',
                shouldBlur && 'blur-2xl scale-110',
              )}
            />
          );
        })}

        {heroLoaded && (
          <>
            <div className="pointer-events-none absolute left-2 right-2 top-2 flex flex-wrap items-start gap-1">
              <Pill>{typeLabel(model.type)}</Pill>
              {version?.baseModel && <Pill tone="info">{version.baseModel}</Pill>}
              {installed && <Pill tone="ok">✓ Installed</Pill>}
              {early != null && (
                <Pill tone="warn" title="Paid Early Access: costs Buzz to download until the free date">
                  Early access{early ? ` · free ${formatDate(early)}` : ''}
                </Pill>
              )}
              {nsfw && <Pill tone="err">NSFW</Pill>}
            </div>
            {(hover || frozen) && n > 1 && (
              <span className="pointer-events-none absolute right-2 bottom-5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/90">
                {heroIdx + 1}/{n}{frozen ? ' ⏸' : ''}
              </span>
            )}
          </>
        )}
        {shouldBlur && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); setRevealed(true); }}
            className="absolute inset-0 flex items-center justify-center bg-black/20 text-[11px] font-medium text-white/90 backdrop-blur-[1px] transition-colors hover:bg-black/30"
          >
            Tap to reveal
          </span>
        )}
        {(hover || frozen) && n > 1 && (
          // Dots double as a seek bar: a click jumps there and freezes auto-seek, like the wheel.
          <div className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5 px-2">
            {images.map((_, i) => (
              <span
                key={i}
                role="button"
                aria-label={`Image ${i + 1}`}
                onClick={(e) => { e.stopPropagation(); seekTo(i); }}
                className="flex h-3 flex-1 max-w-[18px] items-center"
              >
                <span className={cn('h-1 w-full rounded-full transition-colors', i === heroIdx ? 'bg-white/90' : 'bg-white/35')} />
              </span>
            ))}
          </div>
        )}
      </div>

      {heroLoaded ? (
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-fg-secondary" title={model.name}>{model.name}</div>
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-fg-muted">
            {model.creator?.image && <img src={model.creator.image} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />}
            <span
              role="button"
              title="Show this creator's models"
              onClick={(e) => { e.stopPropagation(); if (model.creator?.username) onCreator(model.creator.username); }}
              className="truncate hover:text-fg-secondary hover:underline"
            >
              {model.creator?.username ?? '—'}
            </span>
            {versions.length > 1 && <span className="shrink-0">· {versions.length} versions</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-fg-muted">
            <span title="Downloads" className="inline-flex items-center gap-0.5"><IconDownload size={11} />{formatCount(stats.downloadCount ?? 0)}</span>
            <span title="Likes" className="inline-flex items-center gap-0.5"><IconThumbUp size={11} />{formatCount(stats.thumbsUpCount ?? 0)}</span>
            {!compact && <span title="Comments" className="inline-flex items-center gap-0.5"><IconMessageCircle size={11} />{formatCount(stats.commentCount ?? 0)}</span>}
            {!compact && (stats.tippedAmountCount ?? 0) > 0 && (
              <span title="Buzz tipped" className="inline-flex items-center gap-0.5"><IconBolt size={11} />{formatCount(stats.tippedAmountCount ?? 0)}</span>
            )}
          </div>
          {!compact && version && (
            <div className="truncate text-[10.5px] text-fg-muted" title={version.name}>
              {[version.name, sizeLabel(file?.sizeKB), file?.metadata?.fp, relativeDate(version.publishedAt ?? version.createdAt)].filter(Boolean).join(' · ')}
            </div>
          )}
          {!compact && (model.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {model.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  role="button"
                  title={`Show models tagged "${t}"`}
                  onClick={(e) => { e.stopPropagation(); onTag(t); }}
                  className="rounded border border-border-subtle px-1.5 text-[10px] text-fg-muted hover:border-accent/60 hover:text-fg-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-auto pt-1">
            <TileDownload versions={versions} previewVersionId={previewVersionId} />
          </div>
        </div>
      ) : (
        <div aria-hidden className="space-y-1.5 p-2.5">
          <div className="skeleton-shimmer h-3 w-3/4 rounded" />
          <div className="skeleton-shimmer h-2 w-1/2 rounded" />
        </div>
      )}
    </div>
  );
}

function Pill({ children, tone, title }: { children: React.ReactNode; tone?: 'info' | 'ok' | 'warn' | 'err'; title?: string }) {
  const cls = tone === 'ok' ? 'bg-emerald-600/85 text-white'
    : tone === 'warn' ? 'bg-amber-500/90 text-black'
    : tone === 'err' ? 'bg-status-err/80 text-white'
    : tone === 'info' ? 'bg-sky-900/80 text-sky-100'
    : 'bg-bg-base/80 text-fg-secondary';
  return (
    <span title={title} className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-section backdrop-blur', cls)}>
      {children}
    </span>
  );
}
