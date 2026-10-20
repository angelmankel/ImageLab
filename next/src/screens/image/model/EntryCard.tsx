/**
 * The selected entry (rule 4): picture, name, Change ▾, CivitAI ↗, On/Off, the kind's own parts
 * (trigger words, a guide image…), Strength with tap presets + slider, "More" (Remove is the × on the
 * entry's circle, `CircleRow`). ONE card for
 * every kind of every step: the api says what the entry can do (switch, weight, remove) and hands
 * in its per-kind pieces (`KindApi.card`). A pending entry (not downloaded yet) carries the strip
 * with the Download button; a missing one (named, but no server lists it) says so. The picture
 * follows "Model preview starts on" (`useModelPreview`, active: the card loads "Most popular").
 */
import { useState, type ReactNode } from 'react';
import { IconAlertTriangle, IconChevronDown, IconExternalLink } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { Switch, SliderRow } from '~/ui';
import { Thumb } from './Thumb';
import { useModelPreview } from './ModelThumb';
import { useModelMeta } from './useModelMeta';
import { metaLine } from './useModelMeta';
import { metaWithPending } from './pendingLogic';
import { PendingStrip } from './PendingStrip';
import { openModelViewer } from './viewerBridge';
import { fmtWeight, type ModelEntry } from './kindSpecs';
import type { KindApi } from './kindApi';

function ActionPill({ children, onClick, tone = 'card', title, disabled }: { children: ReactNode; onClick?: () => void; tone?: 'card' | 'ghost' | 'danger'; title?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        height: 30, padding: '0 10px', border: 0, borderRadius: 999, cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: 11,
        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', opacity: disabled ? 0.45 : 1,
        background: tone === 'card' ? 'var(--il-card-on)' : tone === 'danger' ? 'color-mix(in srgb, var(--il-err) 14%, transparent)' : 'transparent',
        color: tone === 'danger' ? 'var(--il-err)' : tone === 'card' ? 'var(--il-fg)' : 'var(--il-muted)',
      }}
    >
      {children}
    </button>
  );
}

/** The file is named but no server lists it (and nothing is downloading it). */
export function MissingStrip({ file }: { file: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: T.radius.md, background: 'var(--il-elev)', border: '1px dashed var(--il-line-strong)', fontSize: 11, fontWeight: 700, color: 'var(--il-warn)' }}>
      <IconAlertTriangle size={13} style={{ flex: 'none' }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file}>Not on this server · tap Change to pick or download one</span>
    </div>
  );
}

export function EntryCard({ entry, api, onChange }: { entry: ModelEntry; api: KindApi; onChange: () => void }) {
  const meta = metaWithPending(useModelMeta(entry.name), entry.pending);
  // The selected model, shown big: its "Most popular" list loads now, not on a hover.
  const preview = useModelPreview(meta, { active: !!entry.name });
  const [more, setMore] = useState(false);
  const { spec, card } = api;
  const pending = entry.pending;
  const dim = !!pending || !!entry.missing || !entry.on;
  const showWeight = !!spec.weight && !entry.noWeight && !(api.kind === 'checkpoint' && entry.isBase);
  const title = entry.name ? (meta.name ?? meta.label) : `No ${spec.one} yet`;
  const moreNode = card?.more?.(entry);
  const moreHint = card?.moreHint?.(entry);
  const headLabel = card?.headLabel?.(entry);
  const afterNode = card?.after?.(entry);

  return (
    <div style={{ border: `1px ${pending ? 'dashed' : 'solid'} var(--il-line-strong)`, borderRadius: T.radius.xl, background: 'var(--il-card)', padding: T.pad.card, display: 'flex', flexDirection: 'column', gap: 14, opacity: dim ? 0.8 : 1 }}>
      {headLabel && <span className="il-eyebrow" style={{ marginBottom: -8 }}>{headLabel}</span>}
      {pending && <PendingStrip record={pending} />}
      {!pending && entry.missing && <MissingStrip file={entry.name} />}
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={() => entry.name && void openModelViewer({ file: entry.name, start: preview.viewerStart })} {...preview.hover} aria-label={`Open ${title} full screen`} title="Open full screen"
          style={{ border: 0, padding: 0, background: 'transparent', cursor: entry.name ? 'pointer' : 'default', flex: 'none', borderRadius: T.radius.lg, opacity: pending || entry.missing ? 0.6 : 1 }}>
          <Thumb label={meta.label || '?'} images={preview.stills} size={88} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }} title={entry.name}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            {entry.badge && <span style={{ flex: 'none', fontSize: 9, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', borderRadius: 999, padding: '2px 7px', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }}>{entry.badge}</span>}
            {pending && <span style={{ flex: 'none', fontSize: 9, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', borderRadius: 999, padding: '2px 7px', background: 'var(--il-card-on)', color: 'var(--il-muted)' }}>not downloaded</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--il-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.name}>
            {entry.name ? <>{metaLine(meta)}{meta.name && meta.name !== meta.label ? ` · ${meta.label}` : ''}</> : 'Tap Change to pick one'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionPill onClick={onChange} title={`Pick another ${spec.one}`}>Change <IconChevronDown size={13} stroke={2.6} /></ActionPill>
            <ActionPill onClick={() => meta.civitaiUrl && window.open(meta.civitaiUrl, '_blank', 'noopener')} disabled={!meta.civitaiUrl} title={meta.civitaiUrl ? 'Open on CivitAI' : 'Not on CivitAI'}>CivitAI <IconExternalLink size={13} stroke={2.4} /></ActionPill>
            {spec.hasSwitch && (
              <span style={{ marginLeft: 'auto' }}>
                <Switch label={entry.on ? 'On' : 'Off'} checked={entry.on} onChange={(on) => api.setOn(entry.id, on)} />
              </span>
            )}
          </div>
        </div>
      </div>

      {card?.words?.(entry, meta)}
      {card?.body?.(entry)}

      {showWeight && spec.weight && (
        <SliderRow label={card?.weightLabel?.(entry) ?? spec.weight.label} value={entry.weight} min={spec.weight.min} max={spec.weight.max} step={spec.weight.step}
          presets={spec.weight.presets} format={fmtWeight} onChange={(v) => api.setWeight(entry.id, v)}
          hint={card?.weightHint?.(entry)} />
      )}

      {afterNode}

      {more && moreNode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 2 }}>{moreNode}</div>
      )}

      {moreNode && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
          <ActionPill tone="ghost" onClick={() => setMore((v) => !v)}>
            {more ? 'Less' : moreHint ? `More · ${moreHint}` : 'More'} <IconChevronDown size={13} stroke={2.6} style={{ transform: more ? 'rotate(180deg)' : undefined }} />
          </ActionPill>
        </div>
      )}
    </div>
  );
}
