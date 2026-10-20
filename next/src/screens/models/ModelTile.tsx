/**
 * A model card in the desktop grid (Models-Desktop board): cover 3:4 with type / base / version
 * badges, name, creator, stats, and a bottom row that says Installed ✓ + Use, "2 of 3 versions" +
 * ↓, or size + Download. An adult cover (beyond the NSFW level) stays hidden until tapped.
 */
import { IconCheck, IconEyeOff } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { civitaiThumbUrl, previewStill } from '@/lib/civitai';
import { primaryFile } from '@/features/model-metadata/civitai';
import { baseModelShort, fmtSizeKB, isBeyondMask, typeLabel, type InstalledState } from './civitaiQuery';
import { Avatar, CoverBadge, COVER_FALLBACK, GhostBtn, Stats } from './bits';
import { DownloadButton } from './DownloadButton';

export const TILE_THUMB = 450;

/** The sample to show on a cover: the first one inside the NSFW level, else the first. */
export function coverImage(m: CivitaiModel, versionId: number | null | undefined, mask: number) {
  const v = m.modelVersions.find((x) => x.id === versionId) ?? m.modelVersions[0];
  const imgs = v?.images ?? [];
  return { version: v, image: imgs.find((i) => !isBeyondMask(i.nsfwLevel, mask)) ?? imgs[0] };
}

export function ModelTile({ model, selected, installed, mask, revealed, onOpen, onReveal, onUse }: {
  model: CivitaiModel; selected: boolean; installed: InstalledState; mask: number; revealed: boolean;
  onOpen: () => void; onReveal: () => void; onUse: () => void;
}) {
  const { version, image } = coverImage(model, null, mask);
  const hidden = !!image && isBeyondMask(image.nsfwLevel, mask) && !revealed;
  const url = image ? civitaiThumbUrl(previewStill(image, TILE_THUMB), TILE_THUMB) : '';
  const versions = model.modelVersions.length;
  const file = version ? primaryFile(version) : null;
  const all = installed.total > 0 && installed.installed === installed.total;
  const some = installed.installed > 0 && !all;

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 7, outline: selected ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2, minWidth: 0 }}>
      <button
        type="button"
        aria-label={`Open ${model.name}${hidden ? ' (NSFW, hidden)' : ''}`}
        aria-pressed={selected}
        onClick={hidden ? onReveal : onOpen}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: 0, border: 0, aspectRatio: '3 / 4', borderRadius: 14,
          background: hidden || !url ? (hidden ? 'var(--il-elev)' : COVER_FALLBACK) : undefined, overflow: 'hidden', cursor: 'pointer', color: 'var(--il-muted)',
        }}
      >
        {!hidden && url && <img src={url} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {hidden && (
          <span style={{ height: 26, padding: '0 10px', border: '1px solid var(--il-line-strong)', borderRadius: 999, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconEyeOff size={12} stroke={2.2} />NSFW · tap to show
          </span>
        )}
        <CoverBadge at="tl">{typeLabel(model.type).toUpperCase()}</CoverBadge>
        {version?.baseModel && <CoverBadge at="tr" tone="ember">{baseModelShort(version.baseModel)}</CoverBadge>}
        {version && <CoverBadge at="bl" tone="muted">{version.name}{versions > 1 ? ` · ${versions} versions` : ''}</CoverBadge>}
      </button>
      <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={model.name}>{model.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>
        <Avatar creator={model.creator} size={16} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>by {model.creator?.username || 'unknown'}</span>
      </div>
      <Stats stats={model.stats} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 28, gap: 6 }}>
        {all ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--il-ok)' }}><IconCheck size={13} stroke={3} />Installed</span>
            <GhostBtn onClick={onUse} label={`Use ${model.name} in the step`}>Use</GhostBtn>
          </>
        ) : some ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{installed.installed} of {installed.total} versions</span>
            {version && <DownloadButton version={version} modelType={model.type} shape="icon" />}
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{fmtSizeKB(file?.sizeKB)}</span>
            {version && <DownloadButton version={version} modelType={model.type} />}
          </>
        )}
      </div>
    </div>
  );
}
