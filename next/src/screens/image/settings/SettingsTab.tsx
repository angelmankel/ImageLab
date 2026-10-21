/**
 * The Parameters tab of the Image step (rule 5): Detail, then the sampling rows. Size lives in
 * Composition (Donny, 10-20). Loopback left the base image (fix list 15): it is the Refine step now.
 */
import { T } from '~/theme/tokens';
import { useStore } from '@/lib/store';
import { Collapse } from '~/ui';
import { DetailCard } from './DetailCard';
import { SamplingRows } from './SamplingRows';

/** The folded Sampling section's one line: sampler · scheduler · seed. */
function SamplingSummary() {
  const sampler = useStore((s) => s.workflow.sampler);
  const scheduler = useStore((s) => s.workflow.scheduler);
  const seed = useStore((s) => s.workflow.seed);
  const random = useStore((s) => s.workflow.randomizeSeed);
  return <>{sampler} · {scheduler} · {random ? 'random seed' : `seed ${seed}`}</>;
}

export function SettingsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      <DetailCard />
      <Collapse id="params.sampling" label="Sampling" preview={<SamplingSummary />}><SamplingRows /></Collapse>
    </div>
  );
}
