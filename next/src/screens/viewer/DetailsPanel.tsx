/**
 * Item 30, the Details tab: the picture's metadata, clean and in cards. Prompt (copy · use) with
 * the negative folded under it; Models (checkpoints with merge ratios, LoRAs with a strength bar,
 * embeddings, VAE, model type); Parameters as a tile grid (only the ones that apply; seed copies);
 * Made by (the step chain captured when it was made, the made-by step lit; a Remove BG cut-out
 * names its source); File (created, took, server, real size, path, prompt id). Reads
 * `describeEntry` (metaLogic, tested); a run result without a history entry shows File + chain.
 */
import { useState, type ReactNode } from 'react';
import { IconCopy } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { reuseSettingsFrom, usePromptFrom, recallFrom } from '~/app/actions';
import { Button } from '~/ui';
import { formatDateTime } from '~/lib/time';
import { describeEntry, formatDuration } from './metaLogic';
import { useResultMeta } from './resultMeta';
import type { ViewerItem } from './types';
import { say } from '~/app/notify';

const copy = (text: string, what: string) => {
  void navigator.clipboard?.writeText(text).then(
    () => say(`${what} copied`),
    () => undefined,
  );
};

export function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ background: 'var(--il-card)', borderRadius: 14, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, minHeight: 26 }}>
        <span className="il-eyebrow" style={{ flex: 1 }}>{title}</span>
        {extra}
      </div>
      {children}
    </section>
  );
}

const mini = (label: string, onClick: () => void, icon?: ReactNode) => (
  <Button size="sm" tone="card" h={26} icon={icon} onClick={onClick} style={{ fontSize: 11 }}>{label}</Button>
);

function Prompt({ text, negative, onUse }: { text: string; negative: string; onUse?: () => void }) {
  const [open, setOpen] = useState(false);
  const [negOpen, setNegOpen] = useState(false);
  const long = text.length > 220;
  return (
    <Section title="Prompt" extra={<>{text && mini('Copy', () => copy(text, 'Prompt'), <IconCopy size={12} />)}{onUse && mini('Use', onUse)}</>}>
      <div style={{ color: 'var(--il-fg2)', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: open || !long ? undefined : 82, overflow: 'hidden', userSelect: 'text' }}>
        {text || <span style={{ color: 'var(--il-dim)' }}>No prompt saved</span>}
      </div>
      {long && <button type="button" onClick={() => setOpen(!open)} style={linkBtn}>{open ? 'Less' : 'More'}</button>}
      {negative && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--il-muted)', lineHeight: 1.5, userSelect: 'text' }}>
          <b style={{ color: 'var(--il-fg2)' }}>Negative</b>{' · '}
          {negOpen || negative.length <= 90 ? negative : `${negative.slice(0, 90)}…`}
          {negative.length > 90 && <button type="button" onClick={() => setNegOpen(!negOpen)} style={{ ...linkBtn, marginLeft: 6 }}>{negOpen ? 'less' : 'more'}</button>}
        </div>
      )}
    </Section>
  );
}

const linkBtn: React.CSSProperties = { background: 'none', border: 0, padding: '4px 0', color: 'var(--il-ember-hi)', fontWeight: 800, fontSize: 11, cursor: 'pointer' };

function ModelLine({ name, role, file, strength }: { name: string; role: string; file: string; strength?: number }) {
  return (
    <div title={file} style={{ display: 'grid', gridTemplateColumns: strength != null ? '1fr 64px 34px' : '1fr', gap: 8, alignItems: 'center', minHeight: 30 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--il-muted)' }}>{role}</div>
      </div>
      {strength != null && <>
        <div style={{ height: 4, borderRadius: 9, background: 'var(--il-line-strong)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (Math.abs(strength) / 2) * 100))}%`, background: 'var(--il-ember)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--il-fg2)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{strength.toFixed(2)}</span>
      </>}
    </div>
  );
}

function Chain({ item }: { item: ViewerItem }) {
  const snap = useResultMeta((s) => s.chains[item.key]);
  const history = useStore((s) => s.history);
  const from = item.entry?.derivedFrom;
  const source = from ? history.find((h) => h.id === from.id) : null;
  if (!snap && !from) return null;
  const node = (label: string, on: boolean, key: string) => (
    <span key={key} style={{ height: 28, padding: '0 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 800, background: on ? 'var(--il-ember-soft)' : 'var(--il-card-on)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
  );
  const arrow = (k: string) => <span key={k} style={{ color: 'var(--il-dim)', fontWeight: 800 }}>→</span>;
  const parts: ReactNode[] = [];
  if (from) {
    parts.push(node(source?.filename ?? 'the original', false, 'src'), arrow('a-src'), node(from.op === 'removebg' ? 'Remove BG' : from.op, true, 'op'));
  } else if (snap) {
    snap.steps.forEach((s, i) => { if (i) parts.push(arrow(`a${i}`)); parts.push(node(`${i + 1} · ${s.name}`, i === snap.made, s.id)); });
  }
  return (
    <Section title="Made by" extra={snap?.session ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{snap.session}</span> : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{parts}</div>
    </Section>
  );
}

export function DetailsPanel({ item, natural }: { item: ViewerItem; natural: { w: number; h: number } | null }) {
  const servers = useStore((s) => s.servers);
  const e = item.entry ?? null;
  const meta = e ? describeEntry(e) : null;
  const server = e ? servers.find((s) => s.id === e.serverId)?.name : null;
  const took = formatDuration(item.durationMs ?? e?.durationMs);
  const created = item.createdAt ?? e?.createdAt;
  const rows: Array<[string, string]> = [];
  if (created) rows.push(['Created', formatDateTime(created)]);
  if (took) rows.push(['Took', took]);
  if (server) rows.push(['Server', server]);
  if (natural) rows.push(['Pixels', `${natural.w} × ${natural.h}`]);
  rows.push(['File', e ? (e.subfolder ? `${e.subfolder}/${e.filename}` : e.filename) : item.filename]);
  if (e?.promptId) rows.push(['Prompt id', e.promptId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {meta && <Prompt text={meta.prompt} negative={meta.negative} onUse={meta.prompt ? () => usePromptFrom(e!) : undefined} />}
      {meta && (meta.checkpoints.length > 0 || meta.loras.length > 0) && (
        <Section title="Models" extra={meta.modelType ? <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--il-ember-hi)', background: 'var(--il-ember-soft)', borderRadius: 999, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{meta.modelType}</span> : undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meta.checkpoints.map((m) => <ModelLine key={`c${m.file}`} {...m} />)}
            {meta.loras.map((m) => <ModelLine key={`l${m.file}`} {...m} />)}
            {meta.embeddings.map((m) => <ModelLine key={`e${m.file}`} {...m} strength={undefined} />)}
            {meta.vae && <ModelLine name={meta.vae} role="VAE" file={meta.vae} />}
          </div>
        </Section>
      )}
      {meta && (
        <Section title="Parameters" extra={<>{mini('Use settings', () => reuseSettingsFrom(e!))}{mini('Recall all', () => recallFrom(e!))}</>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
            {meta.params.map((p) => (
              <button key={p.label} type="button" onClick={() => copy(p.value, p.label)} title={`Copy ${p.label.toLowerCase()}`}
                style={{ textAlign: 'left', background: 'var(--il-card-on)', border: 0, borderRadius: 10, padding: '7px 9px', cursor: 'copy', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--il-muted)' }}>{p.label}</span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: p.mono ? 'ui-monospace, monospace' : undefined }}>{p.value}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      <Chain item={item} />
      <Section title="File">
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 6, columnGap: 8, fontSize: 11 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <span style={{ color: 'var(--il-muted)', fontWeight: 700 }}>{k}</span>
              <span title={v} style={{ color: 'var(--il-fg2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' }}>{v}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
