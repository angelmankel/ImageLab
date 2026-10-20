/**
 * A model as a list row (the desktop list view): cover 64 on the left (a tap opens the
 * fullscreen model viewer), name, "by creator · version · size", base / type / NSFW tags, stats;
 * one 44px round action on the right (installed ✓, download, or "download the latest").
 */
import { IconCheck, IconEyeOff } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { civitaiThumbUrl, previewStill } from '@/lib/civitai';
import { primaryFile } from '@/features/model-metadata/civitai';
import { baseModelShort, fmtSizeKB, isBeyondMask, typeLabel, type InstalledState } from './civitaiQuery';
import { COVER_FALLBACK, RoundAction, Stats, Tag, EmberBtn } from './bits';
import { DownloadButton } from './DownloadButton';
import { coverImage } from './ModelTile';
import { openModelViewer } from './viewerBridge';
import { isLocalModel } from './localModels';

export function ModelRow({ model, selected, installed, mask, revealed, picking, onOpen, onReveal, onUse }: {
  model: CivitaiModel; selected: boolean; installed: InstalledState; mask: number; revealed: boolean; picking?: boolean; onOpen: () => void; onReveal: () => void; onUse: () => void;
}) {
  const { version, image, imageIndex } = coverImage(model, null, mask);
  const hidden = !!image && isBeyondMask(image.nsfwLevel, mask) && !revealed;
  const url = image ? civitaiThumbUrl(previewStill(image, 160), 160) : '';
  const file = version ? primaryFile(version) : null;
  const all = installed.total > 0 && installed.installed === installed.total;
  const some = installed.installed > 0 && !all;
  const sub = [`by ${model.creator?.username || 'unknown'}`, some ? `${installed.installed} of ${installed.total} versions` : version?.name, !all && !some ? fmtSizeKB(file?.sizeKB) : ''].filter(Boolean).join(' · ');
  const onCover = () => {
    if (hidden) { onReveal(); return; }
    const file = isLocalModel(model) ? version?.files[0]?.name : null;
    void openModelViewer(file ? { file } : { modelId: model.id, versionId: version?.id ?? null, imageIndex }).then((opened) => { if (!opened) onOpen(); });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--il-card)', borderRadius: 16, padding: 8, outline: selected ? '2px solid var(--il-ember)' : undefined, outlineOffset: -2 }}>
      <button
        type="button"
        onClick={onCover}
        aria-label={hidden ? `Show the NSFW cover of ${model.name}` : `View ${model.name}`}
        style={{ width: 64, height: 64, borderRadius: 12, flex: 'none', padding: 0, border: 0, background: hidden ? 'var(--il-elev)' : url ? 'var(--il-bg-deep)' : COVER_FALLBACK, overflow: 'hidden', display: 'grid', placeItems: 'center', color: 'var(--il-muted)', cursor: 'pointer' }}
      >
        {hidden ? <IconEyeOff size={18} stroke={2.2} /> : url ? <img src={url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      </button>
      <button type="button" onClick={onOpen} aria-label={`Open ${model.name}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{model.name}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{sub}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
          {version?.baseModel && <Tag tone="ember">{baseModelShort(version.baseModel)}</Tag>}
          <Tag tone="muted">{typeLabel(model.type).toUpperCase()}</Tag>
          {model.nsfw && <Tag tone="muted" outlined>NSFW</Tag>}
        </span>
        <Stats stats={model.stats} size="phone" />
      </button>
      {picking ? (
        <EmberBtn h={36} onClick={onUse} label={`Use ${model.name}`}>{installed.installed > 0 ? 'Use' : 'Add & download'}</EmberBtn>
      ) : all ? (
        <RoundAction label="Installed" tone="ok"><IconCheck size={18} stroke={3} /></RoundAction>
      ) : version ? (
        <DownloadButton version={version} modelType={model.type} shape="round" />
      ) : null}
    </div>
  );
}
