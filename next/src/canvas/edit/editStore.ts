/**
 * Item 13: Edit mode's state. One edit session at a time, on the picture the stage shows:
 *   on / off (toolbar Edit button, E): on folds the step panel (remembering it was open), off
 *   gives it back;
 *   the session's history of frames (a frame = a picture + its live look), undo / redo / reset;
 *   the open tool (its flyout; 'crop' = crop handles on the picture), the crop rect and ratio;
 *   a busy label while a tool runs on ComfyUI or the picture saves.
 * The GPU engine that shows the session registers itself here (`setEditEngine`) so tools can bake.
 */
import { create } from 'zustand';
import type { HistoryEntry } from '@/lib/types';
import type { ComfyImageRef } from '@/lib/comfyBus';
import { useLayout } from '~/screens/image/layoutStore';
import type { GpuCanvas } from '../gpu/engine';
import { commit, redoH, resetH, startHistory, undoH, NEUTRAL_LOOK, isNeutralLook, type History, type Look, type Rect } from './editLogic';
import { picFromBlob, type Pic } from './bitmapOps';

export type EditToolId =
  | 'crop' | 'adjust' | 'removebg' | 'upscale' | 'size' | 'sharpen' | 'posterize' | 'edges' | 'lineart' | 'depth' | 'face' | 'save';

export interface EditFrame {
  pic: Pic;
  look: Look;
  label: string;
  /** The picture is already an output on a server (a ComfyUI tool made it): Save can point at it. */
  saved?: { image: ComfyImageRef; host: string; serverId: string | null };
}

export interface EditSource { url: string; filename: string; entry: HistoryEntry | null }

interface EditState {
  on: boolean;
  source: EditSource | null;
  hist: History<EditFrame> | null;
  loading: boolean;
  tool: EditToolId | null;
  crop: Rect | null;
  cropRatio: string;
  busy: string | null;
  error: string | null;
  /** Leaving with unsaved edits asks first (the bar shows Save / Discard / Keep editing). */
  askLeave: boolean;
  /** The step panel was open when Edit mode began (null = Edit mode did not fold it). */
  panelWasOpen: boolean | null;
}

export const useEdit = create<EditState>(() => ({
  on: false, source: null, hist: null, loading: false, tool: null, crop: null, cropRatio: 'free', busy: null, error: null, askLeave: false, panelWasOpen: null,
}));

let engine: GpuCanvas | null = null;
export const setEditEngine = (e: GpuCanvas | null) => { engine = e; };
export const editEngine = () => engine;

/** Every picture URL this session made (revoked when it ends). */
let made: string[] = [];
let loadSeq = 0;

export const isDirty = (s: Pick<EditState, 'hist'> = useEdit.getState()) => !!s.hist && (s.hist.past.length > 0 || !isNeutralLook(s.hist.present.look));

/** Start (or restart) a session on `source`. */
async function load(source: EditSource) {
  const seq = ++loadSeq;
  useEdit.setState({ source, hist: null, loading: true, error: null, tool: null, crop: null, askLeave: false });
  try {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pic = await picFromBlob(await res.blob());
    if (seq !== loadSeq) { URL.revokeObjectURL(pic.url); return; }
    made.push(pic.url);
    useEdit.setState({ hist: startHistory<EditFrame>({ pic, look: NEUTRAL_LOOK, label: 'Original' }), loading: false });
  } catch (e) {
    if (seq === loadSeq) useEdit.setState({ loading: false, error: `Could not load the picture: ${e instanceof Error ? e.message : String(e)}` });
  }
}

export function enterEdit(source: EditSource) {
  const st = useEdit.getState();
  if (st.on && st.source?.url === source.url) return;
  const layout = useLayout.getState();
  const panelWasOpen = st.on ? st.panelWasOpen : layout.stepOpen;
  if (!st.on && layout.stepOpen) layout.toggleStep();
  useEdit.setState({ on: true, panelWasOpen });
  void load(source);
}

/** The stage shows another picture: follow it when nothing is edited yet. */
export function followSource(source: EditSource | null) {
  const st = useEdit.getState();
  if (!st.on || !source || st.source?.url === source.url || isDirty(st) || st.busy) return;
  void load(source);
}

/** Leave Edit mode. With unsaved edits it asks first unless `force`. */
export function exitEdit(force = false) {
  const st = useEdit.getState();
  if (!st.on) return;
  if (!force && isDirty(st)) { useEdit.setState({ askLeave: true }); return; }
  loadSeq++;
  const urls = made; made = [];
  setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 1500);
  const layout = useLayout.getState();
  if (st.panelWasOpen && !layout.stepOpen) layout.toggleStep();
  useEdit.setState({ on: false, source: null, hist: null, loading: false, tool: null, crop: null, busy: null, error: null, askLeave: false, panelWasOpen: null });
}

export function toggleEdit(source: EditSource | null) {
  if (useEdit.getState().on) exitEdit();
  else if (source) enterEdit(source);
}

/** A new frame (a tool's result). The look rides along unless the frame brings its own. */
export function pushFrame(f: Omit<EditFrame, 'look'> & { look?: Look }) {
  const h = useEdit.getState().hist;
  if (!h) return;
  made.push(f.pic.url);
  useEdit.setState({ hist: commit(h, { look: h.present.look, ...f }), error: null });
}

/** Change the live look. `merge` = part of one slider drag (one undo step). */
export function setLook(patch: Partial<Look>, merge = false) {
  const h = useEdit.getState().hist;
  if (!h) return;
  const look = { ...h.present.look, ...patch };
  useEdit.setState({ hist: commit(h, { ...h.present, look, label: 'Adjust' }, merge) });
}

export const undoEdit = () => { const h = useEdit.getState().hist; if (h) useEdit.setState({ hist: undoH(h), crop: null }); };
export const redoEdit = () => { const h = useEdit.getState().hist; if (h) useEdit.setState({ hist: redoH(h), crop: null }); };
export const resetEdit = () => { const h = useEdit.getState().hist; if (h) useEdit.setState({ hist: resetH(h), crop: null, tool: null }); };

export function setTool(tool: EditToolId | null) {
  const st = useEdit.getState();
  const next = st.tool === tool ? null : tool;
  useEdit.setState({ tool: next, crop: next === 'crop' ? st.crop : null });
}

/** The present frame's picture with its look baked in (a PNG), for ComfyUI tools and Save. */
export async function bakedNow(): Promise<{ blob: Blob; frame: EditFrame }> {
  const h = useEdit.getState().hist;
  if (!h) throw new Error('Nothing to edit');
  const f = h.present;
  if (isNeutralLook(f.look)) return { blob: f.pic.blob, frame: f };
  const e = engine;
  if (!e) throw new Error('The GPU canvas is not ready');
  return { blob: await e.bake(f.pic.url, f.look), frame: f };
}

/** Run something that makes a new frame, with the busy label and the error line. */
export async function busyRun(label: string, fn: () => Promise<void>) {
  if (useEdit.getState().busy) return;
  useEdit.setState({ busy: label, error: null });
  try { await fn(); } catch (e) {
    if ((e as Error)?.name !== 'AbortError') useEdit.setState({ error: `${label} failed: ${e instanceof Error ? e.message : String(e)}` });
  } finally { useEdit.setState({ busy: null }); }
}
