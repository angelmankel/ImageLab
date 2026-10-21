/**
 * Generate in the phone frame's bottom band (mobile pass, m-create): the desktop Generate group,
 * compact (≤ 48 px tall) — ×N (Image step: tap cycles Images per run) · Generate (tap = the seed as
 * set / a random one, hold = switch bolt ⇄ dice, as the old orb) with the jobs-left count. `all`
 * (the Session page) = Generate all instead (stale steps only).
 */
import { useRef } from 'react';
import { IconBoltFilled, IconCheck, IconDice5Filled, IconPlayerPlayFilled, IconPlayerStopFilled } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useActiveStep } from '~/app/stepsStore';
import { useSkipFlash } from '~/app/stepFingerprint';
import { nextInCycle, useCycleList } from '~/app/batchCycle';
import { useUndoableSetWorkflow } from '~/app/undoableWorkflow';
import { useQueue } from '~/app/queue';
import { say } from '~/app/notify';
import { generateAll, useGenerateAll } from '~/screens/image/GenerateAll';
import { haptic, useBandLayout } from '~/phone';
import { useGenerate } from '../imageBridge';
import { usePhone } from '../phoneStore';
import { HOLD_MS, toggleSeedMode } from '../phoneLogic';

const H = 48;

export function BandGenerate({ all = false }: { all?: boolean }) {
  if (all) return <BandAll />;
  return <BandStep />;
}

function BandAll() {
  const running = useGenerateAll();
  return (
    <button type="button" onClick={() => { haptic(); void generateAll(); }} aria-label={running ? 'Stop Generate all' : 'Generate all steps'}
      style={{ height: H, padding: '0 18px', border: 0, borderRadius: 999, background: running ? 'var(--il-card-on)' : 'var(--il-ember)', color: running ? 'var(--il-ember-hi)' : 'var(--il-bg)', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {running ? <IconPlayerStopFilled size={16} /> : <IconPlayerPlayFilled size={16} />}{running ? 'Stop' : 'All'}
    </button>
  );
}

function BandStep() {
  const { generate, generateRandom, disabled } = useGenerate();
  const step = useActiveStep();
  const seedMode = usePhone((s) => s.seedMode);
  const setSeedMode = usePhone((s) => s.setSeedMode);
  const upToDate = useSkipFlash((s) => s.stepId === step.id);
  const pending = useQueue().rows.filter((r) => r.stepId === step.id).length;
  const batch = useStore((s) => s.workflow.batch);
  const setWorkflow = useUndoableSetWorkflow();
  const cycle = useCycleList();
  const timer = useRef(0);
  const held = useRef(false);
  // The band side's room (m-shell): the label only when it fits; stacked in the landscape column.
  const { vertical, room } = useBandLayout();
  const label = upToDate ? 'Up to date' : 'Generate';
  const need = (step.kind === 'image' ? 45 : 0) + 51 + label.length * 8.4 + (pending > 0 ? 27 : 0) + 4;
  const showLabel = !vertical && need <= room;
  const fire = () => {
    if (disabled) { say(disabled, { tone: 'warn' }); return; }
    haptic();
    if (seedMode === 'random') generateRandom(); else generate();
  };
  const down = () => { held.current = false; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { held.current = true; setSeedMode(toggleSeedMode(usePhone.getState().seedMode)); haptic('hold'); }, HOLD_MS); };
  const up = () => window.clearTimeout(timer.current);
  const seg: React.CSSProperties = { height: H, flexShrink: 0, border: 0, background: 'transparent', color: 'var(--il-bg)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' };
  return (
    <div style={{ height: vertical ? 'auto' : H, width: vertical ? 64 : undefined, flexDirection: vertical ? 'column' : 'row', display: 'flex', borderRadius: vertical ? 22 : 999, overflow: 'hidden', background: 'var(--il-ember)', opacity: disabled ? 0.55 : 1, boxShadow: '0 6px 18px color-mix(in srgb, var(--il-ember) 30%, transparent)' }}>
      {step.kind === 'image' && (
        <>
          <button type="button" aria-label={`Images per run: ×${batch}`} onClick={() => { haptic(); setWorkflow({ batch: nextInCycle(cycle, batch) }); }}
            style={{ ...seg, width: vertical ? 64 : 44, height: vertical ? 44 : H, paddingLeft: vertical ? 0 : 6, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>×{batch}</button>
          <span aria-hidden style={vertical ? { height: 1, margin: '0 10px', background: 'color-mix(in srgb, var(--il-bg) 25%, transparent)' } : { width: 1, margin: '10px 0', background: 'color-mix(in srgb, var(--il-bg) 25%, transparent)' }} />
        </>
      )}
      <button type="button" aria-label={seedMode === 'random' ? 'Generate with a random seed' : 'Generate'}
        onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (held.current) { held.current = false; return; } fire(); }}
        style={{ ...seg, padding: showLabel ? '0 14px 0 12px' : 0, minWidth: showLabel ? undefined : vertical ? 64 : 56, height: vertical ? 56 : H, flexDirection: vertical ? 'column' : 'row', gap: vertical ? 2 : 7, fontSize: 14 }}>
        {upToDate ? <IconCheck size={18} stroke={3} /> : seedMode === 'random' ? <IconDice5Filled size={18} /> : <IconBoltFilled size={18} />}
        {showLabel && label}
        {pending > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--il-bg) 82%, transparent)', color: 'var(--il-ember-hi)', fontSize: 11, display: 'grid', placeItems: 'center' }}>{pending}</span>}
      </button>
    </div>
  );
}
