/** Comfy screen (STUB — owned by the Comfy agent). Desktop: fills the area right of the rail. Phone: full screen + BackPill. */
import { BackPill } from '~/ui';
import { useRoute } from '~/app/routeStore';

export function ComfyScreen() {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>Comfy — being built</div>;
}

export function ComfyPhoneScreen() {
  const go = useRoute((s) => s.go);
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}>
      Comfy — being built
      <BackPill onClick={() => go('step')} />
    </div>
  );
}
