/**
 * Settings on the phone: one scrolling list of the same cards, the classic-UI link at the end,
 * and the centred Back pill (rule 11: no dock where nothing is generated).
 */
import { useRoute } from '~/app/routeStore';
import { BackPill } from '~/ui';
import { SettingsSections, ClassicLink } from './SettingsBody';

export function SettingsPhoneScreen() {
  const go = useRoute((s) => s.go);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
        <span style={{ fontWeight: 800, fontSize: 18 }}>Settings</span>
        <ClassicLink />
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '10px 14px 100px', touchAction: 'pan-y' }}>
        <SettingsSections />
      </div>
      <BackPill onClick={() => go('step')} />
    </div>
  );
}
