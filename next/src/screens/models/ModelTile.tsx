/**
 * A model card in the grid (fix list item 32, rebuilt: "it is hard to know which part I can click
 * to do what"). Three zones, each with its own hover and a mark that says what it does:
 *
 *   ┌ picture 3:4 ──────────────┐  hover darkens it, a "⤢ View" pill rises, zoom cursor →
 *   │ TYPE            base      │  opens the model viewer (the big modal). The ♥ toggles a
 *   │          ⤢ View           │  favourite. The picture is a drag source (~/dnd).
 *   │                        ♥  │
 *   ├ name · creator · stats  › ┤  hover lifts it, the › slides → opens the detail panel.
 *   ├───────────────────────────┤
 *   │ [v8.0 · 6.5 GB · 3 ▾] [↓] │  the version picker + Download (or ✓ + Use, or the picker's
 *   └───────────────────────────┘  Use / Add & download) for the version picked right here.
 *
 * An adult cover (beyond the NSFW level) stays hidden until tapped. Which picture is the cover
 * follows Settings → "Model preview starts on" (`useModelCover` → `usePreviewOrder`); a hover
 * plays the first sample clip within the NSFW level.
 */
import { useEffect, useMemo, useState } from 'react';
import { IconArrowsMaximize, IconCheck, IconChevronRight, IconEyeOff, IconHeart, IconHeartFilled, IconPlus } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { civitaiVideoUrl, isCivitaiVideo, previewStill } from '@/lib/civitai';
import { civitaiSmallUrl } from '~/lib/civitaiSize';
import { Button, VideoThumb } from '~/ui';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';
import { baseModelShort, typeLabel, type InstalledState } from './civitaiQuery';
import { useNsfwCover } from './nsfwCover';
import { Avatar, CoverBadge, COVER_FALLBACK, Stats, type Size } from './bits';
import { DownloadButton } from './DownloadButton';
import { VersionPicker } from './VersionPicker';
import { openModelViewer } from './viewerBridge';
import { isLocalModel } from './localModels';
import { useInstalled } from './useInstalled';
import { useModels } from './modelsStore';
import { menuProps } from '~/app/contextMenu';
import type { ModelTileTarget } from '~/app/contextMenu/menus/modelMenu';
import { usePreviewOrder, viewerStart, type PreviewImage } from '~/app/usePreviewOrder';
import './models.css';

export const TILE_THUMB = 560;

const NO_IMAGES: PreviewImage[] = [];

/** The sample to show on a cover: the first one that needs no NSFW cover (item 27), else the first. */
export function pickCover<T extends PreviewImage>(imgs: readonly T[], covered: (lvl: T['nsfwLevel']) => boolean): T | undefined {
  const idx = imgs.findIndex((i) => !covered(i.nsfwLevel));
  return imgs[idx >= 0 ? idx : 0];
}

/**
 * The first version's pictures in the order "Model preview starts on" asks for, and the cover
 * among them. `observe` goes on the cover ("Most popular" loads once it is on screen), `start` on
 * its hover (reshuffles "Random").
 */
export function useModelCover(model: CivitaiModel) {
  const covered = useNsfwCover();
  const version = model.modelVersions[0];
  const files = useMemo(() => version?.files.map((f) => f.name) ?? [], [version]);
  const { images, start, observe } = usePreviewOrder(version?.id, version?.images ?? NO_IMAGES, { files });
  const image = pickCover(images, covered);
  return { covered, version, images, image, start, observe, viewerStart: image ? viewerStart([image], version?.id) : undefined };
}

export function ModelTile({ model, selected, installed, revealed, favourite, picking, size = 'desktop', onOpen, onReveal, onUse }: {
  model: CivitaiModel; selected: boolean; installed: InstalledState; mask: number; revealed: boolean; favourite?: boolean; picking?: boolean; size?: Size;
  onOpen: () => void; onReveal: () => void;
  /** Use the version picked on the tile (in the step, or as the picker's pick). */
  onUse: (version?: CivitaiModelVersion) => void;
}) {
  const phone = size === 'phone';
  const { covered, version: first, images, image, start, observe, viewerStart: startOn } = useModelCover(model);
  const inst = useInstalled();
  // The version this tile downloads / uses: the one a server has, else the newest; the picker changes it.
  const [versionId, setVersionId] = useState<number | null>(null);
  const version = model.modelVersions.find((v) => v.id === versionId) ?? model.modelVersions.find((v) => inst.version(v)) ?? first;
  const has = !!version && inst.version(version);

  const [hover, setHover] = useState(false);
  const clip = (() => {
    const c = image && isCivitaiVideo(image) ? image : images.find((i) => isCivitaiVideo(i) && !covered(i.nsfwLevel));
    // The smallest transcode that fills a tile (video previews: smallest rendition).
    return c?.url ? civitaiVideoUrl(c.url, 450) : null;
  })();
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [image?.url]);
  const hidden = !!image && covered(image.nsfwLevel) && !revealed;
  const url = image ? civitaiSmallUrl(image, TILE_THUMB) : '';
  const local = isLocalModel(model);
  const toggleFavourite = useModels((s) => s.toggleFavourite);

  // The cover is a picture you can drag onto a step, a drop zone, another tab (~/dnd).
  const drag = useImageDrag(() => {
    if (!image || hidden || isCivitaiVideo(image)) return null;
    const full = previewStill(image);
    return makePayload({ url: full, name: nameFromUrl(full) || `${model.name}.png`, source: 'model' });
  });

  const onCover = () => {
    if (hidden) { onReveal(); return; }
    const file = local ? first?.files[0]?.name : null;
    void openModelViewer(file ? { file, start: startOn } : { modelId: model.id, versionId: version?.id ?? null, start: startOn }).then((opened) => { if (!opened) onOpen(); });
  };

  const h = phone ? 40 : 34;
  const action = !version ? null : picking ? (
    <Button tone="primary" h={h} grow={phone} icon={has ? <IconCheck size={13} stroke={3} /> : <IconPlus size={13} stroke={3} />} onClick={() => onUse(version)} aria-label={`${has ? 'Use' : 'Add and download'} ${model.name} ${version.name}`}>
      {has ? 'Use' : phone ? 'Add' : 'Add & get'}
    </Button>
  ) : has ? (
    <Button tone="card" h={h} grow={phone} icon={<IconCheck size={13} stroke={3} color="var(--il-ok)" />} onClick={() => onUse(version)} tooltip="Use in step">Use</Button>
  ) : (
    <DownloadButton version={version} modelType={model.type} h={h} size={size} style={phone ? { flex: 1 } : undefined} />
  );

  return (
    <div {...menuProps<ModelTileTarget>('model-tile', { model, view: onCover, open: onOpen, use: installed.installed > 0 ? () => onUse(version) : null })}
      style={{ background: 'var(--il-card)', borderRadius: 16, display: 'flex', flexDirection: 'column', outline: `2px solid ${selected ? 'var(--il-ember)' : 'transparent'}`, outlineOffset: -2, minWidth: 0 }}>
      {/* Zone 1 · the picture → the viewer */}
      <div style={{ position: 'relative', margin: phone ? '6px 6px 0' : '8px 8px 0' }}>
        <button
          type="button"
          className="ilm-cover"
          aria-label={`${hidden ? 'Show the NSFW cover of' : 'View the pictures of'} ${model.name}`}
          ref={observe}
          onClick={onCover}
          onPointerEnter={(e) => { if (e.pointerType !== 'touch') { setHover(true); start(); } }}
          onPointerLeave={() => setHover(false)}
          {...drag}
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: 0, border: 0, aspectRatio: '3 / 4', borderRadius: 12,
            background: hidden || !url ? (hidden ? 'var(--il-elev)' : COVER_FALLBACK) : 'var(--il-bg-deep)', overflow: 'hidden', color: 'var(--il-muted)',
          }}
        >
          {!hidden && url && !broken && <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          {/* Settings → Video previews: on hover (default) / autoplay on screen / off; the still stays under it. */}
          {!hidden && clip && <VideoThumb src={clip} overlay hovered={hover} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
          {hidden ? (
            <span style={{ height: 26, padding: '0 10px', border: '1px solid var(--il-line-strong)', borderRadius: 999, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconEyeOff size={12} stroke={2.2} />NSFW · tap to show
            </span>
          ) : (
            <span className="ilm-veil"><span className="ilm-eye"><IconArrowsMaximize size={13} stroke={2.6} />View</span></span>
          )}
          <CoverBadge at="tl">{typeLabel(model.type).toUpperCase()}</CoverBadge>
          {version?.baseModel && <CoverBadge at="tr" tone="ember">{baseModelShort(version.baseModel)}</CoverBadge>}
          {!hidden && (
            <span className="ilm-touch-eye" aria-hidden style={{ position: 'absolute', left: 8, bottom: 8, width: 26, height: 26, borderRadius: '50%', background: 'color-mix(in srgb, var(--il-bg) 78%, transparent)', color: 'var(--il-fg)', placeItems: 'center' }}>
              <IconArrowsMaximize size={13} stroke={2.4} />
            </span>
          )}
        </button>
        {!local && (
          <button type="button" className="ilm-heart" onClick={() => toggleFavourite(model.id)} aria-pressed={!!favourite} aria-label={favourite ? `Remove ${model.name} from favourites` : `Add ${model.name} to favourites`}
            style={{ position: 'absolute', right: 8, bottom: 8, width: phone ? 36 : 30, height: phone ? 36 : 30, border: 0, padding: 0, borderRadius: '50%', background: 'color-mix(in srgb, var(--il-bg) 78%, transparent)', color: favourite ? 'var(--il-ember)' : 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            {favourite ? <IconHeartFilled size={14} /> : <IconHeart size={14} stroke={2.2} />}
          </button>
        )}
      </div>

      {/* Zone 2 · name, creator, stats → the detail panel */}
      <button type="button" className="ilm-info" onClick={onOpen} aria-pressed={selected} aria-label={`Details of ${model.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, margin: phone ? '4px 3px 0' : '4px 4px 0', padding: phone ? '8px 6px 8px 8px' : '9px 8px 9px 10px', border: 0, borderRadius: 12, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: phone ? 3 : 5 }}>
          <span style={{ fontSize: phone ? 13 : 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={model.name}>{model.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', minWidth: 0 }}>
            <Avatar creator={model.creator} size={16} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>by {model.creator?.username || 'unknown'}</span>
          </span>
          {!phone && <Stats stats={model.stats} size={size} />}
        </span>
        <IconChevronRight className="ilm-chev" size={16} stroke={2.6} style={{ flex: 'none' }} />
      </button>

      {/* Zone 3 · version + Download / Use */}
      {version && (
        <div style={{ display: 'flex', flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', gap: 6, padding: phone ? 6 : 8, borderTop: '1px solid var(--il-line-soft)', marginTop: 4, minWidth: 0 }}>
          <VersionPicker model={model} version={version} onVersion={(v) => setVersionId(v.id)} h={h} />
          {action}
        </div>
      )}
    </div>
  );
}
