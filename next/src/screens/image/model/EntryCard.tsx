/**
 * The selected entry's card (rule 4; rebuilt for fix list item 16: "more metadata, NOT
 * overloaded, show off more of the model's art and its important features"). ONE card for every
 * kind of every step — checkpoint, LoRA, embedding, ControlNet, VAE, upscaler, text encoder…:
 *
 *   [link strip (steps 2+, item 40)] [pending / missing strip]
 *   the art: three previews (ModelArt) → the model viewer on a tap
 *   name · a real node title as a badge (raw node names hidden) · On/Off
 *   file · version
 *   facts: base model · ★ rating · ↓ downloads · size          (only what is known)
 *   "Creator's samples use": steps · CFG · sampler · clip skip · a LoRA's usual strength
 *   the kind's own parts (trigger words, a guide image), the weight slider, `after`
 *   Change ▾ · CivitAI ↗ · More ▾        (Remove is the × on the entry's circle, `CircleRow`)
 *
 * The api says what the entry can do (switch, weight) and hands in its per-kind pieces
 * (`KindApi.card`). The art follows "Model preview starts on" (`useModelPreview`, active: the
 * card loads "Most popular"); the samples' settings come from CivitAI's images API (cached, one
 * request per version, shared with the Models panel).
 */
import { useMemo, useState } from 'react';
import { IconAlertTriangle, IconChevronDown, IconExternalLink, IconStarFilled, IconDownload } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { Button, Switch, SliderRow } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { useModels } from '~/screens/models/modelsStore';
import { useVersionImages } from '~/screens/models/useModelDetail';
import { fmtSizeKB } from '~/screens/models/civitaiQuery';
import { useModelPreview } from './ModelThumb';
import { useModelMeta, fmtCount, type ModelMeta } from './useModelMeta';
import { metaWithPending } from './pendingLogic';
import { PendingStrip } from './PendingStrip';
import { openModelViewer } from './viewerBridge';
import { fmtWeight, type ModelEntry } from './kindSpecs';
import type { KindApi } from './kindApi';
import { displayBadge } from './followLogic';
import { fmtNum, hasRecommended, recommendFrom, type Recommended } from './cardFacts';
import { ModelArt } from './ModelArt';

/** The file is named but no server lists it (and nothing is downloading it). */
export function MissingStrip({ file }: { file: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: T.radius.md, background: 'var(--il-elev)', border: '1px dashed var(--il-line-strong)', fontSize: 11, fontWeight: 700, color: 'var(--il-warn)' }}>
      <IconAlertTriangle size={13} style={{ flex: 'none' }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file}>Not on this server · tap Change to pick or download one</span>
    </div>
  );
}

export function EntryCard({ entry, api, onChange, link }: { entry: ModelEntry; api: KindApi; onChange: () => void; link?: React.ReactNode }) {
  const phone = useIsPhone();
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
  // A raw node name ("Load Checkpoint") says nothing: hidden (items 39 / 40).
  const badge = displayBadge(entry.badge, api.kind, Math.max(0, api.entries.findIndex((e) => e.id === entry.id)), api.entries.length);
  const rec = useRecommended(entry.name ? meta.versionId ?? pending?.versionId : undefined, api.kind);
  const sub = [entry.name ? meta.label : '', meta.versionName].filter(Boolean).join(' · ');

  return (
    <div style={{ border: `1px ${pending ? 'dashed' : 'solid'} var(--il-line-strong)`, borderRadius: T.radius.xl, background: 'var(--il-card)', padding: T.pad.card, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {link}
      {headLabel && <span className="il-eyebrow">{headLabel}</span>}
      {pending && <PendingStrip record={pending} />}
      {!pending && entry.missing && <MissingStrip file={entry.name} />}

      <div style={{ opacity: pending || entry.missing ? 0.6 : entry.on ? 1 : 0.75 }}>
        <ModelArt pictures={preview.pictures} label={meta.label || title} height={phone ? 190 : 168} rootRef={preview.observe} onPointerEnter={preview.hover.onPointerEnter}
          onOpen={(p) => entry.name && void openModelViewer({ file: entry.name, start: p.start ?? preview.viewerStart })} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: dim ? 'var(--il-fg2)' : 'var(--il-fg)' }} title={entry.name}>{title}</span>
            {badge && <span style={{ flex: 'none', fontSize: 9, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', borderRadius: 999, padding: '2px 7px', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badge}</span>}
          </div>
          {sub && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.name}>{sub}</div>}
        </div>
        {spec.hasSwitch && <span style={{ flex: 'none' }}><Switch label={entry.on ? 'On' : 'Off'} checked={entry.on} onChange={(on) => api.setOn(entry.id, on)} /></span>}
      </div>

      {entry.name && <Facts meta={meta} />}
      {hasRecommended(rec) && <SamplesUse rec={rec} kind={api.kind} />}

      {card?.words?.(entry, meta)}
      {card?.body?.(entry)}

      {showWeight && spec.weight && (
        <SliderRow label={card?.weightLabel?.(entry) ?? spec.weight.label} value={entry.weight} min={spec.weight.min} max={spec.weight.max} step={spec.weight.step}
          presets={spec.weight.presets} format={fmtWeight} onChange={(v) => api.setWeight(entry.id, v)}
          hint={card?.weightHint?.(entry)} />
      )}

      {afterNode}

      {more && moreNode && <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 2 }}>{moreNode}</div>}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button tone="card" size={phone ? 'lg' : 'sm'} caret={<IconChevronDown size={13} stroke={2.6} />} onClick={onChange} tooltip={`Pick another ${spec.one}`}>Change</Button>
        <Button tone="card" size={phone ? 'lg' : 'sm'} caret={<IconExternalLink size={13} stroke={2.4} />} disabled={!meta.civitaiUrl} onClick={() => meta.civitaiUrl && window.open(meta.civitaiUrl, '_blank', 'noopener')} tooltip={meta.civitaiUrl ? 'Open on CivitAI' : 'Not on CivitAI'}>CivitAI</Button>
        {moreNode && (
          <Button tone="ghost" size={phone ? 'lg' : 'sm'} on={more} caret={<IconChevronDown size={13} stroke={2.6} style={{ transform: more ? 'rotate(180deg)' : undefined }} />} onClick={() => setMore((v) => !v)}
            style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {more ? 'Less' : moreHint ? `More · ${moreHint}` : 'More'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Base model · rating · downloads · size — whatever is known; "Looking up…" / "Not on CivitAI" otherwise. */
function Facts({ meta }: { meta: ModelMeta }) {
  const base = meta.baseModel ? (meta.bucket === 'Other' || meta.bucket === 'Unknown' ? meta.baseModel : meta.bucket) : '';
  const size = fmtSizeKB(meta.sizeKB);
  const chip: React.CSSProperties = { height: 24, padding: '0 9px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg2)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' };
  const parts = [
    base && <span key="b" style={{ ...chip, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }} title="Base model">{base}</span>,
    meta.rating ? <span key="r" style={chip} title="Rating"><IconStarFilled size={10} />{meta.rating.toFixed(1)}</span> : null,
    meta.downloads ? <span key="d" style={chip} title="Downloads"><IconDownload size={11} stroke={2.4} />{fmtCount(meta.downloads)}</span> : null,
    size && <span key="s" style={chip} title="File size">{size}</span>,
  ].filter(Boolean);
  if (!parts.length) return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{meta.resolved ? 'Not on CivitAI' : 'Looking up…'}</span>;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{parts}</div>;
}

/** The settings the version's sample images were made with. */
function SamplesUse({ rec, kind }: { rec: Recommended; kind: string }) {
  const items: Array<[string, string]> = [];
  if (rec.strength != null && kind !== 'checkpoint') items.push(['Strength', `≈ ${fmtNum(rec.strength)}`]);
  if (rec.steps != null) items.push(['Steps', String(rec.steps)]);
  if (rec.cfg != null) items.push(['CFG', fmtNum(rec.cfg)]);
  if (rec.sampler) items.push(['Sampler', rec.sampler]);
  if (rec.clipSkip != null) items.push(['Clip skip', String(rec.clipSkip)]);
  return (
    <div title={`The typical settings of ${rec.from} sample image${rec.from === 1 ? '' : 's'} on CivitAI`}
      style={{ background: 'var(--il-elev)', borderRadius: T.radius.md, padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span className="il-eyebrow">Creator's samples use</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
        {items.map(([k, v]) => (
          <span key={k} style={{ minWidth: 0, maxWidth: '100%' }}>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--il-muted)' }}>{k}</span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Creator's samples use", from the version's sample images (the images API, cached per version). */
function useRecommended(versionId: number | undefined, kind: string): Recommended {
  const mask = useModels((s) => s.filters.nsfwMask);
  const { items } = useVersionImages(versionId ?? null, mask, undefined);
  return useMemo(() => recommendFrom(items.map((i) => i.meta), kind === 'checkpoint' ? null : versionId), [items, versionId, kind]);
}
