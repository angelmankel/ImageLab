/**
 * The top nav (fix list 36 / 19): ← Home · logo + wordmark (also → Home) · Undo / Redo (list 2 #12) · | · the session tab
 * strip (fills the width) · | · server chip ("This pod · B200") · "Jobs 2" · "↓ 1 · 37%" · mute ·
 * fullscreen far right. The clock and the keyboard shortcuts live in the footer (`Footer.tsx`). The
 * queue is split in two (item 14, `queue/QueueButtons`): the job queue and the download queue. No session component here: the session's name is the left
 * panel's title (`SessionTitle`).
 */
import { IconArrowLeft } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { JobQueueButton, DownloadQueueButton } from './queue/QueueButtons';
import { FullscreenBtn } from './topbar/FullscreenBtn';
import { ServerChip } from './servers/ServerChip';
import { MuteToggle } from '~/ui/MuteToggle';
import './topbar/shell.css';
import { SessionTabs } from './topbar/SessionTabs';
import { LogoMark, LogoWordmark } from '~/app/logo';
import { UndoButtons } from './topbar/UndoButtons';

/** The tall hairline that frames the tab strip (fix list 36: after the logo, before the right-side items). */
function Divider() {
  return <span aria-hidden style={{ width: 1, height: 26, background: 'var(--il-line-strong)', margin: '0 6px', flex: 'none' }} />;
}

/** The chosen logo's wordmark (fix list 47: Settings → Appearance → Logo). */
export function Wordmark({ size = 17 }: { size?: number }) {
  return <LogoWordmark size={size} />;
}

/** The chosen logo's mark. */
export function Logo({ size = 32 }: { size?: number }) {
  return <LogoMark size={size} />;
}

export function TopBar() {
  const screen = useRoute((s) => s.screen);
  const home = screen === 'home';
  return (
    <div style={{ height: T.size.topBar, flex: 'none', display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: '0 12px 0 10px', borderBottom: '1px solid var(--il-line)' }}>
      <IconBtn icon={<IconArrowLeft size={20} stroke={2.4} />} label="Home: all sessions" onClick={() => useRoute.getState().go('home')} on={home} />
      <button type="button" onClick={() => useRoute.getState().go('home')} aria-label="ImageLab: all sessions"
        style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 2, border: 0, padding: 0, background: 'transparent', color: 'var(--il-fg)', cursor: 'pointer', flex: 'none' }}>
        <Logo size={30} />
        <Wordmark />
      </button>
      <UndoButtons />
      <Divider />
      <SessionTabs />
      <Divider />
      <ServerChip />
      <JobQueueButton />
      <DownloadQueueButton />
      <MuteToggle />
      <FullscreenBtn />
    </div>
  );
}
