/**
 * Section 8 — Actions at the bottom: "Use in step" when a file of the version is on a server
 * (`useModelActions().useInStep`), else "Download, then use" on the real download manager;
 * and Open on CivitAI ↗.
 */
import { IconExternalLink } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { EmberBtn, GhostBtn } from '~/screens/models/bits';
import { civitaiModelLink } from '~/screens/models/civitaiApi';
import { useInstalled } from '~/screens/models/useInstalled';
import { useModelActions } from '~/screens/models/useModelActions';
import { useVersionDownload } from '~/screens/models/DownloadButton';

export function SectionActions({ model, version, phone, onClose }: { model: CivitaiModel; version: CivitaiModelVersion | undefined; phone: boolean; onClose: () => void }) {
  const installed = useInstalled();
  const actions = useModelActions();
  const { download } = useVersionDownload();
  const installedFile = version?.files.find((f) => installed.file(f));
  const h = phone ? 44 : 36;

  const useIn = () => {
    if (!version) return;
    if (!installedFile) { void download(version, model.type); return; }
    if (actions.useInStep(version, model.type)) onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
      <EmberBtn h={h} style={{ width: '100%', fontSize: phone ? 13 : 12, borderRadius: 12 }} onClick={useIn} disabled={!version}>
        {installedFile ? `Use in ${actions.stepName}` : 'Download, then use'}
      </EmberBtn>
      <GhostBtn h={h} href={civitaiModelLink(model.id, version?.id)} style={{ width: '100%', borderRadius: 12, fontSize: phone ? 13 : 12 }}>Open on CivitAI<IconExternalLink size={13} stroke={2.2} /></GhostBtn>
    </div>
  );
}
