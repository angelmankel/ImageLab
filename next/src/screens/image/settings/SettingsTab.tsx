/**
 * The Settings tab of the Image step (rule 5): Detail, then Loopback (part of the base image — the
 * Image step runs it, Passes are dropped), then the sampling rows. Size lives in the Input tab
 * (Donny, 10-20).
 */
import { T } from '~/theme/tokens';
import { DetailCard } from './DetailCard';
import { LoopbackCard } from './LoopbackCard';
import { SamplingRows } from './SamplingRows';

export function SettingsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      <DetailCard />
      <LoopbackCard />
      <SamplingRows />
    </div>
  );
}
