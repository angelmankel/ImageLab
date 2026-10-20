/**
 * The local facts of a `{ file }` target: file name, folder / kind, the SHA256 when hashed, which
 * servers list it — and, when CivitAI does not know it, the "Not on CivitAI" note (or "Looking
 * up…" while the hash lookup is still running). Shown first for file targets, alone when the
 * file never resolves.
 */
import { IconCheck } from '@tabler/icons-react';
import { folderForType, typeLabel } from '~/screens/models/civitaiQuery';
import type { LocalFile } from './useViewerModel';
import { KV, Section } from './metaBits';

const KIND: Record<string, string> = { checkpoints: 'Checkpoint', loras: 'LoRA', embeddings: 'Embedding', controlnet: 'ControlNet', vae: 'VAE', upscale_models: 'Upscaler', hypernetworks: 'Hypernetwork', diffusion_models: 'Diffusion model', unet: 'Diffusion model', clip: 'Text encoder', text_encoders: 'Text encoder' };

export function SectionLocalFile({ local, modelType }: { local: LocalFile; modelType?: string }) {
  const folder = local.folder || (modelType ? folderForType(modelType) : '');
  const kind = KIND[folder] ?? (modelType ? typeLabel(modelType) : '');
  const note = local.state === 'not-on-civitai' ? 'Not on CivitAI'
    : local.state === 'unhashed' ? 'Not hashed yet — the ImageLab node has not seen this file'
    : local.state === 'error' ? 'CivitAI lookup failed'
    : local.state === 'pending' ? 'Looking up on CivitAI…' : '';

  return (
    <Section title="On this server" right={local.servers.length > 0 ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: 'var(--il-ok)' }}><IconCheck size={12} stroke={3} />Installed</span> : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
        <KV label="File" value={local.name} copy={local.name} title={local.name} />
        <KV label="Folder · kind" value={[folder, kind].filter(Boolean).join(' · ') || '—'} />
        {local.key && <KV label="Path" value={local.key} copy={local.key} mono title={local.key} />}
        {local.hash && <KV label="SHA256" value={local.hash.slice(0, 10).toUpperCase()} copy={local.hash} mono title={local.hash} />}
        <KV label="Servers" value={local.servers.length ? local.servers.join(', ') : 'none online lists it'} title={local.servers.join(', ')} />
      </div>
      {note && <span style={{ fontSize: 11, fontWeight: 700, color: local.state === 'pending' ? 'var(--il-muted)' : 'var(--il-warn)' }}>{note}</span>}
    </Section>
  );
}
