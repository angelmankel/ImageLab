/**
 * Saved workflows on the chosen server (rule 14). The list, its polling and opening one are the
 * main app's (`@/features/studio/useWorkflowLibrary`, which needs the raw `/object_info` from
 * `useObjectInfo`); opening loads the workflow into the shared Studio store, which is what a
 * workflow step runs. This adds what the new screen shows and does: node counts (read once per
 * saved version), "last used", "Use as step", and importing a JSON file (an API-format graph is
 * turned into an editor workflow with `@/lib/workflowGraph`'s `apiToEditor`).
 * FIXLIST-2 #53 adds the row type (image / video / upscale, read with the node count), Rename,
 * Duplicate, Save as and New; Delete goes on the app-wide undo stack instead of a toast.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { loadSavedWorkflow, type SavedWorkflow } from '@/lib/comfy';
import { useWorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { apiToEditor, type ApiGraph } from '@/lib/workflowGraph';
import type { Server } from '@/lib/storage';
import { useSteps } from '~/app/stepsStore';
import { useRoute } from '~/app/routeStore';
import { pushUndo } from '~/app/undo';
import { deleteWorkflowFile, moveWorkflowFile, restoreWorkflowFile, saveWorkflowFile } from './comfyApi';
import { deleteInFrame, newInFrame, openInFrame, renameInFrame, syncFrame } from './comfyFrame';
import { askName } from './askName';
import { copyNames, renamedPath, workflowType, type WorkflowType } from './workflowListLogic';
import { errorNote } from './errorNote';
import { editorNodeCount, epochMs, workflowFileName, workflowKind } from './comfyHelpers';
import { useWorkflowStore, workflowKey, type ComfyKind } from './workflowStore';
import { ensureStepWorkflowOpen } from './ensureStepWorkflow';
import { notifyError } from '~/app/notify';

export interface ComfyWorkflowRow extends SavedWorkflow {
  key: string;
  nodes: number | null;
  type: WorkflowType | null;
  usedAt: number;
  savedAt: number;
}

export function useComfyWorkflows(server: Server | null, kind: ComfyKind) {
  const host = server?.host ?? null;
  const { info, error: infoError } = useObjectInfo(host);
  const library = useWorkflowLibrary(host, info);
  const meta = useWorkflowStore((s) => s.meta);
  const lastUsed = useWorkflowStore((s) => s.lastUsed);

  // Read node counts one file at a time, only for versions not read yet.
  useEffect(() => {
    if (!host || !library.workflows.length) return;
    let stopped = false;
    void (async () => {
      for (const w of library.workflows.slice(0, 60)) {
        if (stopped) return;
        const key = workflowKey(host, w.path);
        const known = useWorkflowStore.getState().meta[key];
        if (known && known.modified === w.modified && known.type) continue;
        try {
          const wf = await loadSavedWorkflow(host, w.path);
          if (!stopped) useWorkflowStore.getState().setMeta(key, { nodes: editorNodeCount(wf), modified: w.modified, type: workflowType(wf) });
        } catch { /* a file that will not load just shows no count */ }
      }
    })();
    return () => { stopped = true; };
  }, [host, library.workflows]);

  const rows = useMemo<ComfyWorkflowRow[]>(() => (host ? library.workflows.map((w) => {
    const key = workflowKey(host, w.path);
    const m = meta[key];
    return { ...w, key, nodes: m ? m.nodes : null, type: m?.type ?? null, usedAt: lastUsed[key] ?? 0, savedAt: epochMs(w.modified) };
  }) : []), [host, library.workflows, meta, lastUsed]);

  const open = library.open;

  /** Load it, add a workflow step that runs it, remember which, and go to the step. */
  const addAsStep = useCallback(async (w: ComfyWorkflowRow) => {
    if (!host) return;
    const stepId = useSteps.getState().addStep('workflow', w.name);
    const store = useWorkflowStore.getState();
    store.setStepWorkflow(stepId, { host, serverId: server?.id ?? null, path: w.path, name: w.name, kind });
    store.markUsed(w.key);
    // Load it into the Studio store from the step's host, so the step's Generate runs it.
    try { await ensureStepWorkflowOpen(stepId); } catch (err) {
      errorNote('Could not open this workflow', err);
    }
    useRoute.getState().go('step');
  }, [host, server?.id, kind]);

  /** Open it in the embedded ComfyUI (FIXLIST 34) and in the shared Studio store (what a workflow step runs). */
  const select = useCallback(async (w: ComfyWorkflowRow) => {
    void openInFrame(w.path).catch((err) => errorNote('Could not open this workflow', err, `ComfyUI could not load ${w.name}.`));
    await open(w.path);
    useWorkflowStore.getState().markUsed(w.key);
  }, [open]);

  /** Delete the file from ComfyUI's workflow store (through the frame when it can, so its tab closes too). Undo (Ctrl+Z) writes it back. */
  const remove = useCallback(async (w: ComfyWorkflowRow) => {
    if (!host) return;
    let saved: unknown;
    try { saved = await loadSavedWorkflow(host, w.path); } catch { saved = undefined; }
    const del = async () => {
      const viaFrame = await deleteInFrame(w.path);
      if (!viaFrame) await deleteWorkflowFile(host, w.path);
      library.refresh();
    };
    try { await del(); } catch (err) { errorNote('Could not delete this workflow', err); return; }
    if (saved !== undefined) {
      pushUndo({
        label: 'Delete workflow',
        undo: () => { void restoreWorkflowFile(host, w.path, saved).then(() => { library.refresh(); return syncFrame(); }).catch((err) => errorNote('Could not bring the workflow back', err)); },
        redo: () => { void del().catch((err) => errorNote('Could not delete this workflow', err)); },
      });
    }
  }, [host, library]);

  /** Write `wf` under the first free name of `names`; returns the path or null when all exist. */
  const saveUnique = useCallback(async (names: string[], wf: unknown): Promise<string | null> => {
    if (!host) return null;
    for (const name of names) {
      try { await saveWorkflowFile(host, name, wf); return name; } catch (err) {
        if (err instanceof Error && err.message === 'exists') continue;
        throw err;
      }
    }
    return null;
  }, [host]);

  /** Rename the file (through the frame when it can, so an open tab follows). Steps that run it follow too. */
  const rename = useCallback(async (w: ComfyWorkflowRow) => {
    if (!host) return;
    const typed = await askName('Rename workflow', w.name, 'Rename');
    const to = typed ? renamedPath(w.path, typed) : null;
    if (!to) return;
    const name = to.slice(to.lastIndexOf('/') + 1).replace(/\.json$/, '');
    const move = async (from: string, dest: string) => {
      if (!(await renameInFrame(from, dest))) { await moveWorkflowFile(host, from, dest); void syncFrame(); }
      useWorkflowStore.getState().renamePath(host, from, dest, dest.slice(dest.lastIndexOf('/') + 1).replace(/\.json$/, ''));
      library.refresh();
    };
    try { await move(w.path, to); } catch (err) {
      errorNote('Could not rename this workflow', err instanceof Error && err.message === 'exists' ? new Error(`There is already a workflow called ${name}.`) : err);
      return;
    }
    pushUndo({
      label: 'Rename workflow',
      undo: () => { void move(to, w.path).catch((err) => errorNote('Could not undo the rename', err)); },
      redo: () => { void move(w.path, to).catch((err) => errorNote('Could not rename this workflow', err)); },
    });
  }, [host, library]);

  /** A copy next to it: "name (copy).json". With `ask`: Save as, under a typed name, then open the copy. */
  const copy = useCallback(async (w: ComfyWorkflowRow, ask: boolean) => {
    if (!host) return;
    let names = copyNames(w.path);
    if (ask) {
      const typed = await askName('Save as', `${w.name} copy`, 'Save');
      const to = typed ? renamedPath(w.path, typed) : null;
      if (!to) return;
      names = [to];
    }
    let made: string | null;
    try {
      const wf = await loadSavedWorkflow(host, w.path);
      made = await saveUnique(names, wf);
    } catch (err) { errorNote(ask ? 'Could not save the copy' : 'Could not duplicate this workflow', err); return; }
    if (!made) { errorNote('Could not save the copy', new Error(ask ? 'A workflow with that name already exists.' : 'Too many copies already.')); return; }
    library.refresh();
    await syncFrame();
    const path = made;
    pushUndo({
      label: 'Copy workflow',
      undo: () => { void deleteWorkflowFile(host, path).then(() => { library.refresh(); return syncFrame(); }).catch((err) => errorNote('Could not undo the copy', err)); },
      redo: () => { void loadSavedWorkflow(host, w.path).then((wf) => restoreWorkflowFile(host, path, wf)).then(() => { library.refresh(); return syncFrame(); }).catch((err) => errorNote('Could not copy this workflow', err)); },
    });
    if (ask) void openInFrame(path).catch((err) => errorNote('Could not open this workflow', err));
  }, [host, library, saveUnique]);

  /** A blank workflow in the embedded ComfyUI (its own Save names it). */
  const create = useCallback(async () => {
    try { await newInFrame(); } catch (err) { errorNote('Could not start a new workflow', err); }
  }, []);

  /** Import a workflow file into this server's ComfyUI `workflows/` folder. */
  const importFile = useCallback(async (file: File) => {
    if (!host) return;
    let json: unknown;
    try { json = JSON.parse(await file.text()); } catch {
      notifyError('Not a workflow', undefined, { hint: `${file.name} is not a JSON file.` });
      return;
    }
    const kindOf = workflowKind(json);
    if (!kindOf) {
      notifyError('Not a workflow', undefined, { hint: `${file.name} has no ComfyUI nodes in it.` });
      return;
    }
    if (kindOf === 'api' && !info) {
      notifyError('Server not ready', undefined, { hint: 'It has not sent its node list yet. Try again in a moment.' });
      return;
    }
    const wf = kindOf === 'api' ? apiToEditor(json as ApiGraph, info!) : json;
    const base = workflowFileName(file.name).replace(/\.json$/, '');
    try {
      const made = await saveUnique(Array.from({ length: 20 }, (_, i) => (i ? `${base} (${i + 1}).json` : `${base}.json`)), wf);
      if (!made) { errorNote('Import failed', new Error(`Too many workflows called ${base}.`)); return; }
      library.refresh();
      void syncFrame();
    } catch (err) {
      errorNote('Import failed', err);
    }
  }, [host, info, library, saveUnique]);

  return {
    rows,
    loading: library.loading,
    error: library.error ?? (infoError ? `Could not read the server's nodes (${infoError})` : null),
    ready: !!info,
    addAsStep,
    select,
    remove,
    rename,
    duplicate: (w: ComfyWorkflowRow) => copy(w, false),
    saveAs: (w: ComfyWorkflowRow) => copy(w, true),
    create,
    importFile,
    refresh: library.refresh,
  };
}
