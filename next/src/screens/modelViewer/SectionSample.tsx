/**
 * Section 7 — This sample's generation data (when the images API gives `meta`): the prompt and
 * the negative as copyable, scrollable boxes, then a 2-column grid of key/value rows (Sampler,
 * Scheduler, Steps, CFG, Seed, Size, Clip skip, Model / hashes, every other `meta` key), the
 * resources as a list, and Use prompt / Use settings through `useModelActions`.
 */
import type { CivitaiImage } from '@/lib/civitai';
import { useModelActions } from '~/screens/models/useModelActions';
import { isCopyable, metaHashes, metaResources, metaRows } from './modelViewerLogic';
import { KV, Mono, Section, TextBox } from './metaBits';

export function SectionSample({ image, index, fromApi }: { image: CivitaiImage | undefined; index: number; fromApi: boolean }) {
  const actions = useModelActions();
  const meta = image?.meta ?? null;
  const rows = metaRows(meta);
  const resources = metaResources(meta);
  const hashes = metaHashes(meta);
  const sizeKnown = rows.some(([l]) => l === 'Size');
  const btn: React.CSSProperties = { height: 32, border: 0, borderRadius: 10, background: 'var(--il-card-on)', color: 'var(--il-fg)', fontWeight: 700, fontSize: 12, cursor: 'pointer' };

  return (
    <Section title={`This sample${image ? ` · ${index + 1}` : ''}`} card>
      {!image ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>No sample selected</span>
      ) : !meta ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{fromApi ? 'This sample has no generation data' : 'Generation data comes from the images API — loading, or not reachable'}</span>
      ) : (
        <>
          {meta.prompt ? <TextBox label="Prompt" text={meta.prompt} /> : <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>no prompt</span>}
          {meta.negativePrompt && <TextBox label="Negative prompt" text={meta.negativePrompt} tone="muted" />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
            {rows.map(([label, value]) => <KV key={label} label={label} value={value} copy={isCopyable(label, value) ? value : undefined} mono={/hash/i.test(label)} />)}
            {!sizeKnown && image.width && image.height ? <KV label="Size" value={`${image.width}×${image.height}`} /> : null}
            {hashes.map(([k, v]) => <KV key={`hash:${k}`} label={`Hash · ${k}`} value={v} copy={v} mono />)}
          </div>
          {resources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>Resources</span>
              {resources.map((r, i) => (
                <div key={`${r.name}:${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>{r.name}</span>
                  {r.type && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>{r.type}</span>}
                  {r.weight != null && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-ember-hi)' }}>×{r.weight}</span>}
                  {r.hash && <Mono style={{ fontSize: 10, color: 'var(--il-muted)' }}>{r.hash.slice(0, 10)}</Mono>}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            <button type="button" style={{ ...btn, opacity: meta.prompt ? 1 : 0.5 }} disabled={!meta.prompt} onClick={() => actions.usePrompt(meta, image)}>Use prompt</button>
            <button type="button" style={btn} onClick={() => actions.useSettings(meta, image)}>Use settings</button>
          </div>
        </>
      )}
    </Section>
  );
}
