/**
 * Every filter as a group of controls (rule 13: ALL the API's features). Used twice: the desktop
 * "Filters" panel under the chip row (`size='desktop'`, compact) and the phone's Filters sheet
 * (`size='phone'`, thumb-sized). The desktop's inline chip row shows the main type / base chips
 * itself, so `inline` hides those groups here.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Switch } from '~/ui';
import {
  MODEL_TYPES, MAIN_BASE_MODELS, MORE_BASE_MODELS, PERIODS, PERIOD_LABEL, NSFW_LEVELS, SORTS, COMMERCIAL_USE, COMMERCIAL_LABEL,
  FILE_FORMATS, FP_PRECISIONS, CHECKPOINT_TYPES, baseModelShort, typeLabel, maskForLevel, levelForMask, toggleIn,
  type ModelFilters, type Tri, type NsfwLevelKey, type Sort,
} from './civitaiQuery';
import { fetchTags, fetchCreators, hasApiKey } from './civitaiApi';
import { FChip, Label, MenuPill, SegPill, type Size } from './bits';

type Patch = (p: Partial<ModelFilters>) => void;

/** The types the desktop chip row leaves out (FilterBar's ROW_TYPES); they live in the panel. */
const MORE_TYPES = MODEL_TYPES.filter((t) => ['DoRA', 'AestheticGradient', 'Detection', 'Other'].includes(t));

function Group({ label, children, size }: { label: string; children: ReactNode; size: Size }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <Label style={{ fontSize: size === 'phone' ? 10 : 10 }}>{label}</Label>
      {children}
    </div>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>;
}

const TRI: Array<{ key: Tri; label: string }> = [{ key: 'any', label: 'Any' }, { key: 'only', label: 'Only' }, { key: 'hide', label: 'Hide' }];

/** A text box with suggestions from /tags or /creators (debounced, through a datalist). */
function SuggestInput({ id, value, placeholder, onCommit, kind, size }: { id: string; value: string; placeholder: string; onCommit: (v: string) => void; kind: 'tag' | 'creator'; size: Size }) {
  const [text, setText] = useState(value);
  const [options, setOptions] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setText(value), [value]);
  const suggest = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setOptions([]); return; }
    timer.current = setTimeout(() => {
      const p = kind === 'tag' ? fetchTags({ query: q, limit: 10 }).then((r) => r.items.map((t) => t.name)) : fetchCreators({ query: q, limit: 10 }).then((r) => r.items.map((c) => c.username));
      p.then(setOptions).catch(() => setOptions([]));
    }, 300);
  };
  return (
    <>
      <input
        id={id}
        list={`${id}-list`}
        value={text}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => { setText(e.target.value); suggest(e.target.value); }}
        onBlur={() => { if (text.trim() !== value) onCommit(text.trim()); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
        style={{ width: '100%', height: size === 'phone' ? 44 : 32, padding: '0 12px', border: '1px solid var(--il-line-strong)', borderRadius: size === 'phone' ? 14 : 10, background: 'transparent', color: 'var(--il-fg)', fontSize: size === 'phone' ? 13 : 12, fontWeight: 600, outline: 'none' }}
      />
      <datalist id={`${id}-list`}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </>
  );
}

export function FilterFields({ f, set, size, inline }: { f: ModelFilters; set: Patch; size: Size; inline?: boolean }) {
  const [moreBase, setMoreBase] = useState(f.baseModels.some((b) => (MORE_BASE_MODELS as readonly string[]).includes(b)));
  const phone = size === 'phone';
  const keyed = hasApiKey();
  const needsKey = keyed ? '' : ' (no API key: local list)';

  const toggleRow = (label: string, on: boolean, change: (v: boolean) => void, hint?: string) => phone ? (
    <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1 }}><Switch label={label} checked={on} onChange={change} description={hint} /></div>
    </div>
  ) : (
    <FChip dot on={on} onClick={() => change(!on)} title={hint}>{label}</FChip>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 12 : 10 }}>
      <Group label={inline ? 'MORE TYPES' : 'TYPE'} size={size}>
        <Chips>{(inline ? MORE_TYPES : MODEL_TYPES).map((t) => <FChip key={t} size={size} on={f.types.includes(t)} onClick={() => set({ types: toggleIn(f.types, t) })}>{typeLabel(t)}</FChip>)}</Chips>
      </Group>
      <Group label={inline ? 'MORE BASE MODELS' : 'BASE MODEL'} size={size}>
        <Chips>
          {!inline && MAIN_BASE_MODELS.map((b) => <FChip key={b} size={size} on={f.baseModels.includes(b)} onClick={() => set({ baseModels: toggleIn(f.baseModels, b) })}>{baseModelShort(b)}</FChip>)}
          {(inline || moreBase) && MORE_BASE_MODELS.map((b) => <FChip key={b} size={size} on={f.baseModels.includes(b)} onClick={() => set({ baseModels: toggleIn(f.baseModels, b) })}>{baseModelShort(b)}</FChip>)}
          {!inline && !moreBase && <FChip size={size} onClick={() => setMoreBase(true)} style={{ color: 'var(--il-muted)' }}>+{MORE_BASE_MODELS.length} more</FChip>}
        </Chips>
      </Group>
      {phone && (
        <>
          <Group label="PERIOD" size={size}>
            <SegPill size={size} fill label="Period" value={f.period} onChange={(period) => set({ period })} items={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))} />
          </Group>
          <Group label="NSFW LEVEL" size={size}>
            <SegPill<NsfwLevelKey> size={size} fill label="NSFW level" value={levelForMask(f.nsfwMask)} onChange={(k) => set({ nsfwMask: maskForLevel(k) })} items={NSFW_LEVELS.map((l) => ({ key: l.key, label: l.label }))} />
          </Group>
          <Group label="SORT" size={size}>
            <MenuPill<Sort> size={size} grow label="Sort" value={f.sort} onChange={(sort) => set({ sort })} options={SORTS.map((s) => ({ key: s, label: s }))} />
          </Group>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: phone ? 0 : 6 }}>
        {toggleRow('★ Favourites', f.favorites, (favorites) => set({ favorites }), keyed ? 'Your CivitAI favourites' : 'Models you ♥ here' + needsKey)}
        {toggleRow('Followed creators', f.followed, (followed) => set({ followed }), keyed ? 'Creators you follow on CivitAI' : 'Creators you follow here' + needsKey)}
        {toggleRow('Made on-site', f.supportsGeneration, (supportsGeneration) => set({ supportsGeneration }), 'Models CivitAI can generate with')}
        {toggleRow('Hidden models', f.hidden, (hidden) => set({ hidden }), 'The key\'s hidden list')}
        {toggleRow('Primary file only', f.primaryFileOnly, (primaryFileOnly) => set({ primaryFileOnly }))}
        {toggleRow('No credit needed', f.allowNoCredit, (allowNoCredit) => set({ allowNoCredit }), 'Licence allows use without credit')}
        {toggleRow('Derivatives allowed', f.allowDerivatives, (allowDerivatives) => set({ allowDerivatives }))}
        {toggleRow('Different licence allowed', f.allowDifferentLicenses, (allowDifferentLicenses) => set({ allowDifferentLicenses }))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: phone ? 12 : 10 }}>
        <Group label="EARLY ACCESS" size={size}>
          <SegPill size={size} fill={phone} label="Early access" value={f.earlyAccess} onChange={(earlyAccess) => set({ earlyAccess })} items={TRI} />
        </Group>
        <Group label="INSTALLED HERE" size={size}>
          <SegPill size={size} fill={phone} label="Installed" value={f.installed} onChange={(installed) => set({ installed })} items={TRI} />
        </Group>
        <Group label="CHECKPOINT TYPE" size={size}>
          <SegPill size={size} fill={phone} label="Checkpoint type" value={f.checkpointType || 'any'} onChange={(k) => set({ checkpointType: k === 'any' ? '' : (k as 'Trained' | 'Merge') })} items={[{ key: 'any', label: 'Any' }, ...CHECKPOINT_TYPES.map((t) => ({ key: t, label: t }))]} />
        </Group>
        <Group label="CATALOG" size={size}>
          <SegPill size={size} fill={phone} label="Catalog" value={f.catalog} onChange={(catalog) => set({ catalog })} items={[{ key: 'civitai', label: 'civitai.com' }, { key: 'red', label: 'civitai.red' }]} />
        </Group>
      </div>
      <Group label="COMMERCIAL USE" size={size}>
        <Chips>{COMMERCIAL_USE.map((c) => <FChip key={c} size={size} on={f.commercialUse.includes(c)} onClick={() => set({ commercialUse: toggleIn(f.commercialUse, c) })}>{COMMERCIAL_LABEL[c] ?? c}</FChip>)}</Chips>
      </Group>
      <Group label="FILE FORMAT" size={size}>
        <Chips>{FILE_FORMATS.map((c) => <FChip key={c} size={size} on={f.fileFormats.includes(c)} onClick={() => set({ fileFormats: toggleIn(f.fileFormats, c) })}>{c}</FChip>)}</Chips>
      </Group>
      <Group label="PRECISION" size={size}>
        <Chips>{FP_PRECISIONS.map((c) => <FChip key={c} size={size} on={f.fp.includes(c)} onClick={() => set({ fp: toggleIn(f.fp, c) })}>{c}</FChip>)}</Chips>
      </Group>
      <Group label="MINIMUM RATING" size={size}>
        <Chips>
          <FChip size={size} on={f.rating === 0} onClick={() => set({ rating: 0 })}>Any</FChip>
          {[3, 4, 5].map((r) => <FChip key={r} size={size} on={f.rating === r} onClick={() => set({ rating: r })}>{r}★+</FChip>)}
        </Chips>
      </Group>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: phone ? 12 : 10 }}>
        <Group label="TAG" size={size}>
          <SuggestInput id={`mdl-tag-${size}`} kind="tag" size={size} value={f.tag} placeholder="anime, portrait, style…" onCommit={(tag) => set({ tag })} />
        </Group>
        <Group label="CREATOR" size={size}>
          <SuggestInput id={`mdl-creator-${size}`} kind="creator" size={size} value={f.username} placeholder="username" onCommit={(username) => set({ username })} />
        </Group>
      </div>
    </div>
  );
}
