/**
 * The sheets the HUD ring opens (mobile pass, m-shell): Jobs (the job queue, × per row, Cancel all;
 * the download queue under it) and Sessions (the open sessions = the desktop's tabs: tap to switch,
 * hold = the tab menu (close, rename, duplicate…), ＋ New, All sessions = Home).
 */
import { IconPlus } from '@tabler/icons-react';
import { useSessions, useOpenSessions, displayName } from '~/app/sessionsStore';
import { colorOf } from '~/app/sessionColor';
import { QueueList } from '~/screens/image/QueueList';
import { DownloadList } from '~/screens/image/queue/DownloadList';
import { useDownloadsStore } from '@/features/downloads/store';
import { SessionRing } from '~/screens/image/topbar/SessionTabs';
import { useSessionOutputs } from '~/screens/home/useSessionOutputs';
import { useRoute } from '~/app/routeStore';
import { T } from '~/theme/tokens';
import { menuProps } from '~/app/contextMenu';
import { BottomSheet } from '../BottomSheet';
import { useHud } from './hudStore';
import { phoneNav } from './navStore';

const close = () => useHud.setState({ sheet: null });

function Jobs() {
  const downloads = useDownloadsStore((s) => s.rows.length);
  return (
    <>
      <QueueList />
      {downloads > 0 && (
        <>
          <div className="il-eyebrow" style={{ margin: '16px 2px 8px' }}>Downloads</div>
          <DownloadList />
        </>
      )}
    </>
  );
}

function Sessions() {
  const tabs = useOpenSessions();
  const currentId = useSessions((s) => s.currentId);
  const outputs = useSessionOutputs();
  const open = (id: string) => {
    close();
    useSessions.getState().switchTo(id);
    useRoute.getState().go('step');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.sm }}>
      {tabs.map((s) => (
        <button key={s.id} type="button" {...menuProps('tab', s)} onClick={() => open(s.id)} aria-current={s.id === currentId || undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 12px', border: s.id === currentId ? '1px solid var(--il-ember-line)' : '1px solid var(--il-line)', borderRadius: T.radius.lg, background: s.id === currentId ? 'var(--il-card)' : 'var(--il-panel)', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
          <SessionRing color={colorOf(s)} item={outputs[s.id]?.last ?? null} size={36} bg="var(--il-panel)" />
          <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: s.name.trim() ? undefined : 'var(--il-dim)' }}>{displayName(s.name)}</span>
          {s.id === currentId && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--il-ember)' }}>Open</span>}
        </button>
      ))}
      <div style={{ display: 'flex', gap: T.gap.sm, marginTop: 4 }}>
        <button type="button" onClick={() => { close(); useSessions.getState().create(); useRoute.getState().go('step'); }}
          style={{ flex: 1, height: 48, border: '1px dashed var(--il-line-strong)', borderRadius: T.radius.lg, background: 'transparent', color: 'var(--il-fg2)', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
          <IconPlus size={16} stroke={2.6} />New session
        </button>
        <button type="button" onClick={() => { close(); phoneNav.root(); }}
          style={{ flex: 1, height: 48, border: 0, borderRadius: T.radius.lg, background: 'var(--il-elev)', color: 'var(--il-ember)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          All sessions
        </button>
      </div>
    </div>
  );
}

export function HudSheets() {
  const sheet = useHud((s) => s.sheet);
  return (
    <>
      <BottomSheet opened={sheet === 'jobs'} onClose={close} title="Jobs">{sheet === 'jobs' && <Jobs />}</BottomSheet>
      <BottomSheet opened={sheet === 'sessions'} onClose={close} title="Sessions">{sheet === 'sessions' && <Sessions />}</BottomSheet>
    </>
  );
}
