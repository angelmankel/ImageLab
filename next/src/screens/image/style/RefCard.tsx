/**
 * Style tab: the selected reference's card (mockup style-tab.html B). One click on a type tile
 * gives a working reference with the packs' own defaults (lib/styleRefs `newStyleRef` /
 * `methodDefaults`); the only thing it needs is a picture. Top to bottom:
 *
 *   type icon · name · one line                                    On
 *   [Face only] FaceID v2 · Portrait · InstantID · PuLID   (those the family and a server can run)
 *   the picture (THE drop zone: drop · paste · upload · library), more pictures as small tiles
 *   Strength (with the automatic stacking scale shown when it applies)
 *   [style / composition / subject] how it applies (weight type)
 *   a note when a server lacks something, or the step needs a setting (InstantID: CFG 4.5)
 *   ▸ More: which model it uses (auto / override), when it applies (start / end), the type's extras
 */
import { useMemo, useState } from 'react';
import { IconAlertTriangle, IconInfoCircle, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import {
  COMBINE, FACE_INFO, TYPE_INFO, WEIGHT_TYPES, activeRefs, newStyleRef, faceMethodsFor, featureOf, methodDefaults, methodOf, modelChoices, pickModel,
  refMissing, samplerAdvice, stackFactor, type FaceMethod, type StyleFamily, type StyleRef, type StyleRefImage,
} from '@/lib/styleRefs';
import { ImageDropZone, Seg } from '~/compose';
import { Collapse, SearchSelect, SliderRow, Switch } from '~/ui';
import { notifyError } from '~/app/notify';
import type { StyleBinding } from './styleBinding';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { TypeIcon } from './typeIcons';
import { refLabel } from './RefBubbles';
import { storeRefImage, useRefImageStored, useRefImageUrl } from './refImages';
import { replaceRef } from './styleRefsEdit';

const fmt2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Note({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const Icon = tone === 'warn' ? IconAlertTriangle : IconInfoCircle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: T.radius.md, background: 'var(--il-elev)', border: `1px ${tone === 'warn' ? 'dashed' : 'solid'} var(--il-line-strong)`, fontSize: 11, fontWeight: 700, color: tone === 'warn' ? 'var(--il-warn)' : 'var(--il-fg2)' }}>
      <Icon size={13} style={{ flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</span>
    </div>
  );
}

/** The first picture, in the shared drop zone. */
function MainPicture({ img, onBlob, onClear, label }: { img: StyleRefImage | null; onBlob: (b: Blob, name: string) => Promise<void>; onClear: () => void; label: string }) {
  const url = useRefImageUrl(img);
  return (
    <ImageDropZone url={url} name={img?.name} dims={img ? { width: img.width, height: img.height } : null}
      onBlob={(b) => onBlob(b.blob, b.name)} onClear={img ? onClear : undefined} emptyTitle="Drop the reference picture" label={label}
      pasteAnywhere={!img} target={{ id: 'style-reference', label: 'Style reference', order: 60 }} />
  );
}

function ExtraPicture({ img, onRemove }: { img: StyleRefImage; onRemove: () => void }) {
  const url = useRefImageUrl(img);
  return (
    <div style={{ position: 'relative', width: 64, height: 64, flex: 'none', borderRadius: T.radius.sm, overflow: 'hidden', background: 'var(--il-elev)' }}>
      {url && <img src={url} alt={img.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <button type="button" onClick={onRemove} aria-label="Remove picture" title="Remove"
        style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, padding: 0, border: 0, borderRadius: '50%', background: 'rgba(10,10,12,.7)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <IconX size={11} stroke={3} />
      </button>
    </div>
  );
}

export function RefCard({ r, fam, binding }: { r: StyleRef; fam: StyleFamily; binding: StyleBinding }) {
  const { refs, cfg, where } = binding;
  const phone = useIsPhone();
  const servers = useStore((s) => s.servers);
  const infos = useStore((s) => s.serverInfo);
  const [moreOpen, setMoreOpen] = useState(false);
  const stored = useRefImageStored(r.images[0]?.key);

  const update = (patch: Partial<StyleRef>, label?: string, lowerCfg?: number) =>
    binding.setRefs(replaceRef(refs, r.id, patch), label ?? `${refLabel(r)} reference`, lowerCfg);

  // Per online server: can it run this reference as set?
  const online = useMemo(() => servers.filter((s) => s.enabled !== false && infos[s.id]), [servers, infos]);
  const missingOn = (ref: Pick<StyleRef, 'type' | 'method' | 'model'>) => online.map((s) => ({
    name: s.name, missing: refMissing(ref, fam, infos[s.id]?.style, { loras: infos[s.id]?.loras, controlnets: infos[s.id]?.controlnets }),
  }));
  const here = missingOn(r);
  const runs = here.filter((x) => !x.missing.length);
  const firstInfo = online.map((s) => infos[s.id]).find((i) => i?.style);
  const picked = pickModel(r, fam, firstInfo?.style);
  const choices = useMemo(() => {
    const set = new Set<string>();
    for (const s of online) for (const f of modelChoices(r, fam, infos[s.id]?.style)) set.add(f);
    return [...set];
  }, [online, infos, r, fam]);

  const methods = faceMethodsFor(fam).filter((m) => missingOn({ type: 'face', method: m }).some((x) => !x.missing.length) || m === methodOf(r));
  const method = methodOf(r);
  const feature = featureOf(r);
  const active = activeRefs(refs, fam);
  const k = stackFactor(r, active);
  const advice = samplerAdvice(r);
  const multi = TYPE_INFO[r.type].multi;

  const addPicture = async (blob: Blob, name: string, replaceFirst: boolean) => {
    try {
      const img = await storeRefImage(blob, name);
      const images = replaceFirst ? [img, ...r.images.slice(1)] : [...r.images.filter((x) => x.key !== img.key), img];
      update({ images }, 'Reference picture');
    } catch (err) {
      notifyError('Could not use that picture', err);
    }
  };

  const setMethod = (m: FaceMethod) => {
    if (m === method) return;
    const a = samplerAdvice({ type: 'face', method: m });
    // InstantID burns at a high CFG: lower the step's CFG with the switch (one undo), and say so on the card.
    const lower = a?.cfgMax != null && cfg > a.cfgMax ? a.cfg : undefined;
    update({ method: m, model: '', ...methodDefaults(m, where) }, FACE_INFO[m].title, lower);
  };

  const weightTypes = r.type === 'style' || r.type === 'composition' || r.type === 'subject' ? WEIGHT_TYPES[r.type] : null;
  const typeTitle = refLabel(r);

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: T.radius.xl, border: '1px solid var(--il-line-soft)', padding: 10, display: 'flex', flexDirection: 'column', gap: 10, flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }}><TypeIcon type={r.type} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{TYPE_INFO[r.type].title}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{TYPE_INFO[r.type].line}</div>
        </div>
        <Switch label="On" checked={r.on} onChange={(on) => update({ on }, on ? `Turn on ${typeTitle}` : `Turn off ${typeTitle}`)} />
      </div>

      {r.type === 'face' && methods.length > 1 && (
        <Seg<FaceMethod> label="Face method" value={method} onChange={setMethod}
          items={methods.map((m) => ({ key: m, label: FACE_INFO[m].title }))} />
      )}

      <MainPicture img={r.images[0] ?? null} label={r.images.length > 1 ? `Pictures · ${r.images.length}` : 'Picture'}
        onBlob={(b, n) => addPicture(b, n, true)} onClear={() => update({ images: r.images.slice(1) }, 'Remove picture')} />
      {stored === false && <Note tone="warn">This picture is not in this browser any more: drop it again.</Note>}
      {multi && r.images.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {r.images.slice(1).map((img, i) => (
            <ExtraPicture key={img.key} img={img} onRemove={() => update({ images: r.images.filter((_, j) => j !== i + 1) }, 'Remove picture')} />
          ))}
          <div style={{ width: phone ? '100%' : 150 }}>
            <ImageDropZone url={null} small emptyTitle="Add a picture" onBlob={(b) => addPicture(b.blob, b.name, false)} />
          </div>
        </div>
      )}

      <SliderRow label="Strength" value={r.weight} min={0} max={feature === 'redux' ? 2 : 1.5} step={0.05} format={fmt2}
        defaultValue={(method ? methodDefaults(method, where).weight : undefined) ?? newStyleRef(r.id, r.type, fam, where).weight}
        hint={feature === 'redux' ? '← a hint · all of it →' : '← faint · strong →'} onChange={(weight) => update({ weight }, 'Strength')} />
      {k !== 1 && <Note tone="info">Runs at {fmt2(r.weight * k)} with the other references</Note>}

      {weightTypes && (
        <Seg<string> label="How it applies" value={r.weightType ?? weightTypes[0].value} onChange={(weightType) => update({ weightType }, 'How it applies')}
          items={weightTypes.map((w) => ({ key: w.value, label: w.label }))} />
      )}
      {r.type === 'face' && method === 'pulid' && (
        <Seg<'fidelity' | 'style' | 'neutral'> label="PuLID method" value={r.pulidMethod ?? 'fidelity'} onChange={(pulidMethod) => update({ pulidMethod }, 'PuLID method')}
          items={[{ key: 'fidelity', label: 'Likeness' }, { key: 'style', label: 'Freer' }, { key: 'neutral', label: 'Neutral' }]} />
      )}

      {!r.images.length && <Note tone="info">Add a picture to use it</Note>}
      {online.length > 0 && !runs.length && (
        <Note tone="warn">Needs {here[0].missing[0]?.replace(/\s*\(.*\)$/, '')} on {online.length > 1 ? 'any server' : here[0].name}</Note>
      )}
      {runs.length > 0 && runs.length < online.length && <Note tone="info">Runs on {runs.map((x) => x.name).join(', ')} only</Note>}
      {advice && r.on && (
        cfg > (advice.cfgMax ?? Infinity)
          ? binding.setCfg
            ? <Note tone="warn">CFG {cfg} is high for InstantID
                <button type="button" onClick={() => binding.setCfg!(advice.cfg!)}
                  style={{ border: 0, borderRadius: 999, padding: '4px 10px', minHeight: phone ? 36 : 24, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Use {advice.cfg}</button>
              </Note>
            : <Note tone="info">The refine pass runs at CFG {advice.cfg} for InstantID</Note>
          : <Note tone="info">CFG {cfg} for InstantID (best at 4–5)</Note>
      )}

      <Collapse label="More" open={moreOpen} onOpenChange={setMoreOpen}
        preview={`${picked ? picked.replace(/\.(safetensors|bin|pth?)$/i, '').replace(/^.*[\\/]/, '') : 'no model'}${r.model ? '' : ' · auto'}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', flex: 'none' }}>Model</span>
            <SearchSelect label="Model" value={r.model || ''} searchable={choices.length > 8}
              options={[{ value: '', label: `Auto · ${picked || 'none on the server'}` }, ...choices.map((f) => ({ value: f }))]}
              onChange={(model) => update({ model }, 'Reference model')} style={{ flex: 1, minWidth: 0 }} />
          </div>
          {feature !== 'redux' && (
            <>
              <SliderRow label="Start" value={r.start} min={0} max={1} step={0.05} format={pct} defaultValue={0} onChange={(start) => update({ start: Math.min(start, r.end) }, 'Start')} />
              <SliderRow label="End" value={r.end} min={0} max={1} step={0.05} format={pct} defaultValue={1} onChange={(end) => update({ end: Math.max(end, r.start) }, 'End')} />
            </>
          )}
          {method === 'faceid' && (
            <>
              <SliderRow label="FaceID LoRA" value={r.loraStrength ?? 0.6} min={0} max={1} step={0.05} format={fmt2} defaultValue={0.6} onChange={(loraStrength) => update({ loraStrength }, 'FaceID LoRA')} />
              <SliderRow label="Face detail" value={r.faceV2Weight ?? 2} min={0} max={3} step={0.1} format={fmt2} defaultValue={2} onChange={(faceV2Weight) => update({ faceV2Weight }, 'Face detail')} />
            </>
          )}
          {method === 'instantid' && (
            <>
              <SliderRow label="Pose from picture" value={r.cnStrength ?? 0.8} min={0} max={1.5} step={0.05} format={fmt2} defaultValue={0.8} onChange={(cnStrength) => update({ cnStrength }, 'Pose strength')} />
              <SliderRow label="Noise" value={r.noise ?? 0.35} min={0} max={1} step={0.05} format={fmt2} defaultValue={0.35} hint="← sharper · less burn →" onChange={(noise) => update({ noise }, 'Noise')} />
            </>
          )}
          {r.images.length > 1 && feature !== 'redux' && feature !== 'pulid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', flex: 'none' }}>Several pictures</span>
              <SearchSelect label="Several pictures" value={r.combine ?? (feature === 'instantid' ? 'average' : 'concat')} searchable={false}
                options={(feature === 'instantid' ? ['average', 'norm average', 'concat'] : [...COMBINE]).map((c) => ({ value: c }))}
                onChange={(combine) => update({ combine }, 'Several pictures')} style={{ flex: 1, minWidth: 0 }} />
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}
