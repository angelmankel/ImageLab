/**
 * The top of the model viewer's info panel (fix list 2 item 29): the useful bits first, in one
 * block — the name, "Type · by creator", a few chips (base model, installed / early access), the
 * version picker (a select when there is more than one), then the ONE primary action: "Use in
 * <step>" when a file of the version is on a server, else Download (the real download manager).
 * Open on CivitAI sits in the top bar; everything secondary is folded further down (PanelFolds).
 */
import { IconCheck } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { SearchSelect } from '~/ui';
import { EmberBtn, Tag } from '~/screens/models/bits';
import { baseModelShort, fmtSizeKB, typeLabel } from '~/screens/models/civitaiQuery';
import { useInstalled } from '~/screens/models/useInstalled';
import { useModelActions } from '~/screens/models/useModelActions';
import { useVersionDownload } from '~/screens/models/DownloadButton';

export function isEarlyVersion(version: CivitaiModelVersion): boolean {
  const ends = version.paidAccess?.endsAt ?? version.earlyAccessDeadline;
  return version.availability === 'EarlyAccess' || !!version.paidAccess?.permanent || (!!ends && new Date(ends).getTime() > Date.now());
}

export function PanelHead({ model, version, onVersion, phone, onClose }: {
  model: CivitaiModel; version: CivitaiModelVersion | undefined; onVersion: (id: number) => void; phone: boolean; onClose: () => void;
}) {
  const installed = useInstalled();
  const actions = useModelActions();
  const { stateOf, download } = useVersionDownload();
  const installedFile = version?.files.find((f) => installed.file(f));
  const main = version ? version.files.find((f) => f.primary) ?? version.files[0] : undefined;
  const creator = model.creator?.username;
  const dl = version ? stateOf(version).state : 'offline';
  const busy = dl === 'downloading';
  const offline = dl === 'offline';

  const act = () => {
    if (!version) return;
    // Opened from a step's picker (Change / + Add): the pick goes to that slot, never an extra add.
    if (actions.picking) { if (actions.pick(model, version)) onClose(); return; }
    if (!installedFile) { if (!busy) void download(version, model.type); return; }
    if (actions.useInStep(version, model.type)) onClose();
  };
  const label = actions.picking ? (installedFile ? 'Use this model' : 'Download and use') : installedFile ? `Use in ${actions.stepName}` : busy ? 'Downloading…' : offline ? 'No server online' : `Download${main?.sizeKB ? ` · ${fmtSizeKB(main.sizeKB)}` : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: phone ? 16 : 18, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{model.name}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', marginTop: 2 }}>
          {typeLabel(model.type)}{creator ? ` · by ${creator}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {version?.baseModel && <Tag tone="ember">{baseModelShort(version.baseModel)}</Tag>}
        {installedFile && <Tag tone="muted"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--il-ok)' }}><IconCheck size={11} stroke={3} />Installed</span></Tag>}
        {version && isEarlyVersion(version) && <Tag tone="muted">Early access</Tag>}
        {model.nsfw && <Tag tone="muted" outlined>NSFW</Tag>}
      </div>
      {model.modelVersions.length > 1 && version && (
        <SearchSelect label="Version" value={String(version.id)} onChange={(v) => onVersion(Number(v))} searchable={model.modelVersions.length > 8}
          options={model.modelVersions.map((v) => ({ value: String(v.id), label: `${v.name}${v.baseModel ? ` · ${baseModelShort(v.baseModel)}` : ''}` }))} />
      )}
      <EmberBtn h={phone ? 44 : 38} style={{ width: '100%', fontSize: 13, borderRadius: 12 }} onClick={act} disabled={!version || (!actions.picking && (busy || (!installedFile && offline)))}>{label}</EmberBtn>
    </div>
  );
}
