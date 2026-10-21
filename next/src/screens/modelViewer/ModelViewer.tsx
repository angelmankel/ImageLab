/**
 * The model viewer (Donny, 10-19: "tap the preview image of a model tile → a viewer with all the
 * metadata, organised professionally"; 10-20, item 32: a BIG MODAL, not full screen — the window
 * is `ModelViewerHost`'s). Rule 1 throughout: the chrome takes its own rows and columns, nothing
 * overlays the picture.
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
import { civitaiVideoUrl, isCivitaiVideo } from '@/lib/civitai';
import { civitaiFullUrl } from '~/lib/civitaiSize';
import { openExternalViewer, updateExternalViewer, useExternalViewer, type ExternalImage } from '~/screens/viewer/externalViewer';
import { useIsPhone } from '~/app/useIsPhone';
import { BackPill } from '~/ui';
import { useNsfwCover } from '~/screens/models/nsfwCover';
import { useKeepScroll } from '~/screens/models/useKeepScroll';
import { useModelViewer } from './viewerStore';
import { useViewerModel } from './useViewerModel';
import { useViewerKeys } from './useViewerKeys';
import { useHorizontalSwipe } from './useHorizontalSwipe';
import { counterText, nearEnd } from './modelViewerLogic';
import { usePreloadAround } from './preload';
import { TopRow } from './TopRow';
import { Picture, pictureUrl } from './Picture';
import { ThumbStrip } from './ThumbStrip';
import { MetaColumn } from './MetaColumn';
import { vh } from '~/theme/uiScale';

const META_W = 420;
/** The full-screen viewer's widest picture (item 31): the smallest CivitAI rendition that holds the original, at most this. */
const FULL_W = 2200;

export function ModelViewer() {
  const phone = useIsPhone();
  const target = useModelViewer((s) => s.target);
  const close = useModelViewer((s) => s.close);
  const setVersion = useModelViewer((s) => s.setVersion);
  const setImage = useModelViewer((s) => s.setImage);
  const data = useViewerModel(target);
  const { model, version, gallery, index, local, loading } = data;
  const images = gallery.items;
  const image: CivitaiImage | undefined = images[index];
  // Reopening the same model finds its metadata column (phone: the whole page) and strip where they were.
  const keepMeta = useKeepScroll(data.modelId != null ? `viewer:${data.modelId}` : null);
  const stripKey = data.modelId != null && version ? `viewerStrip:${data.modelId}:${version.id}` : null;

  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const covered = useNsfwCover();
  const isHidden = useCallback((img: CivitaiImage) => covered(img.nsfwLevel) && !revealed.has(img.url), [covered, revealed]);
  const reveal = () => { if (image) setRevealed((s) => new Set(s).add(image.url)); };

  const canPrev = index > 0;
  const canNext = index < images.length - 1 || gallery.hasMore;
  const prev = useCallback(() => { if (index > 0) setImage(index - 1); }, [index, setImage]);
  const next = useCallback(() => {
    if (index < images.length - 1) setImage(index + 1);
    else if (gallery.hasMore) void gallery.loadMore().then(() => setImage(index + 1));
  }, [index, images.length, gallery, setImage]);
  const keys = useMemo(() => ({ close, prev, next }), [close, prev, next]);
  // The full-screen viewer on top owns the keys while it is open (item 31).
  const externalOpen = useExternalViewer((s) => s.open);
  useViewerKeys(!externalOpen, keys);

  // Item 31: a tap on the picture (or on the current thumb) opens it in the full-screen viewer —
  // ← / → through all of this model's pictures, Esc back here at the same one.
  const toExternal = useCallback((list: CivitaiImage[]): ExternalImage[] => list.map((img) => {
    const video = isCivitaiVideo(img);
    const id = (img as { id?: number }).id;
    return {
      url: video ? civitaiVideoUrl(img.url, 2048) : civitaiFullUrl(img, FULL_W),
      key: img.url, kind: video ? 'video' : 'image', width: img.width || undefined, height: img.height || undefined,
      meta: img.meta, nsfw: covered(img.nsfwLevel), link: id ? `https://civitai.com/images/${id}` : undefined,
    };
  }), [covered]);
  const { hasMore, loadMore } = gallery;
  const openFull = useCallback((i: number) => {
    const img = images[i];
    if (!img || isHidden(img)) return;
    openExternalViewer({
      images: toExternal(images), index: i, source: model?.name ?? local?.meta.label,
      // Perf pass: the modal under the full-screen viewer is hidden, so it follows only on close
      // (Esc lands on the same picture) — syncing it per picture re-rendered and re-decoded it on
      // every ← / →.
      onClose: setImage, hasMore, loadMore: hasMore ? () => loadMore() : undefined,
    });
  }, [images, isHidden, toExternal, model, local, setImage, hasMore, loadMore]);
  // A longer list (another page) or a changed opt-in reaches the open viewer.
  useEffect(() => {
    if (externalOpen) updateExternalViewer({ images: toExternal(images), hasMore, loadMore: hasMore ? () => loadMore() : undefined });
  }, [externalOpen, images, toExternal, hasMore, loadMore]);

  // Warm the pictures around the shown one (not the hidden ones, not the clips), and fetch the
  // next gallery page a few images before the end so the strip never stalls.
  const urls = useMemo(() => images.map((img) => (isCivitaiVideo(img) || isHidden(img) ? '' : pictureUrl(img))), [images, isHidden]);
  usePreloadAround(urls, index);
  useEffect(() => { if (hasMore && nearEnd(index, images.length)) void loadMore(); }, [hasMore, loadMore, index, images.length]);

  const pictureRef = useRef<HTMLDivElement>(null);
  useHorizontalSwipe(pictureRef, { enabled: phone, onLeft: next, onRight: prev });

  const onMore = useCallback(() => void loadMore(), [loadMore]);
  const title = model?.name ?? local?.meta.name ?? local?.meta.label ?? (loading ? 'Loading…' : 'Model');
  const empty = local && local.state !== 'found' ? 'No preview' : 'No sample images';
  const strip = <ThumbStrip images={images} index={index} onSelect={setImage} onOpen={openFull} isHidden={isHidden} hasMore={hasMore} onMore={onMore} loading={gallery.loading} loadingMore={gallery.loadingMore} scrollKey={stripKey} />;
  const top = <TopRow model={model} version={version} title={title} counter={counterText(index, images.length, hasMore)} phone={phone} onClose={close} />;

  if (phone) {
    const ratio = image && image.width && image.height ? `${image.width} / ${image.height}` : '4 / 5';
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
        {top}
        <div ref={keepMeta} className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', display: 'flex', flexDirection: 'column' }}>
          {/* A plain block (not a grid): the picture sizes itself absolutely inside it (item 6). */}
          <div ref={pictureRef} style={{ width: '100%', aspectRatio: ratio, maxHeight: vh(56), flex: 'none', position: 'relative', touchAction: 'pan-y' }}>
            <Picture image={image} hidden={!!image && isHidden(image)} onReveal={reveal} loading={gallery.loading} empty={empty} onOpen={() => openFull(index)} edges={false} canPrev={canPrev} canNext={canNext} onPrev={prev} onNext={next} />
          </div>
          {strip}
          <MetaColumn data={data} onVersion={setVersion} phone onClose={close} onOpen={() => openFull(index)} style={{ overflow: 'visible' }} />
        </div>
        <BackPill onClick={close} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gridTemplateColumns: `minmax(0, 1fr) ${META_W}px`, background: 'var(--il-bg)' }}>
      <div style={{ gridColumn: '1 / -1' }}>{top}</div>
      <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', minHeight: 0, minWidth: 0 }}>
        <Picture image={image} hidden={!!image && isHidden(image)} onReveal={reveal} loading={gallery.loading} empty={empty} onOpen={() => openFull(index)} edges canPrev={canPrev} canNext={canNext} onPrev={prev} onNext={next} />
        {strip}
      </div>
      <MetaColumn data={data} onVersion={setVersion} phone={false} onClose={close} onOpen={() => openFull(index)} scrollRef={keepMeta} style={{ minHeight: 0, overflowY: 'auto', borderLeft: '1px solid var(--il-line)' }} />
    </div>
  );
}
