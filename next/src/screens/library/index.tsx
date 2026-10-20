/** Library screen (STUB — owned by the Library agent). Desktop: fills the area right of the rail. Phone: full screen + BackPill. */
import { BackPill } from '~/ui';
import { useRoute } from '~/app/routeStore';

export function LibraryScreen() {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>Library — being built</div>;
}

export function LibraryPhoneScreen() {
  const go = useRoute((s) => s.go);
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
      Library — being built
      <BackPill onClick={() => go('step')} />
    </div>
  );
}
