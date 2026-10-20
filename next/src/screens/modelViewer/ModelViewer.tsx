/**
 * The fullscreen model viewer (Donny, 10-19: "tap the preview image of a model tile → a
 * fullscreen viewer with all the metadata, organised professionally"). Rule 1 throughout: the
 * chrome takes its own rows and columns, nothing overlays the picture.
 *
 *   Desktop ≥ 768px                                  Phone
 *   ┌ top row 52 ─────────────────────────────────┐  ┌ top row 52 ──────────┐
 *   │ ‹ │        picture (contain)         │ › │ m │  │ picture, full width  │
 *   │   │                                  │   │ e │  │ (own aspect, ≤56vh)  │
 *   ├───┴──────────────────────────────────┴───┤ t │  │ thumb strip 84       │
 *   │ thumb strip 84                           │ a │  │ sections … (scroll)  │
 *   └──────────────────────────────────────────┴───┘  └ ‹ Back pill ─────────┘
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CivitaiImage } from '@/lib/civitai';
import { isCivitaiVideo } from '@/lib/civitai';
import { useIsPhone } from '~/app/useIsPhone';
import { BackPill } from '~/ui';
import { useModels } from '~/screens/models/modelsStore';
import { isBeyondMask } from '~/screens/models/civitaiQuery';
import { useKeepScroll } from '~/screens/models/useKeepScroll';
import { useModelViewer } from './viewerStore';
import { useViewerModel } from './useViewerModel';
import { useViewerKeys } from './useViewerKeys';
import { useHorizontalSwipe } from './useHorizontalSwipe';
import { nearEnd } from './modelViewerLogic';
import { usePreloadAround } from './preload';
import { TopRow } from './TopRow';
import { Picture, pictureUrl } from './Picture';
import { ThumbStrip } from './ThumbStrip';
import { MetaColumn } from './MetaColumn';

const META_W = 420;

export function ModelViewer() {
  const phone = useIsPhone();
  const target = useModelViewer((s) => s.target);
  const close = useModelViewer((s) => s.close);
  const setVersion = useModelViewer((s) => s.setVersion);
  const setImage = useModelViewer((s) => s.setImage);
  const mask = useModels((s) => s.filters.nsfwMask);
  const data = useViewerModel(target);
  const { model, version, gallery, index, local, loading } = data;
  const images = gallery.items;
  const image: CivitaiImage | undefined = images[index];
  // Reopening the same model finds its metadata column (phone: the whole page) and strip where they were.
  const keepMeta = useKeepScroll(data.modelId != null ? `viewer:${data.modelId}` : null);
  const stripKey = data.modelId != null && version ? `viewerStrip:${data.modelId}:${version.id}` : null;

  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const isHidden = useCallback((img: CivitaiImage) => isBeyondMask(img.nsfwLevel, mask) && !revealed.has(img.url), [mask, revealed]);
  const reveal = () => { if (image) setRevealed((s) => new Set(s).add(image.url)); };

  const canPrev = index > 0;
  const canNext = index < images.length - 1 || gallery.hasMore;
  const prev = useCallback(() => { if (index > 0) setImage(index - 1); }, [index, setImage]);
  const next = useCallback(() => {
    if (index < images.length - 1) setImage(index + 1);
    else if (gallery.hasMore) void gallery.loadMore().then(() => setImage(index + 1));
  }, [index, images.length, gallery, setImage]);
  const keys = useMemo(() => ({ close, prev, next }), [close, prev, next]);
  useViewerKeys(true, keys);

  // Warm the pictures around the shown one (not the hidden ones, not the clips), and fetch the
  // next gallery page a few images before the end so the strip never stalls.
  const urls = useMemo(() => images.map((img) => (isCivitaiVideo(img) || isHidden(img) ? '' : pictureUrl(img))), [images, isHidden]);
  usePreloadAround(urls, index);
  const { hasMore, loadMore } = gallery;
  useEffect(() => { if (hasMore && nearEnd(index, images.length)) void loadMore(); }, [hasMore, loadMore, index, images.length]);

  const pictureRef = useRef<HTMLDivElement>(null);
  useHorizontalSwipe(pictureRef, { enabled: phone, onLeft: next, onRight: prev });

  const title = model?.name ?? local?.meta.name ?? local?.meta.label ?? (loading ? 'Loading…' : 'Model');
  const empty = local && local.state !== 'found' ? 'No preview' : 'No sample images';
  const strip = <ThumbStrip images={images} index={index} onSelect={setImage} isHidden={isHidden} hasMore={gallery.hasMore} onMore={() => void gallery.loadMore()} loading={gallery.loading} scrollKey={stripKey} />;
  const top = <TopRow model={model} version={version} title={title} count={images.length} index={index} hasMore={gallery.hasMore} phone={phone} onClose={close} />;

  if (phone) {
    const ratio = image && image.width && image.height ? `${image.width} / ${image.height}` : '4 / 5';
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
        {top}
        <div ref={keepMeta} className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', display: 'flex', flexDirection: 'column' }}>
          <div ref={pictureRef} style={{ width: '100%', aspectRatio: ratio, maxHeight: '56vh', flex: 'none', display: 'grid', touchAction: 'pan-y' }}>
            <Picture image={image} hidden={!!image && isHidden(image)} onReveal={reveal} loading={gallery.loading} empty={empty} edges={false} canPrev={canPrev} canNext={canNext} onPrev={prev} onNext={next} />
          </div>
          {strip}
          <MetaColumn data={data} onVersion={setVersion} phone onClose={close} style={{ overflow: 'visible' }} />
        </div>
        <BackPill onClick={close} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gridTemplateColumns: `minmax(0, 1fr) ${META_W}px`, background: 'var(--il-bg)' }}>
      <div style={{ gridColumn: '1 / -1' }}>{top}</div>
      <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', minHeight: 0, minWidth: 0 }}>
        <Picture image={image} hidden={!!image && isHidden(image)} onReveal={reveal} loading={gallery.loading} empty={empty} edges canPrev={canPrev} canNext={canNext} onPrev={prev} onNext={next} />
        {strip}
      </div>
      <MetaColumn data={data} onVersion={setVersion} phone={false} onClose={close} scrollRef={keepMeta} style={{ minHeight: 0, overflowY: 'auto', borderLeft: '1px solid var(--il-line)' }} />
    </div>
  );
}
