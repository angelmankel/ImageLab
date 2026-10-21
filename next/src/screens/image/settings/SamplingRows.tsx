/**
 * Sampler · Scheduler · Seed · Clip skip (rule 5): compact 44px rows, two per line. The ×N batch is on
 * the Generate button (its cycle list is in Settings → Generate, fix list 2 #25); the phone, whose
 * Generate is the dock orb, keeps one tap-to-cycle "Images per run" row here.
 * Sampler and scheduler from the servers' lists; the seed box with a dice (new seed now) and a
 * lock (keep this seed vs a new one every run = `randomizeSeed`); clip skip as a full-width − / + box
 * (SD 1.5 / SDXL only).
 */
import { useMemo, type ReactNode } from 'react';
import { IconDice5, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { DEFAULT_CLIP_SKIP } from '@/lib/pipeline';
import { IconBtn, NumberField, SearchSelect, Tip, samplerFamily, SAMPLER_NOTES, type SelectOption } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { nextInCycle, useCycleList } from '~/app/batchCycle';
import { useUndoableSetWorkflow } from '~/app/undoableWorkflow';
import { useImageDefaults } from '~/app/paramDefaults';
import { useModelProfile } from '@/hooks/useModelProfileSync';

const MAX_SEED = 0xFFFFFFFF;
const newSeed = () => Math.floor(Math.random() * MAX_SEED);
/** Clip skip runs -1 (off) … -12; only the SD 1.5 / SDXL graphs have a CLIPSetLastLayer. */
const CLIP_MIN = -12;
const CLIP_MAX = -1;
const CLIP_FAMILIES = new Set(['sd15', 'sdxl']);

function Row({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  const name = <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', flex: 'none', cursor: hint ? 'help' : undefined }}>{label}</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 44, padding: '0 6px 0 12px', borderRadius: T.radius.lg, background: 'var(--il-card)', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      {hint ? <Tip hint={hint}>{name}</Tip> : name}
      {children}
    </div>
  );
}

/**
 * A dropdown that is also a search box (Donny 10-20: autocomplete): the shared `SearchSelect`
 * (item 38) in its bare in-row form: type to filter with the match highlighted, ↑ ↓ Enter, groups.
 */
function Pick({ label, value, options, onChange, searchable = true, defaultValue }: { label: string; value: string; options: SelectOption[]; onChange: (v: string) => void; searchable?: boolean; defaultValue?: string }) {
  const phone = useIsPhone();
  return (
    <SearchSelect bare label={label} value={value} options={options} onChange={onChange} searchable={searchable} defaultValue={defaultValue}
      size={phone ? 'lg' : 'md'} position="bottom-end" dropdownWidth={260} style={{ flex: 1, minWidth: 0 }} />
  );
}

/** Phone only: the batch as one tap-to-cycle pill (the desktop has it on Generate). */
function BatchRow() {
  const batch = useStore((s) => s.workflow.batch);
  const set = useUndoableSetWorkflow();
  const list = useCycleList();
  return (
    <Row label="Images per run">
      <button type="button" className="il-btn" aria-label={`Images per run: ×${batch}`} onClick={() => set({ batch: nextInCycle(list, batch) })}
        style={{ height: 40, minWidth: 56, padding: '0 14px', border: 0, borderRadius: 999, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        ×{batch}
      </button>
    </Row>
  );
}

export function SamplingRows() {
  const w = useStore((s) => s.workflow);
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  const set = useUndoableSetWorkflow();
  const clip = w.clipSkip ?? DEFAULT_CLIP_SKIP;
  const d = useImageDefaults();
  // Flux / Anima / Z-Image / Qwen load their own text encoder: no clip skip there (unknown type: shown).
  const { profile } = useModelProfile();
  const clipApplies = !profile || CLIP_FAMILIES.has(profile.family);

  const phone = useIsPhone();
  const samplerOptions = useMemo(() => samplers.map((s) => ({ value: s, group: samplerFamily(s), description: SAMPLER_NOTES[s] })), [samplers]);
  const schedulerOptions = useMemo(() => schedulers.map((s) => ({ value: s })), [schedulers]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: T.gap.md }}>
      <Row label="Sampler" hint="sampler" wide><Pick label="Sampler" value={w.sampler} options={samplerOptions} defaultValue={d.sampler} onChange={(sampler) => set({ sampler })} /></Row>
      <Row label="Scheduler" hint="scheduler" wide><Pick label="Scheduler" value={w.scheduler} options={schedulerOptions} defaultValue={d.scheduler} onChange={(scheduler) => set({ scheduler })} /></Row>
      <Row label="Seed" hint="seed" wide>
        <NumberField label="Seed" value={w.seed} min={0} max={MAX_SEED} step={1} steppers={false} size={phone ? 'lg' : 'sm'}
          onChange={(seed) => set({ seed })} style={{ flex: 1, minWidth: 0, color: w.randomizeSeed ? 'var(--il-muted)' : 'var(--il-fg)' }} />
        <IconBtn size={phone ? 40 : 30} tone="card" icon={<IconDice5 size={16} />} label="New seed now" onClick={() => set({ seed: newSeed() })} />
        <IconBtn size={phone ? 40 : 30} tone="card" hint="seed.lock" on={!w.randomizeSeed} icon={w.randomizeSeed ? <IconLockOpen size={16} /> : <IconLock size={16} />}
          label={w.randomizeSeed ? 'New seed every run' : 'Seed kept'} onClick={() => set({ randomizeSeed: !w.randomizeSeed })} />
      </Row>
      {phone && <BatchRow />}
      {clipApplies && (
        <Row label="Clip skip" hint="clipSkip" wide>
          <NumberField label="Clip skip" value={clip} min={CLIP_MIN} max={CLIP_MAX} step={1} size={phone ? 'lg' : 'sm'} width={phone ? 168 : 132}
            format={(n) => (n === -1 ? 'off' : String(n))} defaultValue={d.clipSkip} onChange={(clipSkip) => set({ clipSkip })} />
        </Row>
      )}
    </div>
  );
}
