/**
 * The model viewer panel's secondary info (fix list 2 item 29), folded with the low-profile `Fold`
 * (one quiet line each, closed by default, a short summary of what is inside): Details (the
 * version's facts, notes and ids) · Files & hashes · On this server (a `{ file }` target's local
 * facts) · Creator & licence (follow, what the licence allows, the stats) · Tags. Plain rows,
 * copy icons on hover only.
 */
import { IconCheck, IconThumbDown, IconX } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { stripHtml } from '@/features/model-metadata/civitai';
import { Avatar, GhostBtn, Stats, Tag } from '~/screens/models/bits';
import { baseModelShort, fmtCount, fmtSizeKB, folderForType, isEarlyAccess, typeLabel } from '~/screens/models/civitaiQuery';
import { useModels } from '~/screens/models/modelsStore';
import { useInstalled } from '~/screens/models/useInstalled';
import { fileHashRows, fmtDate, licenceChips, shortHash } from './modelViewerLogic';
import { CopyBtn, Fold, FoldText, Line, Mono } from './metaBits';
import { isEarlyVersion } from './PanelHead';
import type { LocalFile } from './useViewerModel';

export function FoldDetails({ model, version }: { model: CivitaiModel; version: CivitaiModelVersion }) {
  const published = fmtDate(version.publishedAt ?? version.createdAt);
  const downloads = version.stats?.downloadCount;
  const notes = stripHtml(version.description).trim();
  const early = isEarlyVersion(version);
  const summary = [published && `published ${published}`, downloads != null && `${fmtCount(downloads)} downloads`].filter(Boolean).join(' · ');
  return (
    <Fold title="Details" summary={summary}>
      <Line label="Version" value={version.name} />
      <Line label="Base model" value={version.baseModel ? baseModelShort(version.baseModel) : '—'} title={version.baseModel} />
      {version.baseModelType && <Line label="Base type" value={version.baseModelType} />}
      <Line label="Published" value={published || '—'} />
      <Line label="Downloads" value={downloads != null ? fmtCount(downloads) : '—'} />
      {(early || version.availability) && <Line label="Availability" value={early ? `Early access${version.paidAccess?.endsAt ? ` until ${fmtDate(version.paidAccess.endsAt)}` : ''}` : version.availability ?? ''} />}
      <Line label="Version id" value={String(version.id)} copy={String(version.id)} mono />
      <Line label="Model id" value={String(model.id)} copy={String(model.id)} mono />
      {notes && <div style={{ paddingTop: 6 }}><FoldText text={notes} lines={4} size={11} /></div>}
    </Fold>
  );
}

export function FoldFiles({ version }: { version: CivitaiModelVersion }) {
  const installed = useInstalled();
  const files = version.files ?? [];
  const main = files.find((f) => f.primary) ?? files[0];
  const summary = `${files.length} file${files.length === 1 ? '' : 's'}${main?.sizeKB ? ` · ${fmtSizeKB(main.sizeKB)}` : ''}`;
  return (
    <Fold title="Files & hashes" summary={summary}>
      {files.length === 0 && <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>No files on this version</span>}
      {files.map((f) => {
        const have = installed.file(f);
        const line = [fmtSizeKB(f.sizeKB), f.metadata?.format, f.metadata?.fp, f.metadata?.size, f.type && f.type !== 'Model' ? f.type : ''].filter(Boolean).join(' · ');
        const sha = f.hashes?.SHA256 ?? fileHashRows(f.hashes)[0]?.[1];
        return (
          <div key={f.id} className="ilv-row" style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '4px 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span title={f.name} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              {have && <span title="On a server" style={{ color: 'var(--il-ok)', display: 'flex' }}><IconCheck size={12} stroke={3} /></span>}
              <CopyBtn text={f.name} what="File name" size={11} hover />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', minWidth: 0 }}>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[f.primary ? 'primary' : '', line].filter(Boolean).join(' · ') || '—'}</span>
              {sha && <><Mono title={sha} style={{ fontSize: 10 }}>{shortHash(sha)}</Mono><CopyBtn text={sha} what="SHA256" size={10} hover /></>}
              {f.virusScanResult && f.virusScanResult !== 'Success' && <span style={{ color: 'var(--il-err)' }}>scan: {f.virusScanResult}</span>}
              {!have && f.type !== 'Model' && !f.primary && <a href={f.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>on CivitAI ↗</a>}
            </div>
          </div>
        );
      })}
    </Fold>
  );
}

const KIND: Record<string, string> = { checkpoints: 'Checkpoint', loras: 'LoRA', embeddings: 'Embedding', controlnet: 'ControlNet', vae: 'VAE', upscale_models: 'Upscaler', hypernetworks: 'Hypernetwork', diffusion_models: 'Diffusion model', unet: 'Diffusion model', clip: 'Text encoder', text_encoders: 'Text encoder' };

/** A `{ file }` target's local facts. `open` when CivitAI does not know the file (then it is all there is). */
export function FoldLocal({ local, modelType }: { local: LocalFile; modelType?: string }) {
  const folder = local.folder || (modelType ? folderForType(modelType) : '');
  const kind = KIND[folder] ?? (modelType ? typeLabel(modelType) : '');
  const summary = [folder && `${folder}/`, local.servers.join(', ') || 'no server lists it'].filter(Boolean).join(' · ');
  return (
    <Fold title="On this server" summary={summary}>
      <Line label="File" value={local.name} copy={local.name} />
      <Line label="Folder · kind" value={[folder, kind].filter(Boolean).join(' · ') || '—'} />
      {local.key && <Line label="Path" value={local.key} copy={local.key} mono />}
      {local.hash && <Line label="SHA256" value={local.hash.slice(0, 10).toUpperCase()} copy={local.hash} mono title={local.hash} />}
      <Line label="Servers" value={local.servers.length ? local.servers.join(', ') : 'none online lists it'} />
    </Fold>
  );
}

export function FoldCreator({ model, full }: { model: CivitaiModel; full: boolean }) {
  const followed = useModels((s) => s.followed);
  const toggleFollow = useModels((s) => s.toggleFollow);
  const creator = model.creator?.username ?? '';
  const isFollowed = !!creator && followed.includes(creator);
  const chips = licenceChips(model, isEarlyAccess(model));
  const commercial = chips.find((c) => /commercial/i.test(c.label));
  const summary = [creator, commercial ? `${commercial.label.toLowerCase()} ${commercial.ok === false ? '✕' : '✓'}` : ''].filter(Boolean).join(' · ');
  return (
    <Fold title="Creator & licence" summary={summary}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <Avatar creator={model.creator} size={24} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creator || (full ? 'unknown creator' : '…')}</span>
        {creator && <GhostBtn h={28} onClick={() => toggleFollow(creator)} style={isFollowed ? { borderColor: 'var(--il-ember-line)', color: 'var(--il-ember-hi)' } : undefined}>{isFollowed ? 'Following' : 'Follow'}</GhostBtn>}
      </div>
      {full && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 0' }}>
          {chips.map((c) => (
            <Tag key={c.label} tone={c.tone === 'ember' ? 'emberLine' : 'muted'} outlined>
              {c.label}
              {c.ok === true && <IconCheck size={10} stroke={3.5} color="var(--il-ok)" />}
              {c.ok === false && <IconX size={10} stroke={3} color="var(--il-dim)" />}
            </Tag>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '4px 0' }}>
        <Stats stats={model.stats} full gap={10} />
        {model.stats?.thumbsDownCount != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}><IconThumbDown size={12} stroke={2.2} />{fmtCount(model.stats.thumbsDownCount)}</span>
        )}
      </div>
    </Fold>
  );
}

export function FoldTags({ model }: { model: CivitaiModel }) {
  const tags = model.tags ?? [];
  if (!tags.length) return null;
  return (
    <Fold title="Tags" summary={tags.slice(0, 3).join(', ') + (tags.length > 3 ? ` +${tags.length - 3}` : '')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {tags.map((t) => <Tag key={t} tone="muted">{t}</Tag>)}
      </div>
    </Fold>
  );
}
