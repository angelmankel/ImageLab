/**
 * The dock's Generate (rules 11 + 15): a big ember circle in the middle of the tab row.
 *   tap  = generate (bolt: the seed as set; dice: a new random seed)
 *   hold (HOLD_MS) = switch between bolt and dice (a buzz says it switched)
 *   it never turns into Stop (item 46): while this step's job runs a ring shows the progress and a
 *   tap queues one more; the badge on its right counts the jobs left — a tap on the badge opens
 *   the queue on the Output page, where each card has its ×.
 * Generate is the desktop's own function (`useGenerate` from `~/screens/image`).
 */
import { useEffect, useRef } from 'react';
import { IconBoltFilled, IconDice5Filled, IconPlayerStopFilled } from '@tabler/icons-react';
import { useQueue } from '~/app/queue';
import { useGenerate } from './imageBridge';
import { usePhone } from './phoneStore';
import { HOLD_MS, HOLD_MOVE_PX, badgeText, generateFace, pressOutcome, progressFraction, toggleSeedMode } from './phoneLogic';

const SIZE = 56;
const RING = 64;

export function GenerateOrb() {
  const { generate, generateRandom, stop, running } = useGenerate();
  const seedMode = usePhone((s) => s.seedMode);
  const setSeedMode = usePhone((s) => s.setSeedMode);
  const showQueue = usePhone((s) => s.showQueue);
  const { rows, running: runningRow } = useQueue();
  const face = generateFace(running, seedMode);
  const badge = badgeText(rows.length);
  const fraction = running ? progressFraction(runningRow?.progress) : null;

  const fire = () => (seedMode === 'random' ? generateRandom() : generate());

  // The press: a timer turns it into a hold; moving off cancels; the click after a hold is eaten.
  const press = useRef<{ t: number; x: number; y: number; moved: number } | null>(null);
  const timer = useRef(0);
  const eat = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    press.current = { t: e.timeStamp, x: e.clientX, y: e.clientY, moved: 0 };
    eat.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const p = press.current;
      if (!p || pressOutcome(HOLD_MS, p.moved) !== 'hold') return;
      eat.current = true;
      setSeedMode(toggleSeedMode(usePhone.getState().seedMode));
      try { navigator.vibrate?.(14); } catch { /* not every phone buzzes */ }
    }, HOLD_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    if (p.moved > HOLD_MOVE_PX) { window.clearTimeout(timer.current); eat.current = true; }
  };
  const onPointerEnd = () => { window.clearTimeout(timer.current); press.current = null; };
  const onClick = () => {
    if (eat.current) { eat.current = false; return; }
    if (face === 'stop') stop(); else fire();
  };

  const label = face === 'stop' ? 'Stop this step’s job'
    : face === 'dice' ? 'Generate with a random seed · hold to keep the seed'
      : 'Generate · hold for a random seed';
  const icon = face === 'stop' ? <IconPlayerStopFilled size={24} />
    : face === 'dice' ? <IconDice5Filled size={26} /> : <IconBoltFilled size={26} />;

  const r = (RING - 4) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{ position: 'relative', width: RING, height: RING, flex: 'none', display: 'grid', placeItems: 'center' }}>
      {running && (
        <svg width={RING} height={RING} aria-hidden className={fraction == null ? 'animate-spin' : undefined}
          style={{ position: 'absolute', inset: 0, transform: fraction == null ? undefined : 'rotate(-90deg)', pointerEvents: 'none' }}>
          <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="var(--il-line-strong)" strokeWidth={3} />
          <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="var(--il-ember-hi)" strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={fraction == null ? circ * 0.72 : circ * (1 - fraction)}
            style={{ transition: 'stroke-dashoffset 200ms linear' }} />
        </svg>
      )}
      <button
        type="button"
        aria-label={label}
        title={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: SIZE, height: SIZE, padding: 0, border: 0, borderRadius: '50%', cursor: 'pointer',
          background: 'var(--il-ember)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 18px color-mix(in srgb, var(--il-ember) 35%, transparent)', touchAction: 'manipulation',
          userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        }}
      >
        {icon}
      </button>
      {running && (
        // Queue another while this one runs (rule 15): same seed mode as the button.
        <button type="button" onClick={fire} aria-label={seedMode === 'random' ? 'Queue another, random seed' : 'Queue another'}
          style={{ ...bubble, left: -6, top: -4, background: 'var(--il-card-on)', color: 'var(--il-ember-hi)' }}>
          {seedMode === 'random' ? <IconDice5Filled size={13} /> : <IconBoltFilled size={13} />}
        </button>
      )}
      {badge && (
        <button type="button" onClick={showQueue} aria-label={`${rows.length} jobs queued`}
          style={{ ...bubble, right: -6, top: -4, minWidth: 22, width: 'auto', padding: '0 6px', background: 'var(--il-fg)', color: 'var(--il-bg)', fontSize: 11, fontWeight: 800 }}>
          {badge}
        </button>
      )}
    </div>
  );
}

const bubble: React.CSSProperties = {
  position: 'absolute', width: 24, height: 22, borderRadius: 999, border: '2px solid var(--il-bg)',
  display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer', lineHeight: 1,
};
