/**
 * The selected sample's generation data (rule 13): prompt, negative, Steps · Sampler · CFG · Seed
 * · Size · Clip skip, and Use prompt / Use settings, which land on the active step through
 * `applyGenerationData`. The /images API carries `meta`; the model payload's images do not.
 */
import { useState } from 'react';
import type { CivitaiImage } from '@/lib/civitai';
import { Label, type Size } from './bits';

function Box({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div style={{ background: 'var(--il-panel)', borderRadius: 10, padding: '6px 8px', minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--il-muted)' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value == null || value === '' ? '—' : String(value)}</div>
    </div>
  );
}

export function DetailSample({ image, index, size, hasMeta, onUsePrompt, onUseSettings }: {
  image: CivitaiImage | undefined; index: number; size: Size; hasMeta: boolean;
  onUsePrompt: () => void; onUseSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = image?.meta ?? null;
  const phone = size === 'phone';
  const sizeText = typeof meta?.Size === 'string' ? meta.Size : image ? `${image.width}×${image.height}` : '';
  const clip = meta?.clipSkip ?? meta?.['Clip skip'] ?? meta?.clip_skip;
  const btn: React.CSSProperties = { height: phone ? 44 : 34, border: 0, borderRadius: phone ? 12 : 10, background: 'var(--il-card-on)', color: 'var(--il-fg)', fontWeight: 700, fontSize: 12, cursor: 'pointer' };

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label>SAMPLE · IMAGE {index + 1}</Label>
      {!meta ? (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{hasMeta ? 'This sample has no generation data' : 'Generation data comes from the images API — loading, or not reachable'}</div>
      ) : (
        <>
          <p onClick={() => setOpen((o) => !o)} style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--il-fg)', display: '-webkit-box', WebkitLineClamp: open ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer' }} title={open ? undefined : 'tap to expand'}>
            {meta.prompt || <span style={{ color: 'var(--il-muted)' }}>no prompt</span>}
          </p>
          {meta.negativePrompt && (
            <p onClick={() => setOpen((o) => !o)} style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: 'var(--il-muted)', whiteSpace: open ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
              <span style={{ color: 'var(--il-err)', fontWeight: 800 }}>neg </span>{meta.negativePrompt}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
            <Box label="Steps" value={meta.steps} />
            <Box label="Sampler" value={meta.sampler} />
            <Box label="CFG" value={meta.cfgScale} />
            <Box label="Seed" value={meta.seed} />
            <Box label="Size" value={sizeText} />
            <Box label="Clip skip" value={clip as string | number | undefined} />
          </div>
          {typeof meta.Model === 'string' && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Model: {meta.Model}{typeof meta['Model hash'] === 'string' ? ` · ${meta['Model hash']}` : ''}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            <button type="button" style={btn} onClick={onUsePrompt} disabled={!meta.prompt}>Use prompt</button>
            <button type="button" style={btn} onClick={onUseSettings}>Use settings</button>
          </div>
        </>
      )}
    </div>
  );
}
