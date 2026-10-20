/**
 * The settings sections in order, plus the way back to the classic UI (the old app at
 * /imagelab/, one folder up from this one). Desktop lays them in columns; the phone in one list.
 */
import { IconExternalLink } from '@tabler/icons-react';
import { AiCard } from './AiCard';
import { CivitaiCard } from './CivitaiCard';
import { DisplayCard } from './DisplayCard';
import { ServersCard } from './ServersCard';
import { SoundsCard } from './SoundsCard';

export function SettingsSections() {
  return (
    <>
      <ServersCard />
      <AiCard />
      <CivitaiCard />
      <DisplayCard />
      <SoundsCard />
    </>
  );
}

export function ClassicLink() {
  return (
    <a href="../" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>
      Open the classic UI<IconExternalLink size={13} />
    </a>
  );
}
