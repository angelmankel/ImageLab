/**
 * Driving the embedded ComfyUI from our panels (FIXLIST 34). The frame is the ComfyUI of the
 * chosen server; on this site it is served from the same origin (nginx route), so its page's
 * objects are reachable: `window.app` (ComfyApp) and `app.extensionManager` (the frontend's
 * workspace store: `command.execute(id)`, `workflow` = the workflow store, `focusMode`).
 * Checked against ComfyUI frontend 1.52.7. A frame on another origin cannot be driven: every
 * call then reports `blocked` and the panels say so.
 *
 * What it does: open a saved workflow in the frame (what ComfyUI's own workflow sidebar does:
 * load the file, `loadGraphData` bound to the persisted workflow so Save writes to it), queue
 * the open workflow, New / Save / Save as (ComfyUI's own commands, so its own name dialogs),
 * delete (the workflow store, closing it first when it is open), and focus mode (hides ComfyUI's
 * menus, sidebars and tabs).
 */
import { create } from 'zustand';
import { plainCopy } from './frameCopy';

/* eslint-disable @typescript-eslint/no-explicit-any */
type FrameWorkflow = { path: string; isLoaded?: boolean; isModified?: boolean; activeState?: unknown; load: () => Promise<unknown> };
interface Workspace {
  focusMode: boolean;
  toggleFocusMode: () => void;
  command: { execute: (id: string, opts?: unknown) => Promise<unknown> };
  workflow: {
    activeWorkflow: FrameWorkflow | null;
    getWorkflowByPath: (path: string) => FrameWorkflow | null;
    syncWorkflows: () => Promise<void>;
    isOpen: (w: FrameWorkflow) => boolean;
    isActive: (w: FrameWorkflow) => boolean;
    closeWorkflow: (w: FrameWorkflow) => Promise<unknown>;
    deleteWorkflow: (w: FrameWorkflow) => Promise<void>;
    renameWorkflow?: (w: FrameWorkflow, newPath: string) => Promise<void>;
  };
}
interface FrameApp { loadGraphData: (...args: any[]) => Promise<unknown>; extensionManager?: Workspace }

export type FrameStatus = 'none' | 'loading' | 'ready' | 'blocked';

const FOCUS_KEY = 'imagelab.next.comfy.hideMenus';
const readFocus = () => { try { return localStorage.getItem(FOCUS_KEY) === '1'; } catch { return false; } };

interface FrameState {
  status: FrameStatus;
  /** Our toggle: ComfyUI's own menus hidden (its focus mode). Kept per viewer. */
  hideMenus: boolean;
  /** The workflow path open in the frame, as far as we know (null = unsaved / unknown). */
  openPath: string | null;
}
export const useComfyFrame = create<FrameState>(() => ({ status: 'none', hideMenus: readFocus(), openPath: null }));

let frame: HTMLIFrameElement | null = null;
let poll = 0;
let pendingOpen: string | null = null;

function access(): { app: FrameApp; ws: Workspace } | null | 'blocked' {
  if (!frame) return null;
  try {
    const w = frame.contentWindow as (Window & { app?: FrameApp }) | null;
    const app = w?.app;
    const ws = app?.extensionManager;
    if (!app || !ws?.command || !ws.workflow) return null;
    return { app, ws };
  } catch {
    return 'blocked';
  }
}

function applyFocus(ws: Workspace) {
  const want = useComfyFrame.getState().hideMenus;
  try { if (!!ws.focusMode !== want) ws.toggleFocusMode(); } catch { /* older frontend */ }
}

let track = 0;
function stopPoll() {
  if (poll) { window.clearInterval(poll); poll = 0; }
  if (track) { window.clearInterval(track); track = 0; }
}

/** ComfyEmbed hands its iframe here (null when it goes). Polls until ComfyUI's app is up. */
export function attachFrame(el: HTMLIFrameElement | null): void {
  stopPoll();
  frame = el;
  if (!el) { useComfyFrame.setState({ status: 'none', openPath: null }); return; }
  useComfyFrame.setState({ status: 'loading', openPath: null });
  const started = Date.now();
  poll = window.setInterval(() => {
    const a = access();
    if (a === 'blocked') { stopPoll(); useComfyFrame.setState({ status: 'blocked' }); return; }
    if (a) {
      stopPoll();
      useComfyFrame.setState({ status: 'ready', openPath: activePathInFrame() });
      applyFocus(a.ws);
      // Follow what the frame shows (its own tabs, its own Open), for the selected row.
      track = window.setInterval(() => {
        // ComfyUI reloaded inside the frame: wait for it again (and re-apply the menus toggle).
        if (access() === null && frame) { attachFrame(frame); return; }
        const p = activePathInFrame();
        if (p !== useComfyFrame.getState().openPath) useComfyFrame.setState({ openPath: p });
      }, 1000);
      if (pendingOpen) { const p = pendingOpen; pendingOpen = null; void openInFrame(p); }
      return;
    }
    if (Date.now() - started > 120_000) { stopPoll(); useComfyFrame.setState({ status: 'none' }); }
  }, 400);
}

function ready(): { app: FrameApp; ws: Workspace } | null {
  const a = access();
  if (a === 'blocked') { useComfyFrame.setState({ status: 'blocked' }); return null; }
  return a;
}

/** The frame's workflow state as plain objects of the frame's own realm (FIXLIST-2 #50, ./frameCopy). */
function frameCopy(state: unknown): unknown {
  return plainCopy(state, (frame?.contentWindow as (Window & { JSON?: JSON }) | null)?.JSON ?? JSON);
}

/** Open a saved workflow (path under workflows/, e.g. `wip/portrait.json`) in the frame. */
export async function openInFrame(path: string): Promise<boolean> {
  const a = ready();
  if (!a) {
    if (useComfyFrame.getState().status === 'loading') pendingOpen = path; // opens once the frame is up
    return false;
  }
  const key = `workflows/${path}`;
  let wf = a.ws.workflow.getWorkflowByPath(key);
  if (!wf) { await a.ws.workflow.syncWorkflows(); wf = a.ws.workflow.getWorkflowByPath(key); }
  if (!wf) return false;
  if (a.ws.workflow.isActive(wf)) { useComfyFrame.setState({ openPath: path }); return true; }
  const fresh = !wf.isLoaded;
  if (fresh) { const loaded = await wf.load(); if (loaded && typeof loaded === 'object' && 'path' in loaded) wf = loaded as FrameWorkflow; }
  const state = frameCopy(wf.activeState);
  if (!state) throw new Error(`ComfyUI has no graph for ${path} (the file may be empty)`);
  await a.app.loadGraphData(state, true, true, wf, { checkForRerouteMigration: false, deferWarnings: true, skipAssetScans: !fresh });
  useComfyFrame.setState({ openPath: path });
  return true;
}

async function run(id: string): Promise<boolean> {
  const a = ready();
  if (!a) return false;
  await a.ws.command.execute(id);
  return true;
}

/** ComfyUI's Run / Queue for the open workflow. */
export const queueInFrame = () => run('Comfy.QueuePrompt');
export const newInFrame = async () => { const ok = await run('Comfy.NewBlankWorkflow'); if (ok) useComfyFrame.setState({ openPath: null }); return ok; };
export const saveInFrame = () => run('Comfy.SaveWorkflow');
export const saveAsInFrame = () => run('Comfy.SaveWorkflowAs');

/** The path (under workflows/) of what the frame shows, when it is a saved file. */
export function activePathInFrame(): string | null {
  const a = ready();
  const p = a ? a.ws.workflow.activeWorkflow?.path : null;
  return p && p.startsWith('workflows/') ? p.slice('workflows/'.length) : null;
}

/**
 * Delete through the frame (closes it there first). Returns false when the frame cannot do it
 * (the caller then deletes through the API). Throws when ComfyUI refused.
 */
export async function deleteInFrame(path: string): Promise<boolean> {
  const a = ready();
  if (!a) return false;
  const key = `workflows/${path}`;
  let wf = a.ws.workflow.getWorkflowByPath(key);
  if (!wf) { await a.ws.workflow.syncWorkflows(); wf = a.ws.workflow.getWorkflowByPath(key); }
  if (!wf) return false;
  if (a.ws.workflow.isActive(wf)) await a.ws.command.execute('Workspace.CloseWorkflow');
  else if (a.ws.workflow.isOpen(wf)) await a.ws.workflow.closeWorkflow(wf);
  if (a.ws.workflow.isOpen(wf)) throw new Error('It is still open in ComfyUI');
  await a.ws.workflow.deleteWorkflow(wf);
  if (useComfyFrame.getState().openPath === path) useComfyFrame.setState({ openPath: null });
  return true;
}

/**
 * Rename through the frame (FIXLIST-2 #53), so an open tab follows the file. Returns false when
 * the frame cannot do it (the caller then moves the file through the API). Throws when ComfyUI refused.
 */
export async function renameInFrame(from: string, to: string): Promise<boolean> {
  const a = ready();
  if (!a || typeof a.ws.workflow.renameWorkflow !== 'function') return false;
  const key = `workflows/${from}`;
  let wf = a.ws.workflow.getWorkflowByPath(key);
  if (!wf) { await a.ws.workflow.syncWorkflows(); wf = a.ws.workflow.getWorkflowByPath(key); }
  if (!wf) return false;
  await a.ws.workflow.renameWorkflow(wf, `workflows/${to}`);
  if (useComfyFrame.getState().openPath === from) useComfyFrame.setState({ openPath: to });
  return true;
}

/** After a file changed behind the frame's back (our import, an Undo): let its list catch up. */
export async function syncFrame(): Promise<void> {
  const a = ready();
  if (a) { try { await a.ws.workflow.syncWorkflows(); } catch { /* next sync gets it */ } }
}

/** Our "Hide ComfyUI menus" toggle: remembered, applied now and on every (re)load. */
export function setHideMenus(on: boolean): void {
  try { localStorage.setItem(FOCUS_KEY, on ? '1' : '0'); } catch { /* private window */ }
  useComfyFrame.setState({ hideMenus: on });
  const a = ready();
  if (a) applyFocus(a.ws);
}
