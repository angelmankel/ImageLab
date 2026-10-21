/**
 * Rule 14 on the phone (rule 11: no dock here, one centred Back pill). Header: "ComfyUI" + the
 * server picker pill (FIXLIST-2 #52); a segmented row Servers · Workflows · Queue; one list per segment.
 * No iframe on a phone: "Open ComfyUI" opens the server's page in a new tab (the node editor needs
 * a mouse and room). Landscape (mobile pass): workflows left, Queue · Log · Servers right.
 */
import { useState } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { useVideoServerProbe } from '@/hooks/useVideoServerProbe';
import { serverRole } from '@/lib/serverRoles';
import { useRoute } from '~/app/routeStore';
import { usePhoneLandscape } from '~/app/useIsPhone';
import { PhoneTwoPane } from '~/phone';
import { LandBack } from '~/screens/browseKit/LandBack';
import { BackPill, Count, Dot, Tabs } from '~/ui';
import { comfyPageUrl } from './comfyApi';
import { LogBox } from './LogBox';
import { QueueList } from './QueueList';
import { ServerStatus } from './ServerStatus';
import { ServerPicker } from './ServerPicker';
import { useComfyHost } from './useComfyHost';
import { useComfyServer, type ComfyServerPick } from './useComfyServer';
import { useComfyWorkflows } from './useComfyWorkflows';
import { WorkflowList } from './WorkflowList';
import { useServersUp } from '~/screens/settings/useServersUp';
import { ParamMapModal } from '~/screens/image/workflow/ParamMapModal';

type Seg = 'servers' | 'workflows' | 'queue';

const ROLE_LABEL = { both: 'Images + video', image: 'Images', video: 'Video' } as const;

function ServerList({ pick, online, up }: { pick: ComfyServerPick; online: boolean | null; up: Record<string, boolean> }) {
  const go = useRoute((s) => s.go);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Servers</span>
        <button type="button" onClick={() => go('settings')} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 700, padding: '4px 2px', cursor: 'pointer' }}>Edit</button>
      </div>
      <div style={{ background: 'var(--il-card)', borderRadius: 20, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pick.servers.map((s) => {
          const on = s.id === pick.server?.id;
          const answering = on ? !!online : !!up[s.id];
          const off = s.enabled === false;
          return (
            <button key={s.id} type="button" onClick={() => pick.select(s)} disabled={off} aria-pressed={on}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 10px', border: 0, borderRadius: 14, background: on ? 'var(--il-card-on)' : 'transparent', color: 'var(--il-fg)', textAlign: 'left', opacity: off ? 0.5 : 1, cursor: 'pointer' }}>
              <Dot color={off ? 'var(--il-dim)' : answering ? 'var(--il-ok)' : 'var(--il-err)'} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.host}</span>
              </span>
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>{off ? 'Paused' : ROLE_LABEL[serverRole(s)]}</span>
            </button>
          );
        })}
        {!pick.servers.length && <div style={{ padding: 12, fontSize: 12, color: 'var(--il-muted)' }}>No servers yet.</div>}
      </div>
    </div>
  );
}

export function ComfyPhoneScreen() {
  useVideoServerProbe();
  const go = useRoute((s) => s.go);
  const pick = useComfyServer();
  const host = pick.server?.host ?? null;
  const live = useComfyHost(host);
  const wf = useComfyWorkflows(pick.server, pick.kind);
  const up = useServersUp(pick.servers);
  const [seg, setSeg] = useState<Seg>('servers');
  const land = usePhoneLandscape();
  const [side, setSide] = useState<'queue' | 'log' | 'servers'>('queue');
  const openBtn = host && (
    <a href={comfyPageUrl(host)} target="_blank" rel="noreferrer"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: land ? 44 : 54, flex: 'none', borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontSize: land ? 14 : 16, fontWeight: 800, textDecoration: 'none' }}>
      Open ComfyUI<IconExternalLink size={16} stroke={2.6} />
    </a>
  );

  if (land) {
    // Phone landscape (mobile pass, mockup mobile-m-browse.html §6): the workflows on the left,
    // Queue · Log · Servers on the right with "Open ComfyUI ↗" pinned under them.
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <PhoneTwoPane
          mainBackground="var(--il-bg)"
          main={(
            <div className="il-scroll" style={{ position: 'absolute', inset: 0, padding: `calc(8px + env(safe-area-inset-top, 0px)) 12px calc(16px + var(--il-safe-bottom))`, display: 'flex', flexDirection: 'column', gap: 10, touchAction: 'pan-y' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LandBack onClick={() => go('step')} />
                <span style={{ fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0 }}>ComfyUI</span>
                <ServerPicker pick={pick} online={live.online} stats={live.stats} queued={live.rows.length} up={up} compact />
              </div>
              <WorkflowList wf={wf} large scroll={false} />
            </div>
          )}
          sideHeader={(
            <Tabs<'queue' | 'log' | 'servers'> value={side} onChange={setSide} items={[
              { key: 'queue', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Queue{live.rows.length > 0 && <Count n={live.rows.length} />}</span> },
              { key: 'log', label: 'Log' },
              { key: 'servers', label: 'Servers' },
            ]} />
          )}
          side={(
            <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {side === 'queue' && <QueueList host={host} rows={live.rows} live={live.live} radius={20} />}
              {side === 'log' && <LogBox host={host} fill={false} maxHeight={600} />}
              {side === 'servers' && (
                <>
                  <ServerStatus server={pick.server} online={live.online} stats={live.stats} queued={live.rows.length} />
                  <ServerList pick={pick} online={live.online} up={up} />
                </>
              )}
            </div>
          )}
          sideFooter={openBtn || undefined}
        />
        <ParamMapModal />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px 0' }}>
        <span style={{ fontWeight: 800, fontSize: 18 }}>ComfyUI</span>
        <ServerPicker pick={pick} online={live.online} stats={live.stats} queued={live.rows.length} up={up} compact />
      </div>
      <div style={{ flex: 'none', padding: '8px 14px 4px' }}>
        <Tabs<Seg>
          value={seg}
          onChange={setSeg}
          items={[
            { key: 'servers', label: 'Servers' },
            { key: 'workflows', label: 'Workflows' },
            { key: 'queue', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Queue{live.rows.length > 0 && <Count n={live.rows.length} />}</span> },
          ]}
        />
      </div>

      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '10px 14px 100px', display: 'flex', flexDirection: 'column', gap: 12, touchAction: 'pan-y' }}>
        {seg === 'servers' && (
          <>
            <ServerStatus server={pick.server} online={live.online} stats={live.stats} queued={live.rows.length} />
            {openBtn}
            {host && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center', marginTop: -4 }}>opens the node editor in a new tab</div>}
            <ServerList pick={pick} online={live.online} up={up} />
          </>
        )}
        {seg === 'workflows' && <WorkflowList wf={wf} large scroll={false} />}
        {seg === 'queue' && (
          <>
            <QueueList host={host} rows={live.rows} live={live.live} radius={20} />
            <LogBox host={host} fill={false} maxHeight={340} />
          </>
        )}
      </div>

      <BackPill onClick={() => go('step')} />
      <ParamMapModal />
    </div>
  );
}
