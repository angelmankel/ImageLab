/**
 * The version card (rule 13): the version picker (item 32: a dropdown, never a sideways strip), then every file of the chosen version — name,
 * fp · size · format · GB · hash, download count — with Installed ✓ or a Download button on
 * the real download manager, and the path the file lives at (or will land in) on the server.
 */
import { IconCheck } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { formatDate } from '@/features/model-metadata/civitai';
import { baseModelShort, fmtCount, fmtSizeKB, folderForType, shortHash } from './civitaiQuery';
import { Label, type Size } from './bits';
import { VersionPicker } from './VersionPicker';
import { DownloadButton } from './DownloadButton';
import type { Installed } from './useInstalled';

export function DetailVersions({ model, version, onVersion, installed, size }: {
  model: CivitaiModel; version: CivitaiModelVersion; onVersion: (id: number) => void; installed: Installed; size: Size;
}) {
  const phone = size === 'phone';
  const files = version.files ?? [];
  const main = files.find((f) => f.primary) ?? files[0];
  const serverName = main ? installed.serverName(main.name) : undefined;
  const path = serverName ? (installed.hashKey(main!) ?? `${folderForType(model.type)}/${serverName}`) : main ? `${folderForType(model.type)}/${main.name}` : '';

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {!phone && <Label>VERSION</Label>}
        <VersionPicker model={model} version={version} onVersion={(v) => onVersion(v.id)} h={phone ? 44 : 32} showBase />
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {[version.baseModel ? baseModelShort(version.baseModel) : '', formatDate(version.publishedAt ?? version.createdAt), version.stats?.downloadCount != null ? `${fmtCount(version.stats.downloadCount)} downloads` : '', version.availability === 'EarlyAccess' ? 'Early access' : ''].filter(Boolean).join(' · ')}
      </div>
      <Label>FILES</Label>
      {files.length === 0 && <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>No files on this version</div>}
      {files.map((f) => {
        const on = installed.file(f);
        const line = [f.metadata?.fp, f.metadata?.size, f.metadata?.format, fmtSizeKB(f.sizeKB), f.type && f.type !== 'Model' ? f.type : ''].filter(Boolean).join(' · ');
        const h = shortHash(f.hashes);
        return (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: phone ? 44 : undefined }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.name}>{f.name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {line}{h && <> · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{h}</span></>}
                {f.virusScanResult && f.virusScanResult !== 'Success' && <span style={{ color: 'var(--il-err)' }}> · scan: {f.virusScanResult}</span>}
              </div>
            </div>
            {on ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: 'var(--il-ok)', flex: 'none' }}><IconCheck size={12} stroke={3} />Installed</span>
            ) : (f === main || f.type === 'Model') ? (
              <DownloadButton version={version} modelType={model.type} size={size} h={phone ? 44 : 26} />
            ) : (
              <a href={f.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>on CivitAI ↗</a>
            )}
          </div>
        );
      })}
      {path && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={path}>{path}</div>}
    </div>
  );
}
