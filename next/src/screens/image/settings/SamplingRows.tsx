/**
 * Sampler · Scheduler · Seed · Batch · Clip skip (rule 5): compact 44px rows, two per line. Batch =
 * the step's ×N cycle list + the current ×N (item 18, `BatchCycleRow`; desktop also has ×N on Generate).
 * Sampler and scheduler from the servers' lists; the seed box with a dice (new seed now) and a
 * lock (keep this seed vs a new one every run = `randomizeSeed`); clip skip
 * as a pick.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Select } from '@mantine/core';
import { IconChevronDown, IconDice5, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { DEFAULT_CLIP_SKIP } from '@/lib/pipeline';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { BatchCycleRow } from './BatchCycleRow';

const MAX_SEED = 0xFFFFFFFF;
const newSeed = () => Math.floor(Math.random() * MAX_SEED);
const CLIP_SKIPS = [-1, -2, -3, -4];

function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 44, padding: '0 8px 0 12px', borderRadius: T.radius.lg, background: 'var(--il-card)', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>{label}</span>
      {children}
    </div>
  );
}

const SELECT_STYLES = {
  input: { background: 'transparent', border: 0, fontWeight: 700, fontSize: 12, color: 'var(--il-fg)', textAlign: 'right' as const, paddingRight: 22, height: 32, minHeight: 32 },
  dropdown: { background: 'var(--il-panel)', borderColor: 'var(--il-line-soft)' },
  option: { fontSize: 12, fontWeight: 600 },
};

/** A dropdown that is also a search box (Donny 10-20: autocomplete): type to filter, Enter / tap picks. Only real options can be picked. */
function Pick({ label, value, options, onChange, searchable = true }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void; searchable?: boolean }) {
  const data = options.some((o) => o.value === value) || !value ? options : [{ value, label: value }, ...options];
  return (
    <Select
      aria-label={label}
      data={data}
      value={value}
      onChange={(v) => v && onChange(v)}
      allowDeselect={false}
      searchable={searchable}
      nothingFoundMessage="No match"
      onFocus={(e) => e.currentTarget.select()}
      size="xs"
      rightSection={<IconChevronDown size={14} stroke={2.6} />}
      rightSectionWidth={22}
      comboboxProps={{ withinPortal: true, zIndex: T.z.popover, position: 'bottom-end', width: 220 }}
      styles={SELECT_STYLES}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
}

export function SamplingRows() {
  const w = useStore((s) => s.workflow);
  const samplers = useStore((s) => s.server.samplers);
  const schedulers = useStore((s) => s.server.schedulers);
  const set = useStore((s) => s.setWorkflow);
  const clip = w.clipSkip ?? DEFAULT_CLIP_SKIP;

  const [seedDraft, setSeedDraft] = useState(String(w.seed));
  useEffect(() => { setSeedDraft(String(w.seed)); }, [w.seed]);
  const commitSeed = () => {
    const n = Math.max(0, Math.min(MAX_SEED, Math.trunc(Number(seedDraft)) || 0));
    setSeedDraft(String(n));
    if (n !== w.seed) set({ seed: n });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: T.gap.md }}>
      <Row label="Sampler" wide><Pick label="Sampler" value={w.sampler} options={samplers.map((s) => ({ value: s, label: s }))} onChange={(sampler) => set({ sampler })} /></Row>
      <Row label="Scheduler" wide><Pick label="Scheduler" value={w.scheduler} options={schedulers.map((s) => ({ value: s, label: s }))} onChange={(scheduler) => set({ scheduler })} /></Row>
      <Row label="Seed" wide>
        <input
          aria-label="Seed"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SEED}
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.currentTarget.value)}
          onBlur={commitSeed}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          title={w.randomizeSeed ? 'A new seed is rolled for every run' : 'This seed is used as set'}
          style={{ flex: 1, minWidth: 0, height: 30, border: '1px solid var(--il-line-strong)', borderRadius: 8, background: 'var(--il-panel)', color: w.randomizeSeed ? 'var(--il-muted)' : 'var(--il-fg)', fontSize: 12, fontWeight: 700, textAlign: 'right', padding: '0 8px', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
        />
        <IconBtn size={30} tone="card" icon={<IconDice5 size={16} />} label="New seed now" onClick={() => set({ seed: newSeed() })} />
        <IconBtn size={30} tone="card" on={!w.randomizeSeed} icon={w.randomizeSeed ? <IconLockOpen size={16} /> : <IconLock size={16} />}
          label={w.randomizeSeed ? 'New seed every run · tap to keep this seed' : 'Seed kept · tap for a new seed every run'} onClick={() => set({ randomizeSeed: !w.randomizeSeed })} />
      </Row>
      <BatchCycleRow />
      <Row label="Clip skip">
        <Pick searchable={false} label="Clip skip" value={String(clip)} options={CLIP_SKIPS.map((n) => ({ value: String(n), label: n === -1 ? 'off' : String(n) }))} onChange={(v) => set({ clipSkip: Number(v) })} />
      </Row>
    </div>
  );
}
