/**
 * Rule 9: ember logo + "ImageLab", session name ▾, then on the right: clock, keyboard shortcuts,
 * fullscreen, status pill ("This pod · B200"), "Queue 2 · ↓ 1". Nothing else. The queue pill opens the queue list (rule 15); the session menu is the named set
 * of steps (one session for now: the current one).
 */
import { useState } from 'react';
import { Menu, Modal, Popover, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFolder, IconListDetails, IconArrowDown, IconCheck, IconPencil, IconPlus } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { servedFromHost } from '@/lib/storage';
import { canRunImages } from '@/lib/serverRoles';
import { useDownloadsStore } from '@/features/downloads/store';
import { useModeHost } from '@/features/workspace/modeHost';
import { useSteps } from '~/app/stepsStore';
import { useQueue } from '~/app/queue';
import { Pill, Count, Dot } from '~/ui';
import { T } from '~/theme/tokens';
import { QueueList } from './QueueList';
import { useGpuName } from './useGpuName';
import { Clock } from './topbar/Clock';
import { ShortcutsCard } from './topbar/ShortcutsCard';
import { FullscreenBtn } from './topbar/FullscreenBtn';

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: 'var(--il-ember)', display: 'grid', placeItems: 'center', flex: 'none' }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none"><path d="M12 2.5c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2 .8-3.4 1.8-4.6.3 1.6 1.2 2.6 2.4 2.6 1.6 0 2.3-1.8 1.3-4.5C11.6 5.2 11.6 3.8 12 2.5z" fill="#141416" /><circle cx="12" cy="14.5" r="2.2" fill="#FFF1E6" /></svg>
    </div>
  );
}

/** The session name with its menu: the current session (checked), rename, new. */
function SessionMenu() {
  const name = useSteps((s) => s.sessionName);
  const rename = useSteps((s) => s.renameSession);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  return (
    <>
      <Menu position="bottom-start" shadow="lg" width={240} withinPortal zIndex={T.z.popover}>
        <Menu.Target>
          <span style={{ display: 'inline-flex' }}>
            <Pill onClick={() => {}} style={{ marginLeft: 8, color: 'var(--il-fg)', fontSize: 13 }} title="Session">
              <IconFolder size={15} color="var(--il-muted)" />{name}<span style={{ color: 'var(--il-muted)' }}>▾</span>
            </Pill>
          </span>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Sessions</Menu.Label>
          <Menu.Item leftSection={<IconCheck size={14} />}>{name}</Menu.Item>
          <Menu.Divider />
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => { setDraft(name); setRenaming(true); }}>Rename…</Menu.Item>
          <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => notifications.show({ title: 'Sessions', message: 'Saving more than one session is coming.', color: 'gray', autoClose: 2500 })}>New session</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={renaming} onClose={() => setRenaming(false)} title="Rename the session" size="xs" zIndex={T.z.modal} centered>
        <form onSubmit={(e) => { e.preventDefault(); rename(draft); setRenaming(false); }} style={{ display: 'flex', gap: 6 }}>
          <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} data-autofocus style={{ flex: 1 }} aria-label="Session name" />
          <button type="submit" style={{ height: 36, padding: '0 14px', border: 0, borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Save</button>
        </form>
      </Modal>
    </>
  );
}

/** "This pod · B200": the image server this page is served from (or the first online one). */
function StatusPill() {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const origin = servedFromHost();
  const candidates = servers.filter((s) => s.enabled !== false && canRunImages(s));
  const server = candidates.find((s) => s.host === origin) ?? candidates.find((s) => !!serverInfo[s.id]) ?? candidates[0] ?? null;
  const online = !!server && !!serverInfo[server.id];
  const gpu = useGpuName(online ? server!.host : null);
  // The pod's second ComfyUI for video (`/video-comfy`), when it differs from the image server.
  const videoHost = useModeHost('video');
  const video = !!videoHost && videoHost !== server?.host;
  const label = server ? (server.host === origin ? 'This pod' : server.name) : 'No server';
  return (
    <Pill title={`${server ? `${server.name} · ${server.host}${online ? '' : ' · offline'}` : 'Add a server in Settings'}${video ? ` · video on ${videoHost}` : ''}`}>
      <Dot color={online ? 'var(--il-ok)' : 'var(--il-err)'} />{label}{gpu ? ` · ${gpu}` : ''}{video ? ' · video' : ''}
    </Pill>
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
  return (
    <div style={{ height: T.size.topBar, flex: 'none', display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: '0 16px', borderBottom: '1px solid var(--il-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: T.gap.sm }}>
        <Logo />
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.4px' }}>Image<span style={{ color: 'var(--il-ember)' }}>Lab</span></span>
      </div>
      <SessionMenu />
      <div style={{ flex: 1 }} />
      <Clock />
      <ShortcutsCard />
      <FullscreenBtn />
      <StatusPill />
      <QueuePill />
    </div>
  );
}
