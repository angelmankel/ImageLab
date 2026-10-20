/**
 * Rule 14, desktop: the ComfyUI screen, right of the rail.
 *
 *   [ left panel 300: Image · Video, status, saved workflows, Open in a new tab ]
 *   [ centre: toolbar row 52 + embedded ComfyUI (the rest of the height)         ]
 *   [ right panel 320: queue (✕ per row), log                                    ]
 *
 * Both side panels collapse to a slim tab and resize (`ui/Panel`).
 */
import { useState } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import { useVideoServerProbe } from '@/hooks/useVideoServerProbe';
import { Panel } from '~/ui';
import { T } from '~/theme/tokens';
import { comfyPageUrl } from './comfyApi';
import { ComfyEmbed } from './ComfyEmbed';
import { LogBox } from './LogBox';
import { QueueList } from './QueueList';
import { ServerStatus } from './ServerStatus';
import { ServerSwitch } from './ServerSwitch';
import { useComfyHost } from './useComfyHost';
import { useComfyServer } from './useComfyServer';
import { useComfyWorkflows } from './useComfyWorkflows';
import { WorkflowList } from './WorkflowList';
import { useServersUp } from '~/screens/settings/useServersUp';

export function ComfyScreen() {
  useVideoServerProbe();
  const pick = useComfyServer();
  const host = pick.server?.host ?? null;
  const live = useComfyHost(host);
  const wf = useComfyWorkflows(pick.server, pick.kind);
  const up = useServersUp(pick.servers);

  const [leftOpen, setLeftOpen] = useState(true);
  const [leftW, setLeftW] = useState(300);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightW, setRightW] = useState(320);

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <Panel side="left" width={leftW} min={260} max={460} open={leftOpen} onResize={setLeftW} onToggle={() => setLeftOpen((o) => !o)} tabLabel="Workflows">
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: T.pad.panel }}>
          <ServerSwitch pick={pick} online={live.online} up={up} />
          <ServerStatus server={pick.server} online={live.online} stats={live.stats} queued={live.rows.length} />
          <div style={{ height: 4, flex: 'none' }} />
          <WorkflowList wf={wf} />
          {host && (
            <a href={comfyPageUrl(host)} target="_blank" rel="noreferrer"
              style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, border: '1px solid var(--il-line-strong)', borderRadius: 14, color: 'var(--il-fg)', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              Open in a new tab<IconExternalLink size={14} />
            </a>
          )}
        </div>
      </Panel>

      <ComfyEmbed server={pick.server} online={live.online} running={live.rows.some((r) => r.state === 'running')} />

      <Panel side="right" width={rightW} min={260} max={520} open={rightOpen} onResize={setRightW} onToggle={() => setRightOpen((o) => !o)} tabLabel="Queue">
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16, padding: T.pad.panel }}>
          <div className="il-scroll" style={{ flex: 'none', maxHeight: '50%', minHeight: 0 }}>
            <QueueList host={host} rows={live.rows} live={live.live} />
          </div>
          <LogBox host={host} />
        </div>
      </Panel>
    </div>
  );
}
