/**
 * THE number box (items 1 + 38): the 34px `.il-field` shape (44 on the phone) with − / + steppers
 * inside, a typeable value in the middle and an optional unit. Comfortable on both:
 *   - select-all on focus, Enter commits, Esc puts the old value back, blur commits;
 *   - ↑ / ↓ step (Shift = ×10), the wheel steps while the box has focus;
 *   - − / + repeat while held (a long press on the phone), 26px (36 on the phone) targets;
 *   - the phone gets the numeric or decimal keypad (`inputMode`), no spell-check, no autofill.
 * Typed values are clamped, never snapped (exact values off the step grid stay: "CFG 7.25");
 * the steppers snap to the grid. `format` is how the value reads while the box is not focused.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { commitTyped, inputModeFor, nudge } from './numberLogic';
import { ResetButton, resetWithUndo, sameValue } from './ResetButton';

export interface NumberFieldProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** aria-label of the box (and of the steppers: "<label> down / up"). */
  label: string;
  /** Shown after the number ("px", "s", "%"). */
  unit?: string;
  /** How the value reads while not editing (defaults to the number as is). */
  format?: (v: number) => string;
  /** − / + inside the box (default on). */
  steppers?: boolean;
  /** 'sm' 30 · 'md' 34 (default) · 'lg' 44; the phone uses 'lg' unless a size is given. */
  size?: 'sm' | 'md' | 'lg';
  /** Width of the whole box (the input takes what is left). */
  width?: number | string;
  disabled?: boolean;
  style?: CSSProperties;
  /** Where the number sits (center by default with steppers, else right). */
  align?: 'left' | 'center' | 'right';
  /** The default (item 8): a ↺ inside the box puts it back while the value differs (Ctrl+Z undoes). */
  defaultValue?: number;
}

const HEIGHT = { sm: 30, md: 34, lg: 44 } as const;

/** Press-and-hold repeat for a stepper: one step now, then every 70ms after 380ms. */
function useHold(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timers = useRef<{ t?: number; i?: number }>({});
  const stop = () => { window.clearTimeout(timers.current.t); window.clearInterval(timers.current.i); timers.current = {}; };
  useEffect(() => stop, []);
  return {
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault(); // keep the focus where it is (the phone keyboard stays shut)
      stop();
      fnRef.current();
      timers.current.t = window.setTimeout(() => { timers.current.i = window.setInterval(() => fnRef.current(), 70); }, 380);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // A keyboard press (Enter / Space) is a click with detail 0.
    onClick: (e: React.MouseEvent) => { if (e.detail === 0) fnRef.current(); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export function NumberField({
  value, onChange, min = -Infinity, max = Infinity, step = 1, label, unit, format, steppers = true, size, width, disabled, style, align, defaultValue,
}: NumberFieldProps) {
  const phone = useIsPhone();
  const sz = size ?? (phone ? 'lg' : 'md');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // The latest value, so a held stepper keeps counting before the parent re-renders.
  const live = useRef(value);
  useEffect(() => { live.current = value; }, [value]);

  const shown = editing ? draft : (format ? format(value) : String(value));
  const set = (v: number) => { live.current = v; if (v !== value) onChange(v); };
  const stepBy = (dir: 1 | -1, mult = 1) => set(nudge(live.current, dir, min, max, step, mult));
  const commit = () => {
    const v = commitTyped(draft, min, max, step);
    setEditing(false);
    if (v != null) set(v);
  };
  const down = useHold(() => stepBy(-1));
  const up = useHold(() => stepBy(1));

  // The wheel steps only while the box has focus (never hijacks a scrolling panel). Non-passive.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (document.activeElement !== el || Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const v = nudge(live.current, e.deltaY < 0 ? 1 : -1, min, max, step, e.shiftKey ? 10 : 1);
      live.current = v;
      setDraft(String(v));
      onChange(v);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [min, max, step, onChange]);

  const tall = sz === 'lg';
  return (
    <div
      className="il-field"
      data-tall={tall}
      data-size={sz}
      data-steppers={steppers}
      data-disabled={disabled}
      data-align={align ?? (steppers ? 'center' : 'right')}
      style={{ height: HEIGHT[sz], width, ...style }}
    >
      {steppers && (
        <button type="button" className="il-step" aria-label={`${label} down`} disabled={disabled || value <= min} tabIndex={-1} {...down}>
          <IconMinus size={tall ? 16 : 13} stroke={2.4} />
        </button>
      )}
      <input
        ref={inputRef}
        aria-label={label}
        type="text"
        inputMode={inputModeFor(step, min)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        disabled={disabled}
        value={shown}
        onFocus={(e) => { setEditing(true); setDraft(String(value)); const el = e.currentTarget; requestAnimationFrame(() => el.select()); }}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); return; }
          if (e.key === 'Escape') { e.stopPropagation(); setDraft(String(value)); setEditing(false); requestAnimationFrame(() => inputRef.current?.blur()); return; }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const v = nudge(live.current, e.key === 'ArrowUp' ? 1 : -1, min, max, step, e.shiftKey ? 10 : 1);
            live.current = v;
            setDraft(String(v));
            onChange(v);
          }
        }}
      />
      {unit && <span className="il-unit">{unit}</span>}
      {defaultValue != null && !disabled && (
        <ResetButton shown={!editing && !sameValue(value, defaultValue, step)} label={`Reset to ${format ? format(defaultValue) : defaultValue}`}
          onReset={() => resetWithUndo(label, value, defaultValue, (v) => { live.current = v; onChange(v); })} size={tall ? 30 : 20} inField />
      )}
      {steppers && (
        <button type="button" className="il-step" aria-label={`${label} up`} disabled={disabled || value >= max} tabIndex={-1} {...up}>
          <IconPlus size={tall ? 16 : 13} stroke={2.4} />
        </button>
      )}
    </div>
  );
}
