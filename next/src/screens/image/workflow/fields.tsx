/**
 * The Workflow step's widget editors in the next look (rule 5: tap over type): one `FieldRow`
 * (label, value, reset when changed, pin) around a number (slider + presets, or a stepper box),
 * a combo (chips when ≤ 5 options, else a select), a switch, a text box, or a seed (box + dice +
 * keep / random each run). Types, options and ranges come from the studio store's
 * `WorkflowParam` (`/object_info` + the saved graph); the rules are `workflowStepLogic.ts`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Select, Slider as MSlider } from '@mantine/core';
import { IconArrowBackUp, IconChevronDown, IconDice5, IconLock, IconLockOpen, IconMinus, IconPin, IconPinned, IconPlus } from '@tabler/icons-react';
import { randomSeed, type WorkflowParam } from '@/features/studio/params';
import { Chip, IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { formatNumber, humanize, numberRange, presetsFor } from './workflowStepLogic';

const MAX_CHIPS = 5;
const MAX_SEED = Number.MAX_SAFE_INTEGER;

export const SELECT_STYLES = {
  input: { background: 'var(--il-panel)', border: '1px solid var(--il-line-strong)', borderRadius: 10, fontWeight: 700, fontSize: 12, color: 'var(--il-fg)', height: 34, minHeight: 34 },
  dropdown: { background: 'var(--il-panel)', borderColor: 'var(--il-line-soft)' },
  option: { fontSize: 12, fontWeight: 600 },
};

/** A plain select in the next look; a value the list lacks is kept as its own option. */
export function Pick({ label, value, options, onChange, placeholder }: { label: string; value: string; options: Array<string | { value: string; label: string }>; onChange: (v: string) => void; placeholder?: string }) {
  const has = options.some((o) => (typeof o === 'string' ? o : o.value) === value);
  const data = has || !value ? options : [value, ...options];
  return (
    <Select
      aria-label={label}
      data={data}
      value={value || null}
      placeholder={placeholder}
      onChange={(v) => { if (v != null) onChange(v); }}
      allowDeselect={false}
      searchable={options.length > 12}
      size="xs"
      rightSection={<IconChevronDown size={14} stroke={2.6} />}
      rightSectionWidth={26}
      comboboxProps={{ withinPortal: true, zIndex: T.z.popover, shadow: 'md' }}
      styles={SELECT_STYLES}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
}

export interface FieldRowProps {
  label: string;
  /** Small grey text after the label (the node, a unit). */
  sub?: string;
  /** Shown bold on the right (a number's value). */
  value?: string;
  changed?: boolean;
  onReset?: () => void;
  pinned?: boolean;
  onPin?: () => void;
  /** A control that sits in the header line (a switch). */
  inline?: ReactNode;
  children?: ReactNode;
}

export function FieldRow({ label, sub, value, changed, onReset, pinned, onPin, inline, children }: FieldRowProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}{sub && <span style={{ fontWeight: 600, color: 'var(--il-muted)' }}> · {sub}</span>}
        </span>
        {value != null && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
        {inline}
        {changed && onReset && <IconBtn size={24} icon={<IconArrowBackUp size={13} />} label="Back to the value saved in ComfyUI" onClick={onReset} />}
        {onPin && <IconBtn size={24} on={pinned} icon={pinned ? <IconPinned size={13} /> : <IconPin size={13} />} label={pinned ? 'Unpin' : 'Pin to the top'} onClick={onPin} />}
      </div>
      {children}
    </div>
  );
}

const box: React.CSSProperties = { height: 30, border: '1px solid var(--il-line-strong)', borderRadius: 8, background: 'var(--il-panel)', color: 'var(--il-fg)', fontSize: 12, fontWeight: 700, padding: '0 8px', outline: 'none', fontVariantNumeric: 'tabular-nums', minWidth: 0 };

/** A number box that commits on blur / Enter, with − / + steppers. */
function NumberBox({ label, value, min, max, step, isInt, onChange }: { label: string; value: number; min: number; max: number; step: number; isInt: boolean; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const clamp = (n: number) => Math.max(min, Math.min(max, isInt ? Math.round(n) : n));
  const commit = () => { const n = Number(draft); if (Number.isFinite(n)) { const c = clamp(n); if (c !== value) onChange(c); setDraft(String(c)); } else setDraft(String(value)); };
  const nudge = (dir: 1 | -1) => onChange(clamp(Number((value + dir * step).toFixed(6))));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <IconBtn size={28} tone="card" icon={<IconMinus size={13} />} label={`${label} down`} onClick={() => nudge(-1)} disabled={value <= min} tooltip={false} />
      <input aria-label={label} type="number" inputMode="decimal" value={draft} min={min} max={max} step={step}
        onChange={(e) => setDraft(e.currentTarget.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
        style={{ ...box, flex: 1, textAlign: 'center' }} />
      <IconBtn size={28} tone="card" icon={<IconPlus size={13} />} label={`${label} up`} onClick={() => nudge(1)} disabled={value >= max} tooltip={false} />
    </div>
  );
}

export interface ParamFieldProps { p: WorkflowParam; value: unknown; onChange: (v: unknown) => void; onReset: () => void; pinned?: boolean; onPin?: () => void; sub?: string }

export function NumberField({ p, value, onChange, onReset, pinned, onPin, sub }: ParamFieldProps) {
  const r = numberRange(p);
  const n = Number(value ?? p.default ?? r.min);
  const presets = r.slider ? presetsFor(p, r) : undefined;
  const fmt = (v: number) => formatNumber(v, p);
  return (
    <FieldRow label={humanize(p.name)} sub={sub} value={fmt(n)} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      {r.slider ? (
        <>
          {presets && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{presets.map((v) => <Chip key={v} small on={Math.abs(v - n) < r.step / 2} onClick={() => onChange(v)}>{fmt(v)}</Chip>)}</div>}
          <MSlider value={n} min={r.min} max={r.max} step={r.step} onChange={onChange} label={null} size="sm" color="ember"
            styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} />
        </>
      ) : (
        <NumberBox label={humanize(p.name)} value={n} min={r.min} max={r.max} step={r.step} isInt={p.type === 'INT'} onChange={onChange} />
      )}
    </FieldRow>
  );
}

export function ComboField({ p, value, onChange, onReset, pinned, onPin, sub }: ParamFieldProps) {
  const options = (p.options ?? []).map(String);
  const cur = String(value ?? '');
  return (
    <FieldRow label={humanize(p.name)} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      {!options.length ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>Nothing to choose from on this server.</span>
      ) : options.length <= MAX_CHIPS ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{options.map((o) => <Chip key={o} small on={o === cur} onClick={() => onChange(o)}>{o}</Chip>)}</div>
      ) : (
        <Pick label={humanize(p.name)} value={cur} options={options} onChange={onChange} />
      )}
    </FieldRow>
  );
}

export function BoolField({ p, value, onChange, onReset, pinned, onPin, sub }: ParamFieldProps) {
  const on = value === true || value === 'true';
  return (
    <FieldRow label={humanize(p.name)} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}
      inline={<Chip small on={on} onClick={() => onChange(!on)} title={on ? 'On · tap to switch off' : 'Off · tap to switch on'}>{on ? 'on' : 'off'}</Chip>} />
  );
}

export function StringField({ p, value, onChange, onReset, pinned, onPin, sub, rows = 3 }: ParamFieldProps & { rows?: number }) {
  const s = String(value ?? '');
  const style: React.CSSProperties = { width: '100%', border: '1px solid var(--il-line-strong)', borderRadius: 10, background: 'var(--il-panel)', color: 'var(--il-fg)', fontSize: 13, lineHeight: 1.45, padding: '7px 9px', outline: 'none', display: 'block', fontFamily: 'inherit' };
  return (
    <FieldRow label={humanize(p.name)} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      {p.multiline
        ? <textarea aria-label={humanize(p.name)} rows={rows} value={s} onChange={(e) => onChange(e.currentTarget.value)} style={{ ...style, resize: 'vertical' }} />
        : <input aria-label={humanize(p.name)} value={s} onChange={(e) => onChange(e.currentTarget.value)} style={{ ...style, height: 32, padding: '0 9px' }} />}
    </FieldRow>
  );
}

/** Seed: a number box, a dice (new seed now), and keep / random each run (`kept` = used as set). */
export function SeedField({ p, value, onChange, onReset, pinned, onPin, sub, kept, onToggleKept }: ParamFieldProps & { kept: boolean; onToggleKept: () => void }) {
  const n = Number(value ?? 0);
  const [draft, setDraft] = useState(String(n));
  useEffect(() => { setDraft(String(n)); }, [n]);
  const commit = () => { const v = Math.max(0, Math.min(MAX_SEED, Math.trunc(Number(draft)) || 0)); setDraft(String(v)); if (v !== n) onChange(v); };
  return (
    <FieldRow label={humanize(p.name)} sub={sub ?? (kept ? 'kept as set' : 'random each run')} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input aria-label={humanize(p.name)} type="number" inputMode="numeric" min={0} value={draft} onChange={(e) => setDraft(e.currentTarget.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          title={kept ? 'This seed is used as set' : 'A new seed is rolled for every run (the dice rolls one now)'}
          style={{ ...box, flex: 1, textAlign: 'right', color: kept ? 'var(--il-fg)' : 'var(--il-muted)' }} />
        <IconBtn size={30} tone="card" icon={<IconDice5 size={16} />} label="New seed now" onClick={() => onChange(randomSeed())} />
        <IconBtn size={30} tone="card" on={kept} icon={kept ? <IconLock size={16} /> : <IconLockOpen size={16} />}
          label={kept ? 'Seed kept · tap for a new seed every run' : 'New seed every run · tap to keep this seed'} onClick={onToggleKept} />
      </div>
    </FieldRow>
  );
}
