/**
 * Settings, desktop: fills the area right of the rail; a title row (with "Open the classic UI"),
 * then the section cards in columns (360 min each), scrolling. Panel padding 10, gaps 10.
 */
import { SettingsSections, ClassicLink } from './SettingsBody';

export function SettingsScreen() {
  return (
    <div className="il-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 1180, padding: '14px 16px 24px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '0 2px 12px' }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.2px' }}>Settings</span>
          <ClassicLink />
        </div>
        <div style={{ columnWidth: 360, columnGap: 10 }}>
          <SettingsSections />
        </div>
      </div>
    </div>
  );
}
