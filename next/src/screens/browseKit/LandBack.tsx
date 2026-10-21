/**
 * Mobile pass (m-browse): the landscape "‹ Back" — a pill in a pane's top row of a browse screen
 * (History, Models, Starters, ComfyUI) inside `PhoneTwoPane` (`~/phone`). The portrait centred
 * glass Back pill would sit over both panes.
 */
import { IconChevronLeft } from '@tabler/icons-react';

export function LandBack({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ height: 40, padding: '0 12px 0 6px', border: 0, borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 'none' }}>
      <IconChevronLeft size={18} stroke={2.6} />{label}
    </button>
  );
}
