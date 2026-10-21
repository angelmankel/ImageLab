/**
 * Loopback (rule 5; "the Image step = base image + Loopback, no Passes"): the card under Detail.
 * Off = one row (label, hint, switch). On = the header shows what runs ("×4 · grow 1.5 · denoise
 * 0.5→0.3"), then Rounds as chips + a number box, Grow per round, Denoise (first→last range or
 * one value), Steps and CFG per round, and a folded More with noise, the "changes per round" ramps
 * and the frame-path switch. Reads `workflow.loopback`; every write is the whole object through
 * `setWorkflow`, so the fields this card does not edit stay as the classic UI saved them. The
 * maths and patches are `loopback.ts`; the sizes come from the pipeline's own `loopbackSizes`.
 */
import { useEffect, useState } from 'react';
import { Switch as MSwitch } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { DEFAULT_LOOPBACK, loopbackSizes } from '@/lib/pipeline';
import type { LoopbackRampKey, LoopbackSettings } from '@/lib/types';
import { Chip, SliderRow, Switch } from '~/ui';
import { T } from '~/theme/tokens';
import { RangeRow } from './RangeRow';
import {
  CFG_CHIPS, CFG_MAX, CFG_MIN, CFG_STEP, DENOISE_CHIPS, DENOISE_MAX, DENOISE_MIN, DENOISE_STEP,
  GROW_CHIPS, GROW_MAX, GROW_MIN, GROW_STEP, MAX_ROUNDS, MIN_ROUNDS, NOISE_CHIPS, NOISE_MAX, NOISE_MIN, NOISE_STEP,
  RAMP_KEYS, RAMP_LABELS, ROUND_CHIPS, STEP_CHIPS, STEPS_MAX, STEPS_MIN,
  clampRounds, defaultRamp, denoiseRange, fmtNum, growLabel, loopbackSummary,
  setCfg, setDenoise, setDenoiseRange, setEnabled, setFrameEnabled, setGrow, setNoise, setRamp, setRounds, setSameEveryRound, setSteps,
} from './loopback';
import { useUndoableSetWorkflow } from '~/app/undoableWorkflow';

const label11 = { fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' } as const;
const fmtGrow = (v: number) => `×${fmtNum(v)}`;
const fmtNoise = (v: number) => (v > 0 ? fmtNum(v) : 'off');

/**
 * With `value` + `onChange` it edits those settings instead of the main workflow's (the Refine
 * step keeps its own, fix list 15); `always` = no on / off switch (the step IS the rounds);
 * `size` = the picture the rounds start from, for the size label.
 */
export function LoopbackCard({ value, onChange, always = false, title = 'Loopback', size }: {
  value?: LoopbackSettings; onChange?: (lb: LoopbackSettings) => void; always?: boolean; title?: string; size?: { width: number; height: number } | null;
} = {}) {
  const saved = useStore((s) => s.workflow.loopback);
  const wfWidth = useStore((s) => s.workflow.width);
  const wfHeight = useStore((s) => s.workflow.height);
  const width = size?.width ?? wfWidth;
  const height = size?.height ?? wfHeight;
  const setWorkflow = useUndoableSetWorkflow();
  const own = value ?? saved ?? DEFAULT_LOOPBACK;
  const lb: LoopbackSettings = always ? { ...own, enabled: true } : own;
  const save = (next: LoopbackSettings) => (onChange ? onChange(next) : setWorkflow({ loopback: next }));

  const hasExtras = !!lb.ramps && Object.keys(lb.ramps).length > 0;
  const [more, setMore] = useState(() => hasExtras || (lb.noise ?? 0) > 0 || !!lb.frame?.enabled);

  const sizes = loopbackSizes(lb, width, height);
  const final = sizes[sizes.length - 1];
  const rounds = clampRounds(lb.iterations);
  const roundsChip = ROUND_CHIPS.includes(rounds) ? rounds : null;
  const toggleRamp = (k: LoopbackRampKey) => save(setRamp(lb, k, lb.ramps?.[k] ? undefined : defaultRamp(lb, k)));
  const fixed = (k: LoopbackRampKey) => () => save(setRamp(lb, k, undefined));

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: T.radius.xl, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span style={label11}>{title}</span>
            {lb.enabled && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {loopbackSummary(lb)}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: 'var(--il-muted)' }}>re-samples the image N times, growing it each round</span>
        </div>
        {!always && <MSwitch className="il-switch" checked={lb.enabled} onChange={(e) => save(setEnabled(lb, e.currentTarget.checked))} aria-label="Loopback on or off" color="ember" size="sm" style={{ flex: 'none' }} />}
      </div>

      {lb.enabled && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Rounds</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>×{rounds}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {ROUND_CHIPS.map((n) => <Chip key={n} small on={roundsChip === n} onClick={() => save(setRounds(lb, n))}>{n}</Chip>)}
              <RoundsBox value={rounds} on={roundsChip === null} onChange={(n) => save(setRounds(lb, n))} />
            </div>
          </div>

          {lb.ramps?.upscale ? (
            <RangeRow label="Grow per round" ramp={lb.ramps.upscale} min={GROW_MIN} max={GROW_MAX} step={GROW_STEP} hint={growLabel(width, height, final)}
              onChange={(r) => save(setRamp(lb, 'upscale', r))} onFixed={fixed('upscale')} />
          ) : (
            <SliderRow id="loopback.grow" defaultValue={DEFAULT_LOOPBACK.upscale} label="Grow per round" value={lb.upscale} min={GROW_MIN} max={GROW_MAX} step={GROW_STEP} presets={[...GROW_CHIPS]} format={fmtGrow}
              hint={`${growLabel(width, height, final)} after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}`} onChange={(v) => save(setGrow(lb, v))} />
          )}

          {lb.autoDenoise ? (
            <RangeRow label="Denoise" ramp={denoiseRange(lb)} min={DENOISE_MIN} max={DENOISE_MAX} step={DENOISE_STEP} onChange={(r) => save(setDenoiseRange(lb, r))} />
          ) : (
            <SliderRow id="loopback.denoise" defaultValue={DEFAULT_LOOPBACK.denoise} label="Denoise" value={lb.denoise} min={DENOISE_MIN} max={DENOISE_MAX} step={DENOISE_STEP} presets={[...DENOISE_CHIPS]} format={(v) => fmtNum(v)} onChange={(v) => save(setDenoise(lb, v))} />
          )}
          <Switch label="Same every round" checked={!lb.autoDenoise} onChange={(same) => save(setSameEveryRound(lb, same))} />

          {lb.ramps?.steps ? (
            <RangeRow label="Steps" ramp={lb.ramps.steps} min={STEPS_MIN} max={STEPS_MAX} step={1} digits={0} onChange={(r) => save(setRamp(lb, 'steps', r))} onFixed={fixed('steps')} />
          ) : (
            <SliderRow id="loopback.steps" defaultValue={DEFAULT_LOOPBACK.steps} label="Steps" value={lb.steps} min={STEPS_MIN} max={STEPS_MAX} step={1} presets={[...STEP_CHIPS]} onChange={(v) => save(setSteps(lb, v))} />
          )}
          {lb.ramps?.cfg ? (
            <RangeRow label="CFG" ramp={lb.ramps.cfg} min={CFG_MIN} max={CFG_MAX} step={CFG_STEP} digits={1} onChange={(r) => save(setRamp(lb, 'cfg', r))} onFixed={fixed('cfg')} />
          ) : (
            <SliderRow id="loopback.cfg" defaultValue={DEFAULT_LOOPBACK.cfg} label="CFG" value={lb.cfg} min={CFG_MIN} max={CFG_MAX} step={CFG_STEP} presets={[...CFG_CHIPS]} format={(v) => fmtNum(v, 1)} onChange={(v) => save(setCfg(lb, v))} />
          )}

          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: 0, border: 0, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderTop: '1px solid var(--il-line-strong)', paddingTop: 8, marginTop: -4 }}>
            {more ? <IconChevronDown size={14} stroke={2.6} /> : <IconChevronRight size={14} stroke={2.6} />}
            More
            {!more && hasExtras && <span style={{ fontWeight: 600 }}>· changes per round on</span>}
          </button>
          {more && (
            <>
              {lb.ramps?.noise ? (
                <RangeRow label="Noise" ramp={lb.ramps.noise} min={NOISE_MIN} max={NOISE_MAX} step={NOISE_STEP} onChange={(r) => save(setRamp(lb, 'noise', r))} onFixed={fixed('noise')} />
              ) : (
                <SliderRow id="loopback.noise" defaultValue={0} label="Noise" value={lb.noise ?? 0} min={NOISE_MIN} max={NOISE_MAX} step={NOISE_STEP} presets={[...NOISE_CHIPS]} format={fmtNoise}
                  hint="extra noise before each round samples: more new detail and grain" onChange={(v) => save(setNoise(lb, v))} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Changes per round</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {RAMP_KEYS.map((k) => <Chip key={k} small on={!!lb.ramps?.[k]} onClick={() => toggleRamp(k)} title={`${RAMP_LABELS[k]} ramp`}>{RAMP_LABELS[k]}</Chip>)}
                </div>
                <span style={{ fontSize: 10, color: 'var(--il-muted)' }}>{rounds > 1 ? 'a lit one moves from its first-round value to its last-round value' : 'needs 2 or more rounds; one round uses the first value'}</span>
              </div>
              {lb.frame && (
                <Switch label="Frame path (drawn in the classic UI)" checked={!!lb.frame.enabled} onChange={(on) => save(setFrameEnabled(lb, on))}
                  description="crops and zooms each round along the saved path" />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** The "other" rounds count: a small number box, 1–10, committed on blur / Enter. */
function RoundsBox({ value, on, onChange }: { value: number; on: boolean; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = clampRounds(Number(draft));
    setDraft(String(n));
    if (n !== value) onChange(n);
  };
  return (
    <input
      aria-label="Rounds"
      type="number"
      inputMode="numeric"
      min={MIN_ROUNDS}
      max={MAX_ROUNDS}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      style={{ width: 52, height: 26, border: `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-strong)'}`, borderRadius: 999, background: on ? 'var(--il-ember-soft)' : 'var(--il-panel)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '0 6px', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
    />
  );
}
