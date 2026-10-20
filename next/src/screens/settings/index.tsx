/** Settings screen (STUB — owned by the Settings agent). Desktop: fills the area right of the rail. Phone: full screen + BackPill. */
import { BackPill } from '~/ui';
import { useRoute } from '~/app/routeStore';

export function SettingsScreen() {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>Settings — being built</div>;
}

export function SettingsPhoneScreen() {
  const go = useRoute((s) => s.go);
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
      Settings — being built
      <BackPill onClick={() => go('step')} />
    </div>
  );
}
