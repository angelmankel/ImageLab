/**
 * List-2 item 31, the Details tab for an external picture (a CivitAI sample): its generation data
 * — prompt + negative, the parameter tiles (Sampler, Steps, CFG, Seed, Size, …), the resources
 * (checkpoint, LoRAs, embeddings) — with Use prompt / Reuse settings / Send to a step. An action
 * closes the viewer and lets the opener step aside (`leaveExternalViewer`).
 */
import { IconCopy, IconExternalLink } from '@tabler/icons-react';
import { applyGenerationData, sendToStep } from '~/app/actions';
import { metaForStep } from '~/screens/models/useModelActions';
import { metaResources, metaRows } from '~/screens/modelViewer/modelViewerLogic';
import { useSteps } from '~/app/stepsStore';
import { Button } from '~/ui';
import { Section } from './DetailsPanel';
import { leaveExternalViewer } from './externalViewer';
import type { ViewerItem } from './types';
import { say } from '~/app/notify';

const copy = (text: string, what: string) => {
  void navigator.clipboard?.writeText(text).then(
    () => say(`${what} copied`),
    () => undefined,
  );
};

const mini = (label: string, onClick: () => void, icon?: React.ReactNode) => (
  <Button size="sm" tone="card" h={26} icon={icon} onClick={onClick} style={{ fontSize: 11 }}>{label}</Button>
);

export function ExternalDetails({ item, natural }: { item: ViewerItem; natural: { w: number; h: number } | null }) {
  const steps = useSteps((s) => s.steps);
  const ext = item.external!;
  const meta = ext.meta;
  const rows = metaRows(meta);
  const resources = metaResources(meta);
  const size = { width: ext.width ?? natural?.w, height: ext.height ?? natural?.h };
  const use = (what: 'prompt' | 'settings') => { if (!meta) return; applyGenerationData(metaForStep(meta, size), what); leaveExternalViewer(); };
  const send = (id: string) => { leaveExternalViewer(); sendToStep({ url: item.url }, id); };
  const btn: React.CSSProperties = { height: 40, border: 0, borderRadius: 12, background: 'var(--il-card-on)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 12, cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!meta ? (
        <Section title="Generation data">
          <div style={{ fontSize: 12, color: 'var(--il-muted)', fontWeight: 600 }}>CivitAI has no generation data for this picture.</div>
        </Section>
      ) : (
        <>
          <Section title="Prompt" extra={meta.prompt ? mini('Copy', () => copy(meta.prompt!, 'Prompt'), <IconCopy size={12} />) : undefined}>
            <div className="il-scroll" style={{ color: 'var(--il-fg2)', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto', userSelect: 'text', touchAction: 'pan-y' }}>
              {meta.prompt || <span style={{ color: 'var(--il-dim)' }}>No prompt</span>}
            </div>
            {meta.negativePrompt && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--il-muted)', lineHeight: 1.5, userSelect: 'text', maxHeight: 90, overflowY: 'auto' }}>
                <b style={{ color: 'var(--il-fg2)' }}>Negative</b>{' · '}{meta.negativePrompt}
              </div>
            )}
          </Section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button type="button" className="il-btn" style={{ ...btn, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }} disabled={!meta.prompt} onClick={() => use('prompt')}>Use prompt</button>
            <button type="button" className="il-btn" style={btn} onClick={() => use('settings')}>Reuse settings</button>
          </div>
          {rows.length > 0 && (
            <Section title="Parameters">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
                {rows.map(([label, value]) => (
                  <button key={label} type="button" onClick={() => copy(value, label)} title={value}
                    style={{ textAlign: 'left', background: 'var(--il-card-on)', border: 0, borderRadius: 10, padding: '7px 9px', cursor: 'copy', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--il-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--il-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
          {resources.length > 0 && (
            <Section title="Resources">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {resources.map((r, i) => (
                  <div key={`${r.name}:${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0, minHeight: 26 }}>
                    <span title={r.name} style={{ flex: 1, minWidth: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    {r.type && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--il-muted)' }}>{r.type}</span>}
                    {r.weight != null && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--il-ember-hi)' }}>×{r.weight}</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
      {item.kind === 'image' && (
        <Section title="Send to">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
            {steps.map((s, i) => (
              <button key={s.id} type="button" className="il-btn" style={{ ...btn, padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => send(s.id)}>
                {i + 1} · {s.name || s.kind}
              </button>
            ))}
          </div>
        </Section>
      )}
      {(ext.source || ext.link) && (
        <Section title="Source" extra={ext.link ? <a href={ext.link} target="_blank" rel="noreferrer" style={{ color: 'var(--il-ember-hi)', fontWeight: 800, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>CivitAI <IconExternalLink size={12} /></a> : undefined}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>{ext.source ?? 'CivitAI'}</div>
        </Section>
      )}
    </div>
  );
}
