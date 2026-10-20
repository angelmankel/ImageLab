/**
 * A model card in the grid (the picker brief: big tiles, 220–260 wide on desktop, 2 per row on
 * the phone): cover 3:4 with type / base / version badges, name, creator, stats, and a bottom row
 * that says Installed ✓ + Use, "2 of 3 versions" + ↓, or size + Download. With a picker open the
 * primary action is Use (installed) or "Add & download". A tap on the PICTURE opens the
 * fullscreen model viewer (on the cover's picture); a tap on the name / body opens the detail
 * panel. An adult cover (beyond the NSFW level) stays hidden until tapped. Which picture is the
 * cover follows Settings → "Model preview starts on" (`useModelCover` → `usePreviewOrder`).
 */
import { useEffect, useMemo, useState } from 'react';
import { IconCheck, IconEyeOff, IconHeartFilled, IconPlus } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { civitaiThumbUrl, civitaiVideoUrl, isCivitaiVideo, previewStill } from '@/lib/civitai';
import { primaryFile } from '@/features/model-metadata/civitai';
import { baseModelShort, fmtSizeKB, isBeyondMask, typeLabel, type InstalledState } from './civitaiQuery';
import { Avatar, CoverBadge, COVER_FALLBACK, EmberBtn, GhostBtn, Stats, type Size } from './bits';
import { DownloadButton } from './DownloadButton';
import { openModelViewer } from './viewerBridge';
import { isLocalModel } from './localModels';
import { usePreviewOrder, viewerStart, type PreviewImage } from '~/app/usePreviewOrder';

export const TILE_THUMB = 560;

const NO_IMAGES: PreviewImage[] = [];

/** The sample to show on a cover: the first one inside the NSFW level, else the first. */
export function pickCover<T extends PreviewImage>(imgs: readonly T[], mask: number): T | undefined {
  const idx = imgs.findIndex((i) => !isBeyondMask(i.nsfwLevel, mask));
  return imgs[idx >= 0 ? idx : 0];
}

/**
 * The first version's pictures in the order "Model preview starts on" asks for, and the cover
 * among them. `observe` goes on the cover ("Most popular" loads once it is on screen), `start` on
 * its hover (reshuffles "Random").
 */
export function useModelCover(model: CivitaiModel, mask: number) {
  const version = model.modelVersions[0];
  const files = useMemo(() => version?.files.map((f) => f.name) ?? [], [version]);
  const { images, start, observe } = usePreviewOrder(version?.id, version?.images ?? NO_IMAGES, { files });
  const image = pickCover(images, mask);
  return { version, images, image, start, observe, viewerStart: image ? viewerStart([image], version?.id) : undefined };
}

export function ModelTile({ model, selected, installed, mask, revealed, favourite, picking, size = 'desktop', onOpen, onReveal, onUse }: {
  model: CivitaiModel; selected: boolean; installed: InstalledState; mask: number; revealed: boolean; favourite?: boolean; picking?: boolean; size?: Size;
  onOpen: () => void; onReveal: () => void; onUse: () => void;
}) {
  const phone = size === 'phone';
  const { version, images, image, start, observe, viewerStart: startOn } = useModelCover(model, mask);
  // Hover (pointer devices) plays the first sample clip within the NSFW level — the cover's own
  // clip when it is one, else the first clip among the version's samples (Donny, 10-20).
  const [hover, setHover] = useState(false);
  const clip = (() => {
    const c = image && isCivitaiVideo(image) ? image : images.find((i) => isCivitaiVideo(i) && !isBeyondMask(i.nsfwLevel, mask));
    return c?.url ? civitaiVideoUrl(c.url, TILE_THUMB) : null;
  })();
  // A cover whose link is dead falls back to the plain card colour instead of a broken-image icon.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [image?.url]);
  const hidden = !!image && isBeyondMask(image.nsfwLevel, mask) && !revealed;
  const url = image ? civitaiThumbUrl(previewStill(image, TILE_THUMB), TILE_THUMB) : '';
  const versions = model.modelVersions.length;
  const file = version ? primaryFile(version) : null;
  const all = installed.total > 0 && installed.installed === installed.total;
  const some = installed.installed > 0 && !all;
  const anyInstalled = installed.installed > 0;

  const onCover = () => {
    if (hidden) { onReveal(); return; }
    const file = isLocalModel(model) ? version?.files[0]?.name : null;
    void openModelViewer(file ? { file, start: startOn } : { modelId: model.id, versionId: version?.id ?? null, start: startOn }).then((opened) => { if (!opened) onOpen(); });
  };

  const h = phone ? 36 : 30;
  const action = picking ? (
    anyInstalled
      ? <EmberBtn h={h} size={size} onClick={onUse} style={{ flex: 1 }} label={`Use ${model.name}`}><IconCheck size={12} stroke={3} />Use</EmberBtn>
      : <EmberBtn h={h} size={size} onClick={onUse} style={{ flex: 1 }} label={`Add ${model.name} and download it`}><IconPlus size={12} stroke={3} />Add & download</EmberBtn>
  ) : all ? (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--il-ok)' }}><IconCheck size={13} stroke={3} />Installed</span>
      <GhostBtn h={h} size={size} onClick={onUse} label={`Use ${model.name} in the step`}>Use</GhostBtn>
    </>
  ) : some ? (
    <>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{installed.installed} of {installed.total} versions</span>
      {version && <DownloadButton version={version} modelType={model.type} shape="icon" />}
    </>
  ) : (
    <>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{fmtSizeKB(file?.sizeKB)}</span>
      {version && <DownloadButton version={version} modelType={model.type} h={h} size={size} />}
    </>
  );

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: phone ? 8 : 10, display: 'flex', flexDirection: 'column', gap: phone ? 6 : 7, outline: selected ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2, minWidth: 0 }}>
      <button
        type="button"
        aria-label={`${hidden ? 'Show the NSFW cover of' : 'View'} ${model.name}`}
        ref={observe}
        onClick={onCover}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') { setHover(true); start(); } }}
        onPointerLeave={() => setHover(false)}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: 0, border: 0, aspectRatio: '3 / 4', borderRadius: 14,
          background: hidden || !url ? (hidden ? 'var(--il-elev)' : COVER_FALLBACK) : 'var(--il-bg-deep)', overflow: 'hidden', cursor: 'pointer', color: 'var(--il-muted)',
        }}
      >
        {!hidden && url && !broken && <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {!hidden && hover && clip && (
          <video src={clip} poster={url || undefined} muted loop autoPlay playsInline disablePictureInPicture preload="auto" aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: 'transparent' }} />
        )}
        {hidden && (
          <span style={{ height: 26, padding: '0 10px', border: '1px solid var(--il-line-strong)', borderRadius: 999, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconEyeOff size={12} stroke={2.2} />NSFW · tap to show
          </span>
        )}
        <CoverBadge at="tl">{typeLabel(model.type).toUpperCase()}</CoverBadge>
        {version?.baseModel && <CoverBadge at="tr" tone="ember">{baseModelShort(version.baseModel)}</CoverBadge>}
        {version && <CoverBadge at="bl" tone="muted">{version.name}{versions > 1 ? ` · ${versions} versions` : ''}</CoverBadge>}
        {favourite && <span aria-label="Favourite" style={{ position: 'absolute', right: 8, bottom: 8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(20,20,22,.72)', color: 'var(--il-ember)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}><IconHeartFilled size={12} /></span>}
      </button>
      <button type="button" onClick={onOpen} aria-pressed={selected} aria-label={`Open ${model.name}`} style={{ display: 'flex', flexDirection: 'column', gap: phone ? 4 : 6, padding: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
        <span style={{ fontSize: phone ? 13 : 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }} title={model.name}>{model.name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', width: '100%' }}>
          <Avatar creator={model.creator} size={16} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>by {model.creator?.username || 'unknown'}</span>
        </span>
        <Stats stats={model.stats} size={size} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: h, gap: 6 }}>{action}</div>
    </div>
  );
}
