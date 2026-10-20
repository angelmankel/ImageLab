/**
 * Section 3 — Version: a version switch (chips), the version's facts (base model, name,
 * published, downloads, availability), "Installed ✓ on …" or Download (size) on the real
 * download manager, the files list (name · size · format · fp · size type · SHA256 short + copy ·
 * primary ✓), and the version's own description when it has one. One card.
 */
import { IconCheck } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { useStore } from '@/lib/store';
import { serversWithModel } from '@/lib/routing';
import { stripHtml } from '@/features/model-metadata/civitai';
import { Chip } from '~/ui';
import { baseModelShort, fmtCount, fmtSizeKB } from '~/screens/models/civitaiQuery';
import { useInstalled } from '~/screens/models/useInstalled';
import { DownloadButton } from '~/screens/models/DownloadButton';
import { fileHashRows, fmtDate, shortHash } from './modelViewerLogic';
import { CopyBtn, FoldText, KV, Mono, Section } from './metaBits';

export function SectionVersion({ model, version, onVersion, full }: { model: CivitaiModel; version: CivitaiModelVersion; onVersion: (id: number) => void; full: boolean }) {
  const installed = useInstalled();
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const files = version.files ?? [];
  const main = files.find((f) => f.primary) ?? files[0];
  const installedFile = files.find((f) => installed.file(f));
  const on = installedFile ? serversWithModel(serverInfo, installedFile.name).map((id) => servers.find((s) => s.id === id)?.name ?? id) : [];
  const desc = stripHtml(version.description).trim();
  const ends = version.paidAccess?.endsAt ?? version.earlyAccessDeadline;
  const early = version.availability === 'EarlyAccess' || !!version.paidAccess?.permanent || (!!ends && new Date(ends).getTime() > Date.now());

  return (
    <Section title="Version" card right={model.modelVersions.length > 1 ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>{model.modelVersions.length} versions</span> : undefined}>
      {model.modelVersions.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {model.modelVersions.map((v) => <Chip key={v.id} small on={v.id === version.id} onClick={() => onVersion(v.id)} title={v.baseModel}>{v.name}</Chip>)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
        <KV label="Name" value={version.name} />
        <KV label="Base model" value={version.baseModel ? baseModelShort(version.baseModel) : '—'} title={version.baseModel} />
        <KV label="Published" value={fmtDate(version.publishedAt ?? version.createdAt) || '—'} />
        <KV label="Downloads" value={version.stats?.downloadCount != null ? fmtCount(version.stats.downloadCount) : '—'} />
        {version.baseModelType && <KV label="Base type" value={version.baseModelType} />}
        {(early || version.availability) && <KV label="Availability" value={early ? `Early access${version.paidAccess?.endsAt ? ` until ${fmtDate(version.paidAccess.endsAt)}` : ''}` : version.availability ?? ''} />}
        <KV label="Version id" value={String(version.id)} copy={String(version.id)} mono />
        <KV label="Model id" value={String(model.id)} copy={String(model.id)} mono />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
        {installedFile ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--il-ok)', minWidth: 0 }}>
            <IconCheck size={13} stroke={3} />Installed{on.length ? <span style={{ color: 'var(--il-muted)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}> on {on.join(', ')}</span> : null}
          </span>
        ) : (
          <>
            <DownloadButton version={version} modelType={model.type} h={28} />
            {main?.sizeKB ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{fmtSizeKB(main.sizeKB)}</span> : null}
          </>
        )}
      </div>

      {full && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: 'var(--il-muted)' }}>FILES · {files.length}</span>
          {files.length === 0 && <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>No files on this version</span>}
          {files.map((f) => {
            const have = installed.file(f);
            const line = [fmtSizeKB(f.sizeKB), f.metadata?.format, f.metadata?.fp, f.metadata?.size, f.type && f.type !== 'Model' ? f.type : ''].filter(Boolean).join(' · ');
            const sha = f.hashes?.SHA256 ?? fileHashRows(f.hashes)[0]?.[1];
            return (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 8px', background: 'var(--il-panel)', borderRadius: 10, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span title={f.name} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                  {f.primary && <span title="Primary file" style={{ fontSize: 10, fontWeight: 800, color: 'var(--il-ember-hi)', display: 'flex', alignItems: 'center', gap: 2 }}><IconCheck size={10} stroke={3} />primary</span>}
                  {have && <span title="On a server" style={{ color: 'var(--il-ok)', display: 'flex' }}><IconCheck size={12} stroke={3} /></span>}
                  <CopyBtn text={f.name} what="File name" size={11} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line || '—'}</span>
                  {sha && <><Mono title={sha} style={{ fontSize: 10 }}>{shortHash(sha)}</Mono><CopyBtn text={sha} what="SHA256" size={10} /></>}
                  {f.virusScanResult && f.virusScanResult !== 'Success' && <span style={{ color: 'var(--il-err)' }}>scan: {f.virusScanResult}</span>}
                  {!have && f.type !== 'Model' && !f.primary && <a href={f.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>on CivitAI ↗</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {desc && <FoldText text={desc} lines={4} size={11} />}
    </Section>
  );
}
