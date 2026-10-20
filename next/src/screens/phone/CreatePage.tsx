/**
 * The phone's Create page for one step (rule 11): a slim top row (session → the More sheet, the
 * connection pill) and the step panel itself — workflow row + Prompt · Model · Settings · Input —
 * from `~/screens/image` (through `imageBridge`). Generate lives in the dock, not here.
 */
import { IconFolder } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { Step } from '~/app/stepsStore';
import { Dot } from '~/ui';
import { T } from '~/theme/tokens';
import { StepPanel } from './imageBridge';
import { DOCK_SPACE } from './PhoneDock';
import { usePhone } from './phoneStore';

export function PhoneTopRow() {
  const setMoreOpen = usePhone((s) => s.setMoreOpen);
  const online = useStore((s) => Object.keys(s.serverInfo).length > 0);
  const serverName = useStore((s) => s.servers[0]?.name ?? null);
  return (
    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.gap.sm, padding: `env(safe-area-inset-top, 0px) ${T.pad.panel}px 0`, boxSizing: 'content-box' }}>
      <button type="button" onClick={() => setMoreOpen(true)}
        style={{ height: 32, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <IconFolder size={14} color="var(--il-muted)" />Session<span style={{ color: 'var(--il-muted)' }}>▾</span>
      </button>
      <div style={{ height: 30, padding: '0 10px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg2)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '55%' }}>
        <Dot color={online ? 'var(--il-ok)' : 'var(--il-err)'} size={7} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{online ? (serverName ?? 'Online') : 'Offline'}</span>
      </div>
    </div>
  );
}

export function CreatePage({ step }: { step: Step }) {
  return (
    <div className="il-scroll" data-pad-start style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: `calc(${DOCK_SPACE + 12}px + var(--il-safe-bottom))` }}>
      <PhoneTopRow />
      <StepPanel phone stepId={step.id} />
    </div>
  );
}
