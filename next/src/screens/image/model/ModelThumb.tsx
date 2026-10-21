/**
 * A model's picture in the Image step (rule 4) with Settings → "Model preview starts on" applied:
 * `useModelPreview` orders the file's CivitAI pictures through `~/app/usePreviewOrder` (curated ·
 * most popular · random · local history first) and says which picture the fullscreen viewer
 * should open on; `ModelThumb` is `Thumb` fed by it: "Most popular" loads when it is on screen, a
 * hover reshuffles "Random". A pending pick (not downloaded, no hash yet) keeps its pick thumbnail.
 */
import { useMemo } from 'react';
import { previewStill } from '@/lib/civitai';
import { usePreviewOrder, viewerStart, type PreviewImage } from '~/app/usePreviewOrder';
import { useNsfwCover } from '~/screens/models/nsfwCover';
import { Thumb } from './Thumb';
import type { ModelMeta } from './useModelMeta';

type MetaPart = Pick<ModelMeta, 'file' | 'images' | 'samples' | 'versionId'>;

export function useModelPreview(meta: MetaPart, opts: { active?: boolean } = {}) {
  const curated: PreviewImage[] = useMemo(
    () => (meta.samples.length ? meta.samples : meta.images.map((url) => ({ url }))),
    [meta.samples, meta.images],
  );
  const files = useMemo(() => (meta.file ? [meta.file] : []), [meta.file]);
  const { images: ordered, start, observe } = usePreviewOrder(meta.versionId, curated, { files, active: opts.active });
  // No NSFW picture on a card or thumb unless the user opted in (item 27); local generations stay.
  const covered = useNsfwCover();
  const images = useMemo(() => ordered.filter((i) => i.local || !covered(i.nsfwLevel)), [ordered, covered]);
  const stills = useMemo(() => images.map((i) => (i.local ? i.url : previewStill(i))).filter(Boolean), [images]);
  // Each still with the viewer start that opens on it (the card's art, item 16).
  const pictures = useMemo(() => images.map((i) => ({ url: i.local ? i.url : previewStill(i), start: viewerStart([i], meta.versionId) })).filter((p) => !!p.url), [images, meta.versionId]);
  return {
    stills,
    pictures,
    start,
    /** A callback ref for the picture: "Most popular" loads once it is on screen. */
    observe,
    /** Hand to `openModelViewer({ file, start })`. */
    viewerStart: viewerStart(images, meta.versionId),
    /** Spread on the element the pointer enters (not touch). */
    hover: { onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType !== 'touch') start(); } },
  };
}

export function ModelThumb({ meta, label, size, round, style, active }: {
  meta: MetaPart; label: string; size: number; round?: boolean; style?: React.CSSProperties; active?: boolean;
}) {
  const p = useModelPreview(meta, { active });
  return <Thumb label={label} images={p.stills} size={size} round={round} style={style} rootRef={p.observe} {...p.hover} />;
}
