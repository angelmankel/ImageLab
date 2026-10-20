/** The Settings tab of the Image step (rule 5): size first, then Detail, then the sampling rows. */
import { T } from '~/theme/tokens';
import { SizeControl } from './SizeControl';
import { DetailCard } from './DetailCard';
import { SamplingRows } from './SamplingRows';

export function SettingsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      <SizeControl />
      <DetailCard />
      <SamplingRows />
    </div>
  );
}
