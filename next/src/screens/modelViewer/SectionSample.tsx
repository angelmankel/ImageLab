/**
 * This picture's generation data (item 29: slim): the prompt in a scrollable box, one line of the
 * key facts (sampler · steps · CFG · seed · size), Use prompt / Use settings — and the rest (the
 * negative, every other `meta` key, hashes, the resources) folded under "All generation data".
 */
import { IconArrowsMaximize } from '@tabler/icons-react';
import type { CivitaiImage } from '@/lib/civitai';
import { useModelActions } from '~/screens/models/useModelActions';
import { isCopyable, metaHashes, metaResources, metaRows } from './modelViewerLogic';
import { Fold, Line, Mono, Section, TextBox, TextBtn } from './metaBits';

const KEY_FACTS = ['Sampler', 'Steps', 'CFG', 'Seed', 'Size'];

export function SectionSample({ image, index, fromApi, onOpen }: { image: CivitaiImage | undefined; index: number; fromApi: boolean; onOpen?: () => void }) {
  const actions = useModelActions();
  const meta = image?.meta ?? null;
  const rows = metaRows(meta);
  const resources = metaResources(meta);
  const hashes = metaHashes(meta);
  const size = image?.width && image.height && !rows.some(([l]) => l === 'Size') ? `${image.width}×${image.height}` : '';
  const facts = [...KEY_FACTS.map((k) => rows.find(([l]) => l === k)?.[1] && `${k === 'Sampler' || k === 'Size' ? '' : `${k} `}${rows.find(([l]) => l === k)?.[1]}`), size].filter(Boolean);
  const rest = rows.filter(([l]) => l !== 'Sampler' && l !== 'Steps' && l !== 'CFG');
  const btn: React.CSSProperties = { height: 34, border: 0, borderRadius: 10, background: 'var(--il-card-on)', color: 'var(--il-fg)', fontWeight: 700, fontSize: 12, cursor: 'pointer' };

  return (
    <Section title={`This picture${image ? ` · ${index + 1}` : ''}`} card right={image && onOpen ? <TextBtn onClick={onOpen}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Full screen<IconArrowsMaximize size={11} stroke={2.4} /></span></TextBtn> : undefined}>
      {!image ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>No picture selected</span>
      ) : !meta ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{fromApi ? 'No generation data for this picture' : 'Looking for its generation data…'}</span>
      ) : (
        <>
          {meta.prompt ? <TextBox label="Prompt" text={meta.prompt} /> : <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>no prompt</span>}
          {facts.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', overflowWrap: 'anywhere' }}>{facts.join(' · ')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            <button type="button" style={{ ...btn, opacity: meta.prompt ? 1 : 0.5 }} disabled={!meta.prompt} onClick={() => actions.usePrompt(meta, image)}>Use prompt</button>
            <button type="button" style={btn} onClick={() => actions.useSettings(meta, image)}>Use settings</button>
          </div>
          {(meta.negativePrompt || rest.length > 0 || resources.length > 0 || hashes.length > 0) && (
            <Fold title="All generation data" summary={[meta.negativePrompt ? 'negative' : '', resources.length ? `${resources.length} resources` : ''].filter(Boolean).join(' · ')}>
              {meta.negativePrompt && <div style={{ paddingBottom: 6 }}><TextBox label="Negative prompt" text={meta.negativePrompt} tone="muted" /></div>}
              {rest.map(([label, value]) => <Line key={label} label={label} value={value} copy={isCopyable(label, value) ? value : undefined} mono={/hash/i.test(label)} />)}
              {hashes.map(([k, v]) => <Line key={`hash:${k}`} label={`Hash · ${k}`} value={v} copy={v} mono />)}
              {resources.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', paddingTop: 6 }}>Resources</span>}
              {resources.map((r, i) => (
                <div key={`${r.name}:${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, minWidth: 0, minHeight: 22 }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>{r.name}</span>
                  {r.type && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>{r.type}</span>}
                  {r.weight != null && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-ember-hi)' }}>×{r.weight}</span>}
                  {r.hash && <Mono style={{ fontSize: 10, color: 'var(--il-muted)' }}>{r.hash.slice(0, 10)}</Mono>}
                </div>
              ))}
            </Fold>
          )}
        </>
      )}
    </Section>
  );
}
