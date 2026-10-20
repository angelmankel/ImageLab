/**
 * The Workflow step's widget editors in the next look (rule 5: tap over type): one `FieldRow`
 * (label, value, reset when changed, pin) around a number (slider + presets, or a stepper box),
 * a combo (chips when ≤ 5 options, else a select), a switch, a text box, or a seed (box + dice +
 * keep / random each run). Types, options and ranges come from the studio store's
 * `WorkflowParam` (`/object_info` + the saved graph); the rules are `workflowStepLogic.ts`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { IconArrowBackUp, IconDice5, IconLock, IconLockOpen, IconPin, IconPinned } from '@tabler/icons-react';
import { randomSeed, type WorkflowParam } from '@/features/studio/params';
import { Chip, IconBtn, SearchSelect, Slider, Tip, NumberField as UiNumberField } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { formatNumber, humanize, numberRange, presetsFor } from './workflowStepLogic';

const MAX_CHIPS = 5;
const MAX_SEED = Number.MAX_SAFE_INTEGER;

export const SELECT_STYLES = {
  input: { background: 'var(--il-panel)', border: '1px solid var(--il-line-strong)', borderRadius: 10, fontWeight: 700, fontSize: 12, color: 'var(--il-fg)', height: 34, minHeight: 34 },
  dropdown: { background: 'var(--il-panel)', borderColor: 'var(--il-line-soft)' },
  option: { fontSize: 12, fontWeight: 600 },
};

/** A select in the next look: the shared `SearchSelect` (item 38); a value the list lacks is kept as its own option. */
export function Pick({ label, value, options, onChange, placeholder }: { label: string; value: string; options: Array<string | { value: string; label: string }>; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <SearchSelect label={label} value={value || null} options={options} onChange={onChange} placeholder={placeholder}
      missingLabel={(v) => v} style={{ flex: 1, minWidth: 0 }} />
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
  /** Item 39: the label's tooltip — a hint id (`~/ui/hints`) or the mapping's own text. */
  hint?: string;
  hintText?: string;
}

export function FieldRow({ label, sub, value, changed, onReset, pinned, onPin, inline, children, hint, hintText }: FieldRowProps) {
  const text = (
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}{sub && <span style={{ fontWeight: 600, color: 'var(--il-muted)' }}> · {sub}</span>}
        </span>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}>
        {hintText ? <Tip label={hintText} multiline w={260}>{text}</Tip> : hint ? <Tip hint={hint}>{text}</Tip> : text}
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

/** A number box with − / + steppers (the shared `ui/NumberField`: select-all, ↑↓, wheel, hold-repeat). */
function NumberBox({ label, value, min, max, step, isInt, onChange, width }: { label: string; value: number; min: number; max: number; step: number; isInt: boolean; onChange: (v: number) => void; width?: number }) {
  return <UiNumberField label={label} value={value} min={min} max={max} step={isInt ? Math.max(1, Math.round(step)) : step} onChange={onChange} width={width} />;
}

export interface ParamFieldProps {
  p: WorkflowParam; value: unknown; onChange: (v: unknown) => void; onReset: () => void; pinned?: boolean; onPin?: () => void; sub?: string;
  /** Item 39 (the mapping layer): the friendly label, the hint id / text, a forced control. */
  label?: string; hint?: string; hintText?: string; control?: 'auto' | 'slider' | 'box' | 'chips' | 'select';
}

export function NumberField({ p, value, onChange, onReset, pinned, onPin, sub, label, hint, hintText, control }: ParamFieldProps) {
  const name = label ?? humanize(p.name);
  const auto = numberRange(p);
  const r = { ...auto, slider: control === 'slider' ? auto.max > auto.min : control === 'box' ? false : auto.slider };
  const n = Number(value ?? p.default ?? r.min);
  const presets = r.slider ? presetsFor(p, r) : undefined;
  const fmt = (v: number) => formatNumber(v, p);
  const phone = useIsPhone();
  return (
    <FieldRow label={name} hint={hint} hintText={hintText} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}
      inline={r.slider ? <UiNumberField label={name} value={n} min={r.min} max={r.max} step={r.step} onChange={onChange} format={fmt} size={phone ? 'lg' : 'sm'} width={phone ? 150 : 116} /> : undefined}>
      {r.slider ? (
        <>
          {presets && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{presets.map((v) => <Chip key={v} small on={Math.abs(v - n) < r.step / 2} onClick={() => onChange(v)}>{fmt(v)}</Chip>)}</div>}
          <Slider value={n} min={r.min} max={r.max} step={r.step} onChange={onChange} aria-label={`${name} slider`} />
        </>
      ) : (
        <NumberBox label={name} value={n} min={r.min} max={r.max} step={r.step} isInt={p.type === 'INT'} onChange={onChange} />
      )}
    </FieldRow>
  );
}

export function ComboField({ p, value, onChange, onReset, pinned, onPin, sub, label, hint, hintText, control }: ParamFieldProps) {
  const name = label ?? humanize(p.name);
  const options = (p.options ?? []).map(String);
  const cur = String(value ?? '');
  return (
    <FieldRow label={name} hint={hint} hintText={hintText} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      {!options.length ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>Nothing to choose from on this server.</span>
      ) : control === 'chips' || (control !== 'select' && options.length <= MAX_CHIPS) ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{options.map((o) => <Chip key={o} small on={o === cur} onClick={() => onChange(o)}>{o}</Chip>)}</div>
      ) : (
        <Pick label={name} value={cur} options={options} onChange={onChange} />
      )}
    </FieldRow>
  );
}

export function BoolField({ p, value, onChange, onReset, pinned, onPin, sub, label, hint, hintText }: ParamFieldProps) {
  const name = label ?? humanize(p.name);
  const on = value === true || value === 'true';
  return (
    <FieldRow label={name} hint={hint} hintText={hintText} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}
      inline={<Chip small on={on} onClick={() => onChange(!on)} title={on ? 'On · tap to switch off' : 'Off · tap to switch on'}>{on ? 'on' : 'off'}</Chip>} />
  );
}

export function StringField({ p, value, onChange, onReset, pinned, onPin, sub, label, hint, hintText, rows = 3 }: ParamFieldProps & { rows?: number }) {
  const name = label ?? humanize(p.name);
  const s = String(value ?? '');
  const style: React.CSSProperties = { width: '100%', border: '1px solid var(--il-line-strong)', borderRadius: 10, background: 'var(--il-panel)', color: 'var(--il-fg)', fontSize: 13, lineHeight: 1.45, padding: '7px 9px', outline: 'none', display: 'block', fontFamily: 'inherit' };
  return (
    <FieldRow label={name} hint={hint} hintText={hintText} sub={sub} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      {p.multiline
        ? <textarea aria-label={name} rows={rows} value={s} onChange={(e) => onChange(e.currentTarget.value)} style={{ ...style, resize: 'vertical' }} />
        : <input aria-label={name} value={s} onChange={(e) => onChange(e.currentTarget.value)} style={{ ...style, height: 32, padding: '0 9px' }} />}
    </FieldRow>
  );
}

/** Seed: a number box, a dice (new seed now), and keep / random each run (`kept` = used as set). */
export function SeedField({ p, value, onChange, onReset, pinned, onPin, sub, label, hint, hintText, kept, onToggleKept }: ParamFieldProps & { kept: boolean; onToggleKept: () => void }) {
  const name = label ?? humanize(p.name);
  const n = Number(value ?? 0);
  const [draft, setDraft] = useState(String(n));
  useEffect(() => { setDraft(String(n)); }, [n]);
  const commit = () => { const v = Math.max(0, Math.min(MAX_SEED, Math.trunc(Number(draft)) || 0)); setDraft(String(v)); if (v !== n) onChange(v); };
  return (
    <FieldRow label={name} hint={hint} hintText={hintText} sub={sub ?? (kept ? 'kept as set' : 'random each run')} changed={value !== p.value} onReset={onReset} pinned={pinned} onPin={onPin}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input aria-label={name} type="number" inputMode="numeric" min={0} value={draft} onChange={(e) => setDraft(e.currentTarget.value)} onBlur={commit}
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
