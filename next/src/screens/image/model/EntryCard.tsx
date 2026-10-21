/**
 * The selected entry's card (rule 4) — rebuilt for fix list 2 item 33 ("one image that is 1:1 …
 * this component needs to be simpler"; mockup `agent-handoffs/fixlist2-mockups/33-model-card.html`,
 * option A). ONE card for every kind of every step — checkpoint, LoRA, embedding, ControlNet, VAE,
 * upscaler, text encoder…:
 *
 *   [link strip (steps 2+)] [pending / missing strip]
 *   ┌────────┐ name (tap → model details)              On
 *   │  1:1   │ version · kind
 *   │ picture│ base model chip
 *   └────────┘ (tap → the full-screen viewer, all the model's pictures)
 *   the ONE weight slider
 *   the kind's own parts: trigger words (LoRA / checkpoint), a guide image (ControlNet), `after`
 *   Recommended settings · Apply
 *   More ▾ (quiet fold): the kind's extras (prompt side, CLIP strength, VAE…), Details, CivitAI
 * "⇄ Change" is a visible button under the chips, never folded (fix list 2, added item).
 *
 * Behind it all, the model's other pictures as a soft blurred texture (low contrast, under a shade
 * of the card colour). Dropped from the card on purpose (Donny: "i dont care about the filename"):
 * file name, size, downloads, rating, hashes — they live in the model viewer (item 29).
 * The art follows "Model preview starts on" and the NSFW opt-in (`useModelPreview`).
 */
import { useMemo } from 'react';
import { IconAlertTriangle, IconArrowsExchange, IconArrowsMaximize, IconExternalLink, IconInfoCircle } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { Button, LoadingImage, Switch, SliderRow } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';
import { useModels } from '~/screens/models/modelsStore';
import { useVersionImages } from '~/screens/models/useModelDetail';
import { useNsfwCover } from '~/screens/models/nsfwCover';
import { Fold } from '~/screens/modelViewer/metaBits';
import { openExternalViewer } from '~/screens/viewer/externalViewer';
import { civitaiThumbUrl, civitaiVideoUrl, isCivitaiVideo, previewStill, type CivitaiImage } from '@/lib/civitai';
import { imageKey } from '@/lib/previewOrder';
import { useModelPreview } from './ModelThumb';
import { useModelMeta, smallThumb } from './useModelMeta';
import { metaWithPending } from './pendingLogic';
import { PendingStrip } from './PendingStrip';
import { openModelViewer } from './viewerBridge';
import { fmtWeight, type ModelEntry } from './kindSpecs';
import type { KindApi } from './kindApi';
import { displayBadge } from './followLogic';
import { hasRecommended, recommendFrom, type Recommended } from './cardFacts';
import { RecommendedRow } from './RecommendedRow';
import { hashLabel, useHashProgress, useHashState } from './useHashState';
import { initials } from './Thumb';
import '~/screens/models/models.css';

/** The file is named but no server lists it (and nothing is downloading it). */
export function MissingStrip({ file }: { file: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: T.radius.md, background: 'var(--il-elev)', border: '1px dashed var(--il-line-strong)', fontSize: 11, fontWeight: 700, color: 'var(--il-warn)' }}>
      <IconAlertTriangle size={13} style={{ flex: 'none' }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file}>Not on this server · tap Change to pick or download one</span>
    </div>
  );
}

const KIND_WORD: Record<string, string> = { checkpoint: 'Checkpoint', lora: 'LoRA', embedding: 'Embedding', controlnet: 'ControlNet', vae: 'VAE', clip: 'Text encoder', upscale: 'Upscaler', other: 'Model' };
const FULL_W = 2048;

export function EntryCard({ entry, api, onChange, link }: { entry: ModelEntry; api: KindApi; onChange: () => void; link?: React.ReactNode }) {
  const phone = useIsPhone();
  const meta = metaWithPending(useModelMeta(entry.name), entry.pending);
  // The selected model, shown big: its "Most popular" list loads now, not on a hover.
  const preview = useModelPreview(meta, { active: !!entry.name });
  const { spec, card } = api;
  const pending = entry.pending;
  const dim = !!pending || !!entry.missing || !entry.on;
  const showWeight = !!spec.weight && !entry.noWeight && !(api.kind === 'checkpoint' && entry.isBase);
  const title = entry.name ? (meta.name ?? meta.label) : `No ${spec.one} yet`;
  const moreNode = card?.more?.(entry, meta);
  const headLabel = card?.headLabel?.(entry);
  const afterNode = card?.after?.(entry);
  const badge = displayBadge(entry.badge, api.kind, Math.max(0, api.entries.findIndex((e) => e.id === entry.id)), api.entries.length);
  const versionId = entry.name ? meta.versionId ?? pending?.versionId : undefined;
  const { rec, gallery } = useRecommended(versionId, api.kind);
  const base = meta.baseModel ? (meta.bucket === 'Other' || meta.bucket === 'Unknown' ? meta.baseModel : meta.bucket) : '';
  const sub = [meta.versionName, KIND_WORD[api.kind] ?? spec.one].filter(Boolean).join(' · ');
  const hero = preview.pictures[0];
  const texture = preview.pictures.slice(1, 5);
  const covered = useNsfwCover();
  const heroSize = phone ? 116 : 104;
  // ImageLabCore 825f446: a file the node is still hashing says so instead of "unknown".
  const hashing = useHashState(entry.name && !meta.baseModel ? entry.name : null);
  const hashProgress = useHashProgress();

  // The picture → the full-screen viewer over all the version's pictures (with their generation
  // data when the images API has them), starting on the shown one (item 31 / 33).
  const openFull = () => {
    if (!hero) return;
    const list: CivitaiImage[] = gallery.length ? gallery : preview.pictures.map((p) => ({ url: p.url, width: 0, height: 0, nsfwLevel: 0, meta: null }));
    const k = imageKey(hero.start?.url ?? hero.url);
    const at = Math.max(0, list.findIndex((i) => imageKey(i.url) === k));
    const images = list.map((img) => {
      const video = isCivitaiVideo(img);
      const id = (img as { id?: number }).id;
      return {
        url: video ? civitaiVideoUrl(img.url, FULL_W) : civitaiThumbUrl(previewStill(img, FULL_W), FULL_W), key: img.url, kind: video ? 'video' as const : 'image' as const,
        width: img.width || undefined, height: img.height || undefined, meta: img.meta, nsfw: covered(img.nsfwLevel), link: id ? `https://civitai.com/images/${id}` : undefined,
      };
    });
    openExternalViewer({ images, index: at, source: title, onLeave: () => {} });
  };
  const details = () => entry.name && void openModelViewer({ file: entry.name, start: preview.viewerStart });
  const drag = useImageDrag(() => (hero && !/\.(mp4|webm)(\?|$)/i.test(hero.url) ? makePayload({ url: hero.url, name: nameFromUrl(hero.url) || `${title}.png`, source: 'model' }) : null));
  const weightTarget = showWeight && api.kind !== 'checkpoint' ? { value: entry.weight, set: (v: number) => api.setWeight(entry.id, v) } : undefined;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', border: `1px ${pending ? 'dashed' : 'solid'} var(--il-line-strong)`, borderRadius: T.radius.xl, background: 'var(--il-card)', minWidth: 0, isolation: 'isolate' }}>
      {texture.length > 0 && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', inset: -24, display: 'grid', gridTemplateColumns: `repeat(${Math.min(texture.length, 4)}, 1fr)`, filter: 'blur(22px) saturate(1.15)', opacity: 0.32 }}>
            {texture.map((p, i) => <img key={p.url + i} src={smallThumb(p.url, 60)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, color-mix(in srgb, var(--il-card) 35%, transparent), var(--il-card) 78%)' }} />
        </div>
      )}
      <div style={{ padding: T.pad.card, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {link}
        {headLabel && <span className="il-eyebrow">{headLabel}</span>}
        {pending && <PendingStrip record={pending} />}
        {!pending && entry.missing && <MissingStrip file={entry.name} />}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <button type="button" className="ilm-art" onClick={openFull} disabled={!hero} aria-label={`Open ${title}'s pictures full screen`} {...drag}
            ref={preview.observe} onPointerEnter={preview.hover.onPointerEnter}
            style={{ position: 'relative', width: heroSize, height: heroSize, flex: 'none', padding: 0, border: 0, borderRadius: T.radius.lg, overflow: 'hidden', cursor: hero ? 'zoom-in' : 'default',
              background: 'var(--il-elev)', boxShadow: '0 6px 18px rgba(0,0,0,.28)', opacity: pending || entry.missing ? 0.6 : entry.on ? 1 : 0.75, display: 'grid', placeItems: 'center', color: 'var(--il-fg)', fontWeight: 800, fontSize: 26 }}>
            {hero
              ? <LoadingImage src={smallThumb(hero.url, heroSize)} thumb={smallThumb(hero.url, 16)} loading="eager" draggable={false} style={{ position: 'absolute', inset: 0, height: '100%' }} />
              : initials(meta.label || title)}
            {hero && (
              <span aria-hidden style={{ position: 'absolute', right: 5, bottom: 5, width: 22, height: 22, borderRadius: '50%', background: 'color-mix(in srgb, var(--il-bg) 70%, transparent)', display: 'grid', placeItems: 'center' }}>
                <IconArrowsMaximize size={11} stroke={2.4} />
              </span>
            )}
          </button>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
              <button type="button" onClick={details} disabled={!entry.name} title="Model details"
                style={{ flex: 1, minWidth: 0, padding: 0, border: 0, background: 'transparent', textAlign: 'left', cursor: entry.name ? 'pointer' : 'default', color: dim ? 'var(--il-fg2)' : 'var(--il-fg)',
                  fontSize: 15, fontWeight: 800, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                {title}
              </button>
              {spec.hasSwitch && <span style={{ flex: 'none' }}><Switch label={entry.on ? 'On' : 'Off'} checked={entry.on} onChange={(on) => api.setOn(entry.id, on)} /></span>}
            </div>
            {entry.name && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {base && <Chip ember>{base}</Chip>}
              {badge && <Chip>{badge}</Chip>}
              {entry.name && !base && <span style={{ fontSize: 11, fontWeight: 600, color: hashing === 'error' ? 'var(--il-warn)' : 'var(--il-muted)' }}>
                {hashing ? hashLabel(hashing) : meta.resolved ? 'Not on CivitAI' : hashProgress && !hashProgress.ready ? 'Checking models…' : 'Looking up…'}
              </span>}
            </div>
            <Button tone="card" size={phone ? 'lg' : 'sm'} icon={<IconArrowsExchange size={14} stroke={2.4} />} onClick={onChange} tooltip={`Pick another ${spec.one}`}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}>{entry.name ? 'Change' : `Pick a ${spec.one}`}</Button>
          </div>
        </div>

        {showWeight && spec.weight && (
          <SliderRow id={api.kind === 'lora' ? 'lora.strength' : api.kind === 'controlnet' ? 'controlnet.strength' : `${api.kind}.weight`} label={card?.weightLabel?.(entry) ?? spec.weight.label} value={entry.weight} min={spec.weight.min} max={spec.weight.max} step={spec.weight.step}
            presets={spec.weight.presets} format={fmtWeight} defaultValue={spec.weight.default} onChange={(v) => api.setWeight(entry.id, v)}
            hint={card?.weightHint?.(entry)} />
        )}

        {card?.words?.(entry, meta)}
        {card?.body?.(entry)}
        {afterNode}

        {hasRecommended(rec) && <RecommendedRow rec={rec} withStrength={api.kind !== 'checkpoint'} weight={weightTarget} />}

        <Fold id={`card.more.${api.kind}`} title="More" summary={card?.moreHint?.(entry) ?? 'Details, CivitAI'}>
          {moreNode && <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 10 }}>{moreNode}</div>}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button tone="card" size={phone ? 'lg' : 'sm'} caret={<IconInfoCircle size={13} stroke={2.4} />} disabled={!entry.name} onClick={details} tooltip="Model details">Details</Button>
            <Button tone="card" size={phone ? 'lg' : 'sm'} caret={<IconExternalLink size={13} stroke={2.4} />} disabled={!meta.civitaiUrl} onClick={() => meta.civitaiUrl && window.open(meta.civitaiUrl, '_blank', 'noopener')} tooltip={meta.civitaiUrl ? 'Open on CivitAI' : 'Not on CivitAI'}>CivitAI</Button>
          </div>
        </Fold>
      </div>
    </div>
  );
}

function Chip({ children, ember }: { children: React.ReactNode; ember?: boolean }) {
  return (
    <span style={{ height: 22, padding: '0 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '.2px', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
      background: ember ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: ember ? 'var(--il-ember-hi)' : 'var(--il-fg2)' }}>{children}</span>
  );
}

/** "Recommended settings", from the version's pictures (the images API, cached per version), and those pictures. */
function useRecommended(versionId: number | undefined, kind: string): { rec: Recommended; gallery: CivitaiImage[] } {
  const mask = useModels((s) => s.filters.nsfwMask);
  const { items } = useVersionImages(versionId ?? null, mask, undefined);
  const rec = useMemo(() => recommendFrom(items.map((i) => i.meta), kind === 'checkpoint' ? null : versionId), [items, versionId, kind]);
  return { rec, gallery: items };
}

