/**
 * The selected sample's generation data (rule 13), right under the pictures (fix list item 32:
 * "too far down, it should be close to the images so it is clear it belongs to the selected
 * one"): "This image · 3 of 20", the prompt (3 lines, tap for all), the negative, Steps · Sampler
 * · CFG · Seed · Size · Clip skip, the model it was made with, and Use prompt / Use settings,
 * which land on the active step through `applyGenerationData`. Long words wrap: nothing in here
 * may push the panel sideways. The /images API carries `meta`; the model payload's images do not.
 */
import { useState } from 'react';
import type { CivitaiImage } from '@/lib/civitai';
import { Button } from '~/ui';
import { Label, type Size } from './bits';

function Box({ label, value }: { label: string; value: string | number | undefined | null }) {
  const text = value == null || value === '' ? '—' : String(value);
  return (
    <div style={{ background: 'var(--il-elev)', borderRadius: 9, padding: '5px 8px', minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--il-muted)' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={text}>{text}</div>
    </div>
  );
}

export function DetailSample({ image, index, total, more, size, hasMeta, onUsePrompt, onUseSettings }: {
  image: CivitaiImage | undefined; index: number; total: number; more?: boolean; size: Size; hasMeta: boolean;
  onUsePrompt: () => void; onUseSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = image?.meta ?? null;
  const phone = size === 'phone';
  const sizeText = typeof meta?.Size === 'string' ? meta.Size : image?.width ? `${image.width}×${image.height}` : '';
  const clip = meta?.clipSkip ?? meta?.['Clip skip'] ?? meta?.clip_skip;
  const wrap = { overflowWrap: 'anywhere', wordBreak: 'break-word' } as const;
  if (!image) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <Label>THIS IMAGE · {index + 1} OF {total}{more ? '+' : ''}</Label>
      {!meta ? (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{hasMeta ? 'This sample has no generation data' : 'Generation data comes from the images API — loading, or not reachable'}</div>
      ) : (
        <>
          <p onClick={() => setOpen((o) => !o)} title={open ? 'tap to fold' : 'tap for the whole prompt'}
            style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--il-fg)', display: '-webkit-box', WebkitLineClamp: open ? undefined : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer', ...wrap }}>
            {meta.prompt || <span style={{ color: 'var(--il-muted)' }}>no prompt</span>}
          </p>
          {meta.negativePrompt && (
            <p onClick={() => setOpen((o) => !o)}
              style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: 'var(--il-muted)', display: '-webkit-box', WebkitLineClamp: open ? undefined : 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer', ...wrap }}>
              <span style={{ color: 'var(--il-err)', fontWeight: 800 }}>neg </span>{meta.negativePrompt}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 4 }}>
            <Box label="Steps" value={meta.steps} />
            <Box label="Sampler" value={meta.sampler} />
            <Box label="CFG" value={meta.cfgScale} />
            <Box label="Seed" value={meta.seed} />
            <Box label="Size" value={sizeText} />
            <Box label="Clip skip" value={clip as string | number | undefined} />
          </div>
          {typeof meta.Model === 'string' && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={meta.Model}>Model: {meta.Model}{typeof meta['Model hash'] === 'string' ? ` · ${meta['Model hash']}` : ''}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            <Button tone="card" size={phone ? 'lg' : 'md'} grow onClick={onUsePrompt} disabled={!meta.prompt}>Use prompt</Button>
            <Button tone="card" size={phone ? 'lg' : 'md'} grow onClick={onUseSettings}>Use settings</Button>
          </div>
        </>
      )}
    </div>
  );
}
