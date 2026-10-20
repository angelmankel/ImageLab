/**
 * The top nav (fix list 36 / 19): ← Home · logo + wordmark (also → Home) · | · the session tab
 * strip (fills the width) · | · server chip ("This pod · B200") · "Queue 2 · ↓ 1" · mute · fullscreen
 * far right. The clock and the keyboard shortcuts live in the footer (`Footer.tsx`). The queue
 * pill opens the queue list (rule 15). No session component here: the session's name is the left
 * panel's title (`SessionTitle`).
 */
import { useState } from 'react';
import { Popover } from '@mantine/core';
import { IconListDetails, IconArrowDown, IconArrowLeft } from '@tabler/icons-react';
import { useDownloadsStore } from '@/features/downloads/store';
import { useRoute } from '~/app/routeStore';
import { useQueue } from '~/app/queue';
import { Pill, Count, IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { QueueList } from './QueueList';
import { FullscreenBtn } from './topbar/FullscreenBtn';
import { ServerChip } from './servers/ServerChip';
import { MuteToggle } from '~/ui/MuteToggle';
import './topbar/shell.css';
import { SessionTabs } from './topbar/SessionTabs';

/** The tall hairline that frames the tab strip (fix list 36: after the logo, before the right-side items). */
function Divider() {
  return <span aria-hidden style={{ width: 1, height: 26, background: 'var(--il-line-strong)', margin: '0 6px', flex: 'none' }} />;
}

export function Wordmark({ size = 17 }: { size?: number }) {
  return <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.4px', whiteSpace: 'nowrap' }}>Image<span style={{ color: 'var(--il-ember)' }}>Lab</span></span>;
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: 'var(--il-ember)', display: 'grid', placeItems: 'center', flex: 'none' }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none"><path d="M12 2.5c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2 .8-3.4 1.8-4.6.3 1.6 1.2 2.6 2.4 2.6 1.6 0 2.3-1.8 1.3-4.5C11.6 5.2 11.6 3.8 12 2.5z" fill="#141416" /><circle cx="12" cy="14.5" r="2.2" fill="#FFF1E6" /></svg>
    </div>
  );
}

/** "Queue 2 · ↓ 1": opens the queue list; the downloads count is the active model downloads. */
function QueuePill() {
  const { rows } = useQueue();
  const downloading = useDownloadsStore((s) => s.rows.filter((r) => r.status === 'downloading').length);
  const [open, setOpen] = useState(false);
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" width={340} withinPortal zIndex={T.z.popover}>
      <Popover.Target>
        <span style={{ display: 'inline-flex' }}>
          <Pill onClick={() => setOpen((o) => !o)} title="Queue" active={open}>
            <IconListDetails size={16} />Queue <Count n={rows.length} tone={rows.length ? 'ember' : 'muted'} /><span style={{ color: 'var(--il-muted)' }}>·</span><IconArrowDown size={14} stroke={2.4} />{downloading}
          </Pill>
        </span>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.xl, padding: T.pad.panel }}>
        <div className="il-eyebrow" style={{ margin: '2px 2px 8px' }}>Queue</div>
        <div className="il-scroll" style={{ maxHeight: 360 }}><QueueList /></div>
      </Popover.Dropdown>
    </Popover>
  );
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
      <Divider />
      <SessionTabs />
      <Divider />
      <ServerChip />
      <QueuePill />
      <MuteToggle />
      <FullscreenBtn />
    </div>
  );
}
