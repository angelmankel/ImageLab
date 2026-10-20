/**
 * The dock's "More" (rule 11): a bottom sheet with the places that do not generate — Models ·
 * ComfyUI · Settings — and the session: its name (tap to rename in place) and All sessions → Home. Each place opens full screen with its own Back pill.
 */
import type { ReactNode } from 'react';
import { Drawer } from '@mantine/core';
import { IconChevronRight, IconCube, IconFolder, IconSettings, IconTopologyStar3 } from '@tabler/icons-react';
import { useRoute, type Screen } from '~/app/routeStore';
import { T } from '~/theme/tokens';
import { usePhone } from './phoneStore';
import { SessionTitle } from '~/screens/image/SessionTitle';

const PLACES: Array<{ key: Screen; label: string; hint: string; icon: ReactNode }> = [
  { key: 'models', label: 'Models', hint: 'Browse and download from CivitAI', icon: <IconCube size={20} stroke={2.1} /> },
  { key: 'comfy', label: 'ComfyUI', hint: 'Servers, saved workflows, queue', icon: <IconTopologyStar3 size={20} stroke={2.1} /> },
  { key: 'settings', label: 'Settings', hint: 'The app', icon: <IconSettings size={20} stroke={2.1} /> },
];

function SheetRow({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 56, padding: '0 12px', border: 0, borderRadius: T.radius.lg, background: 'var(--il-card)', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--il-ember-soft)', color: 'var(--il-ember)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</span>}
      </span>
      <IconChevronRight size={16} color="var(--il-muted)" />
    </button>
  );
}

export function MoreSheet() {
  const open = usePhone((s) => s.moreOpen);
  const setOpen = usePhone((s) => s.setMoreOpen);
  const go = useRoute((s) => s.go);
  const to = (s: Screen) => { setOpen(false); go(s); };
  return (
    <Drawer
      opened={open}
      onClose={() => setOpen(false)}
      position="bottom"
      size="auto"
      withCloseButton={false}
      zIndex={T.z.sheet}
      radius={22}
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
      styles={{
        content: { background: 'var(--il-panel)', borderTop: '1px solid var(--il-line-soft)' },
        body: { padding: `8px ${T.pad.panel}px calc(14px + var(--il-safe-bottom))` },
      }}
    >
      <div aria-hidden style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--il-line-strong)', margin: '0 auto 12px' }} />
      <div className="il-eyebrow" style={{ padding: '0 4px 6px' }}>Session</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 6px 0 12px', borderRadius: T.radius.lg, background: 'var(--il-elev)', marginBottom: 14 }}>
        <IconFolder size={16} color="var(--il-muted)" style={{ flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}><SessionTitle size={14} /></span>
        <button type="button" onClick={() => to('home')}
          style={{ height: 40, padding: '0 10px', border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 800, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap' }}>
          All sessions ›
        </button>
      </div>
      <div className="il-eyebrow" style={{ padding: '0 4px 6px' }}>Go to</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.sm }}>
        {PLACES.map((p) => <SheetRow key={p.key} icon={p.icon} label={p.label} hint={p.hint} onClick={() => to(p.key)} />)}
      </div>
    </Drawer>
  );
}
