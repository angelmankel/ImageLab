/**
 * Reset to default (FIXLIST-2 item 8), built into the shared controls: `SliderRow`, `NumberField`
 * and `SearchSelect` take a `defaultValue`; when the value differs, a small ↺ shows next to the
 * control ("Reset to 7"); a click puts the default back and pushes an undo entry (Ctrl+Z brings
 * the old value back). Nothing shows while the value IS the default, so the panel stays clean.
 * A slider's handle also resets on double-click.
 */
import { IconRestore } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { Tip } from './Tip';

export { resetWithUndo, sameValue } from './resetLogic';

export function ResetButton({ label, shown, onReset, size, inField }: {
  /** e.g. "Reset to 7". */
  label: string; shown: boolean; onReset: () => void; size?: number;
  /** Inside a field box: out of the tab order (like the − / + steppers). */
  inField?: boolean;
}) {
  const phone = useIsPhone();
  if (!shown) return null;
  const s = size ?? (phone ? 36 : 22);
  return (
    <Tip label={label}>
      <button type="button" aria-label={label} className="il-reset" tabIndex={inField ? -1 : undefined}
        // Inside a field: never move the focus or open its list.
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); onReset(); }}
        style={{ flex: 'none', width: s, height: s, display: 'grid', placeItems: 'center', padding: 0, border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer' }}>
        <IconRestore size={phone ? 16 : 13} stroke={2.2} />
      </button>
    </Tip>
  );
}
