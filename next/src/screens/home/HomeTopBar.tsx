/**
 * Home's own top bar (fix list 2 #14): logo + wordmark · Undo / Redo · the four places as labelled
 * pills (History, Models, ComfyUI, Settings — the rail's icons) · "Back to <session>" · Jobs ·
 * Mute · Fullscreen. On the phone: logo · Mute, and the places as a sideways-scrolling pill row
 * under it (40px tall). No session tab strip and no step rail: Home is its own page.
 */
import { IconCube, IconHistory, IconSettings, IconTopologyStar3 } from '@tabler/icons-react';
import { useRoute, type Screen } from '~/app/routeStore';
import { useSessions, displayName } from '~/app/sessionsStore';
import { colorOf } from '~/app/sessionColor';
import { MuteToggle } from '~/ui/MuteToggle';
import { Logo, Wordmark } from '~/screens/image/TopBar';
import { UndoButtons } from '~/screens/image/topbar/UndoButtons';
import { FullscreenBtn } from '~/screens/image/topbar/FullscreenBtn';
import { SessionRing } from '~/screens/image/topbar/SessionTabs';
import { JobQueueButton } from '~/screens/image/queue/QueueButtons';
import type { SessionOutput } from './useSessionOutputs';

export const HOME_PLACES: ReadonlyArray<{ key: Screen; label: string; icon: typeof IconHistory }> = [
  { key: 'library', label: 'History', icon: IconHistory },
  { key: 'models', label: 'Models', icon: IconCube },
  { key: 'comfy', label: 'ComfyUI', icon: IconTopologyStar3 },
  { key: 'settings', label: 'Settings', icon: IconSettings },
];

export function PlacePills({ phone = false }: { phone?: boolean }) {
  return (
    <nav aria-label="Places" style={{ display: 'flex', gap: phone ? 6 : 2, minWidth: 0 }}>
      {HOME_PLACES.map((p) => (
        <button key={p.key} type="button" className="il-btn il-home-place" onClick={() => useRoute.getState().go(p.key)}
          style={{ height: 40, padding: '0 14px 0 12px', borderRadius: 999, border: 0, display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none',
            background: phone ? 'var(--il-panel)' : 'transparent', color: 'var(--il-fg2)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <p.icon size={17} stroke={2.1} />{p.label}
        </button>
      ))}
    </nav>
  );
}

/** "Back to <the current session>" in its colour ring: one tap back into the work. */
function ResumePill({ outputs }: { outputs: Record<string, SessionOutput> }) {
  const cur = useSessions((s) => s.sessions[s.currentId]);
  if (!cur) return null;
  const name = displayName(cur.name);
  return (
    <button type="button" className="il-btn il-btn-primary" onClick={() => useRoute.getState().go('step')} aria-label={`Back to ${name}`}
      style={{ height: 40, maxWidth: 280, minWidth: 0, padding: '0 16px 0 6px', borderRadius: 999, border: 0, display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'var(--il-ember)', color: 'var(--il-bg)', fontFamily: 'inherit', fontSize: 13, fontWeight: 800 }}>
      <SessionRing color={colorOf(cur)} item={outputs[cur.id]?.last ?? null} size={30} bg="var(--il-ember)" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Back to {name}</span>
    </button>
  );
}

export function HomeTopBar({ outputs }: { outputs: Record<string, SessionOutput> }) {
  return (
    <header style={{ height: 64, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 0 18px', background: 'var(--il-bg)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <Logo size={34} />
        <Wordmark size={19} />
      </span>
      <span style={{ display: 'flex', gap: 2, marginLeft: 6 }}><UndoButtons /></span>
      <span aria-hidden style={{ width: 1, height: 26, background: 'var(--il-line-strong)', margin: '0 10px', flex: 'none' }} />
      <PlacePills />
      <span style={{ flex: 1 }} />
      <ResumePill outputs={outputs} />
      <JobQueueButton />
      <MuteToggle size={40} />
      <FullscreenBtn />
    </header>
  );
}
