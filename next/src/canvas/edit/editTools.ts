/**
 * Item 13: what the Edit mode's tools DO. Pixel moves (rotate, flip, crop) are exact 2D-canvas
 * work (`bitmapOps`); the look is GPU filters (`gpu/engine`); the free ComfyUI tools run tiny
 * graphs (`toolGraphs`) through `~/app/imageGraphRun` on the picture's own server (else the image
 * server), and only show when that server has their nodes / models (`useServerTools`).
 * Save writes the edited picture as an output (LoadImage → SaveImage, or the tool's own output
 * when nothing changed since) and adds it to the history, derived from the source, selected.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import type { HistoryEntry } from '@/lib/types';
import { blobToImageState } from '@/features/inputImage/imageOps';
import { removeBgGraph, removeBgModels, removeBgServer, pickRemoveBgModel, REMOVE_BG_OUT } from '~/app/removeBg';
import { comboOptions, nodeInfo, runImageGraph } from '~/app/imageGraphRun';
import { useStage } from '~/screens/image/stageStore';
import { useLayout } from '~/screens/image/layoutStore';
import { cropPic, flip, picFromBlob, rotate90 } from './bitmapOps';
import { isNeutralLook, NEUTRAL_LOOK, type Rect } from './editLogic';
import { bakedNow, busyRun, exitEdit, pushFrame, useEdit } from './editStore';
import {
  DEPTH_NODES, LINEART_NODES, OUT, cannyGraph, faceRestoreGraph, padGraph, pickUpscaleModel, posterizeGraph, preprocessorGraph,
  resizeGraph, saveAsOutputGraph, sharpenGraph, upscaleGraph, type Graph, type NodeSpec,
} from './toolGraphs';

// ---- Pixel moves ---------------------------------------------------------------

const present = () => useEdit.getState().hist?.present ?? null;

export const rotateEdit = (dir: 1 | -1 = 1) => busyRun('Rotate', async () => { const f = present(); if (f) pushFrame({ pic: await rotate90(f.pic, dir), label: 'Rotate' }); });
export const flipEdit = (axis: 'h' | 'v') => busyRun('Flip', async () => { const f = present(); if (f) pushFrame({ pic: await flip(f.pic, axis), label: axis === 'h' ? 'Flip H' : 'Flip V' }); });
export const cropEdit = (r: Rect) => busyRun('Crop', async () => {
  const f = present(); if (!f) return;
  pushFrame({ pic: await cropPic(f.pic, r), label: 'Crop' });
  useEdit.setState({ tool: null, crop: null });
});

// ---- Server tools ---------------------------------------------------------------

/** Where ComfyUI tools run for this session: the source picture's server, else the image server. */
export function editHost(): { host: string; serverId: string | null } | null {
  const src = useEdit.getState().source;
  return src ? removeBgServer(src.url) : null;
}

export interface ServerTools {
  removebg?: { model: string };
  upscale?: { models: string[] };
  resize?: true;
  pad?: true;
  sharpen?: true;
  posterize?: true;
  edges?: true;
  lineart?: { cls: string; spec: NodeSpec | null };
  depth?: { cls: string; spec: NodeSpec | null };
  face?: { models: string[]; spec: NodeSpec | null };
}

async function probe(host: string): Promise<ServerTools> {
  const has = (cls: string) => nodeInfo(host, cls).then((i) => !!i);
  const first = async (list: readonly string[]) => { for (const c of list) { const i = await nodeInfo(host, c); if (i) return { cls: c, spec: i as NodeSpec }; } return null; };
  const [bg, scale, upModels, pad, sharpen, quant, canny, lineart, depth, faceNode, faceModels] = await Promise.all([
    removeBgModels(host), has('ImageScale'), comboOptions(host, 'UpscaleModelLoader', 'model_name'), has('ImagePadForOutpaint'),
    has('ImageSharpen'), has('ImageQuantize'), has('Canny'), first(LINEART_NODES), first(DEPTH_NODES),
    nodeInfo(host, 'FaceRestoreCFWithModel'), comboOptions(host, 'FaceRestoreModelLoader', 'model_name'),
  ]);
  const t: ServerTools = {};
  const bgModel = bg ? pickRemoveBgModel(bg) : null;
  if (bgModel) t.removebg = { model: bgModel };
  if (scale) { t.upscale = { models: upModels ?? [] }; t.resize = true; }
  if (pad) t.pad = true;
  if (sharpen) t.sharpen = true;
  if (quant) t.posterize = true;
  if (canny) t.edges = true;
  if (lineart) t.lineart = lineart;
  if (depth) t.depth = depth;
  if (faceNode && faceModels?.length) t.face = { models: faceModels, spec: faceNode as NodeSpec };
  return t;
}

const probes = new Map<string, Promise<ServerTools>>();
const NO_TOOLS: ServerTools = Object.freeze({}) as ServerTools;

/** The ComfyUI tools this session's server can run (empty while it asks, or offline). */
export function useServerTools(): ServerTools {
  const url = useEdit((s) => s.source?.url ?? null);
  const [tools, setTools] = useState<ServerTools>(NO_TOOLS);
  useEffect(() => {
    const host = url ? editHost()?.host : null;
    if (!host) { setTools(NO_TOOLS); return; }
    let p = probes.get(host);
    if (!p) { p = probe(host); probes.set(host, p); setTimeout(() => probes.delete(host), 60_000); }
    let alive = true;
    void p.then((t) => { if (alive) setTools(t); }, () => { if (alive) setTools(NO_TOOLS); });
    return () => { alive = false; };
  }, [url]);
  return tools;
}

/** Run a graph on the present frame (look baked in); its result becomes the next frame. */
async function runTool(label: string, build: (ref: string, w: number, h: number) => Graph, outNode = OUT) {
  await busyRun(label, async () => {
    const target = editHost();
    if (!target) throw new Error('No ComfyUI server is connected.');
    const { blob, frame } = await bakedNow();
    const res = await runImageGraph(target.host, blob, `edit_${uid()}.png`, (ref) => build(ref, frame.pic.w, frame.pic.h), outNode, { label });
    const pic = await picFromBlob(res.blob);
    pushFrame({ pic, label, look: NEUTRAL_LOOK, saved: { image: res.image, host: target.host, serverId: target.serverId } });
  });
}

export const removeBgEdit = (model: string) => runTool('Remove BG', (ref) => removeBgGraph(ref, model, 'imagelab/edit'), REMOVE_BG_OUT);
export const upscaleEdit = (by: number, models: readonly string[], useModel: boolean) =>
  runTool(`Upscale ×${by}`, (ref, w, h) => upscaleGraph(ref, w, h, by, useModel ? pickUpscaleModel(models, by) : null));
export const resizeEdit = (w: number, h: number, fill: boolean) => runTool('Resize', (ref) => resizeGraph(ref, w, h, fill));
export const padEdit = (p: { left: number; top: number; right: number; bottom: number }) => runTool('Pad', (ref) => padGraph(ref, p));
export const sharpenEdit = (amount: number, radius: number) => runTool('Sharpen', (ref) => sharpenGraph(ref, amount, radius));
export const posterizeEdit = (colors: number, dither: string) => runTool('Posterize', (ref) => posterizeGraph(ref, colors, dither));
export const edgesEdit = (low: number, high: number) => runTool('Edges', (ref) => cannyGraph(ref, low, high));
export const mapEdit = (label: string, cls: string, spec: NodeSpec | null) => runTool(label, (ref, w, h) => preprocessorGraph(ref, cls, spec, Math.max(w, h)));
export const faceEdit = (model: string, spec: NodeSpec | null, fidelity: number) => runTool('Face restore', (ref) => faceRestoreGraph(ref, model, spec, fidelity));

// ---- Save / use as input ------------------------------------------------------------

/** Save the edited picture as a new result (derived from the source), select it, leave Edit mode. */
export const saveEdit = () => busyRun('Save', async () => {
  const st = useEdit.getState();
  const f = st.hist?.present;
  if (!f || !st.source) return;
  const target = editHost();
  if (!target) throw new Error('No ComfyUI server is connected.');
  let image = f.saved && isNeutralLook(f.look) && f.saved.host === target.host ? f.saved.image : null;
  let promptId = '';
  if (!image) {
    const { blob } = await bakedNow();
    const res = await runImageGraph(target.host, blob, `edit_${uid()}.png`, (ref) => saveAsOutputGraph(ref), OUT, { label: 'Save' });
    image = res.image; promptId = res.promptId;
  }
  const src = st.source.entry;
  const made: HistoryEntry = {
    id: uid(),
    serverId: target.serverId ?? src?.serverId ?? '',
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type || 'output',
    promptId,
    positive: src?.positive ?? '',
    negative: src?.negative ?? '',
    seed: src?.seed ?? 0,
    model: src?.model ?? '',
    createdAt: Date.now(),
    ...(src?.workflow ? { workflow: src.workflow } : {}),
    ...(src?.layers ? { layers: src.layers } : {}),
    ...(src ? { derivedFrom: { id: src.id, op: 'edit' } } : {}),
  };
  const store = useStore.getState();
  const stamped = store.pushHistory(made);
  store.selectHistoryEntry(stamped);
  useStage.getState().showRun(null);
  exitEdit(true);
});

/** The edited picture becomes the step's input image (img2img), then Edit mode closes. */
export const useAsInputEdit = () => busyRun('Use as input', async () => {
  const st = useEdit.getState();
  if (!st.hist || !st.source) return;
  const { blob } = await bakedNow();
  const name = (st.source.filename.split('/').pop() || 'image').replace(/\.[^.]+$/, '') + '_edit.png';
  const state = await blobToImageState(blob, name);
  useStore.getState().setWorkflow({ inputImage: state });
  useLayout.getState().setTab('input');
  exitEdit(true);
});
