/**
 * Rule 14, desktop: the ComfyUI screen, right of the rail.
 *
 *   [ left panel 300: Image · Video, status, saved workflows (click = open in the frame) ]
 *   [ centre: toolbar row 52 (Generate, New / Save / Save as …) + embedded ComfyUI       ]
 *   [ right panel 320: queue (✕ per row), log — collapsed until opened, remembered       ]
 *
 * Both side panels collapse to a slim tab and resize (`ui/Panel`). FIXLIST 34: the queue starts
 * collapsed and its open / closed state and width are kept per viewer (localStorage); "Open in a
 * new tab" lives only in the centre toolbar.
 */
import { useState } from 'react';
import { useVideoServerProbe } from '@/hooks/useVideoServerProbe';
import { Panel } from '~/ui';
import { T } from '~/theme/tokens';
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
import { ParamMapModal } from '~/screens/image/workflow/ParamMapModal';

const QUEUE_OPEN_KEY = 'imagelab.next.comfy.queueOpen';
const QUEUE_W_KEY = 'imagelab.next.comfy.queueWidth';
function readPref(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function writePref(key: string, v: string): void { try { localStorage.setItem(key, v); } catch { /* private window */ } }

export function ComfyScreen() {
  useVideoServerProbe();
  const pick = useComfyServer();
  const host = pick.server?.host ?? null;
  const live = useComfyHost(host);
  const wf = useComfyWorkflows(pick.server, pick.kind);
  const up = useServersUp(pick.servers);

  const [leftOpen, setLeftOpen] = useState(true);
  const [leftW, setLeftW] = useState(300);
  const [rightOpen, setRightOpen] = useState(() => readPref(QUEUE_OPEN_KEY) === '1');
  const [rightW, setRightW] = useState(() => Number(readPref(QUEUE_W_KEY)) || 320);
  const toggleRight = () => { writePref(QUEUE_OPEN_KEY, rightOpen ? '0' : '1'); setRightOpen(!rightOpen); };
  const resizeRight = (w: number) => { setRightW(w); writePref(QUEUE_W_KEY, String(Math.round(w))); };

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <Panel side="left" width={leftW} min={260} max={460} open={leftOpen} onResize={setLeftW} onToggle={() => setLeftOpen((o) => !o)} tabLabel="Workflows">
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: T.pad.panel }}>
          <ServerSwitch pick={pick} online={live.online} up={up} />
          <ServerStatus server={pick.server} online={live.online} stats={live.stats} queued={live.rows.length} />
          <div style={{ height: 4, flex: 'none' }} />
          <WorkflowList wf={wf} />
        </div>
      </Panel>

      <ComfyEmbed server={pick.server} online={live.online} running={live.rows.some((r) => r.state === 'running')} onWorkflowsChanged={wf.refresh} />

      <Panel side="right" width={rightW} min={260} max={520} open={rightOpen} onResize={resizeRight} onToggle={toggleRight} tabLabel={live.rows.length ? `Queue · ${live.rows.length}` : 'Queue'}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16, padding: T.pad.panel }}>
          <div className="il-scroll" style={{ flex: 'none', maxHeight: '50%', minHeight: 0 }}>
            <QueueList host={host} rows={live.rows} live={live.live} />
          </div>
          <LogBox host={host} />
        </div>
      </Panel>
      <ParamMapModal />
    </div>
  );
}
