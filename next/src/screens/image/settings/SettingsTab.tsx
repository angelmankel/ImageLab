/**
 * The Parameters tab of the Image step (rule 5): Detail, then the sampling rows. Size lives in
 * Composition (Donny, 10-20). Loopback left the base image (fix list 15): it is the Refine step now.
 */
import { T } from '~/theme/tokens';
import { DetailCard } from './DetailCard';
import { SamplingRows } from './SamplingRows';

export function SettingsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      <DetailCard />
      <SamplingRows />
    </div>
  );
}
