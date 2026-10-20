/**
 * The Settings tab of the Image step (rule 5): size first, then Detail, then Loopback (part of the
 * base image — the Image step runs it, Passes are dropped), then the sampling rows.
 */
import { T } from '~/theme/tokens';
import { SizeControl } from './SizeControl';
import { DetailCard } from './DetailCard';
import { LoopbackCard } from './LoopbackCard';
import { SamplingRows } from './SamplingRows';

export function SettingsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      <SizeControl />
      <DetailCard />
      <LoopbackCard />
      <SamplingRows />
    </div>
  );
}
